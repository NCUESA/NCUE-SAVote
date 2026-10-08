import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { electionIdToField, voteHashOf } from '../utils/zk-utils';

// @ts-ignore
import * as snarkjs from 'snarkjs';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class VotesService {
  constructor(private prisma: PrismaService) { }
  private readonly logger = new Logger(VotesService.name);

  /**
   * 送出一張選票。
   *
   * ────────────────────────────────────────────────────────────────────────
   * 原本這個方法最外層包著一個 catch，而且不論發生什麼錯誤都回傳
   *   return { status: 'success', message: 'Vote submitted successfully' };
   *
   * 註解寫的理由是「防 Timing Attack，回傳成功假象」。但它實際造成的是：
   *
   *   - 資料庫寫入失敗（連線中斷、交易衝突）→ 選民看到「投票成功」，
   *     選票根本沒有存進去，而且投票資格也沒有被核銷。
   *     在選舉裡這等同於無聲地銷毀選票。
   *   - ZK 驗證失敗、重複投票、找不到 commitment → 一律顯示成功，
   *     選民完全無從得知自己的票沒算到。
   *
   * 防 timing attack 的正確做法是讓各種失敗路徑的「耗時」一致，
   * 而不是讓它們的「結果」一致。這裡改為如實回報錯誤，
   * 並對所有驗證失敗路徑統一延遲，避免從回應時間反推失敗原因。
   * ────────────────────────────────────────────────────────────────────────
   */
  async submitVote(dto: SubmitVoteDto) {
    // 公開訊號順序由電路決定（packages/circuits/src/vote.circom）：
    //   [0] commitment  [1] nullifier  [2] electionId  [3] voteHash
    const signals = dto.publicSignals;
    if (!Array.isArray(signals) || signals.length !== 4) {
      throw new BadRequestException('MALFORMED_PUBLIC_SIGNALS');
    }

    // 每個公開訊號都是 BN254 純量體中的元素，一定是十進位數字字串
    if (!signals.every((x) => typeof x === 'string' && /^[0-9]{1,78}$/.test(x))) {
      throw new BadRequestException('MALFORMED_PUBLIC_SIGNALS');
    }

    const [commitment, nullifier, signalElectionId, signalVoteHash] = signals;

    // ── 綁定檢查：在跑昂貴的 ZK 驗證之前先擋 ──────────────────────────
    // 證明必須是「為這一場選舉」產生的。否則同一份證明可以被拿到
    // 另一場也登記了同一個 commitment 的選舉重放。
    let expectedElectionId: string;
    try {
      expectedElectionId = electionIdToField(dto.electionId);
    } catch {
      throw new BadRequestException('INVALID_ELECTION_ID');
    }
    if (signalElectionId !== expectedElectionId) {
      await this.equalizeTiming();
      throw new BadRequestException('ELECTION_MISMATCH');
    }

    // 證明必須是「為這一張選票」產生的。否則攔截到證明的人可以把
    // voteContent 換成別的候選人，證明照樣通過。
    if (signalVoteHash !== voteHashOf(dto.voteContent)) {
      await this.equalizeTiming();
      throw new BadRequestException('BALLOT_MISMATCH');
    }

    const isValidProof = await this.verifyZk(dto.proof, signals);
    if (!isValidProof) {
      // 刻意不記錄 commitment 本身：它是可以反查到選民的識別碼
      this.logger.warn(`ZK verification failed for election ${dto.electionId}`);
      await this.equalizeTiming();
      throw new BadRequestException('ZK_VERIFICATION_FAILED');
    }

    const voteKey = await this.prisma.userVoteKey.findFirst({
      where: { electionId: dto.electionId, commitment },
      select: { id: true, hasVoted: true },
    });

    if (!voteKey) {
      // 原本這裡會把該場選舉「所有」的 commitment 印進日誌：
      //   existingKeys.map(k => k.commitment).join(', ')
      // commitment 可以對應回選民，等於把整份對照表寫進日誌檔。
      this.logger.warn(`No matching vote key for election ${dto.electionId}`);
      await this.equalizeTiming();
      throw new BadRequestException('COMMITMENT_NOT_FOUND');
    }

    if (voteKey.hasVoted) {
      await this.equalizeTiming();
      throw new ConflictException('ALREADY_VOTED');
    }

    // 核銷投票資格與寫入選票必須是同一個交易。
    // updateMany + count 檢查可以在資料庫層擋下併發的重複投票：
    // 兩個請求同時進來時，只有一個能把 hasVoted 從 false 改成 true。
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.userVoteKey.updateMany({
          where: { id: voteKey.id, hasVoted: false },
          data: { hasVoted: true, votedAt: new Date() },
        });

        if (claimed.count === 0) {
          // 另一個併發請求搶先核銷了同一把鑰匙
          throw new ConflictException('ALREADY_VOTED');
        }

        await tx.vote.create({
          data: {
            electionId: dto.electionId,
            voteContent: dto.voteContent,
            encryptKey: dto.encryptKey,
            // (electionId, nullifier) 有唯一約束：就算 hasVoted 的檢查
            // 因故被繞過，資料庫層也會擋下第二張票
            nullifier,
            proof: dto.proof as any,
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // Prisma P2002 = 唯一約束衝突 → 這個 nullifier 已經投過票了
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('ALREADY_VOTED');
      }
      // 交易失敗時 hasVoted 會跟著回滾，選民可以安全地重試
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Vote transaction failed for election ${dto.electionId}: ${message}`);
      throw new InternalServerErrorException('VOTE_NOT_RECORDED');
    }

    return { status: 'success', message: 'Vote submitted successfully' };
  }

  /**
   * 讓各種驗證失敗路徑的回應時間趨於一致。
   * 真正的目的是不要讓攻擊者從「失敗得多快」推斷出失敗原因
   * （例如 commitment 不存在會比 ZK 驗證失敗快很多）。
   */
  private async equalizeTiming() {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // =============================================
  // Verify ZK. 
  // =============================================
  private async verifyZk(proof: any, publicSignals: any[]): Promise<boolean> {
    try {
      // 讀取你在後端準備好的 verification_key.json
      const vKeyPath = path.join(process.cwd(), 'src/zk/keys/verification_key.json');
      const vKey = JSON.parse(fs.readFileSync(vKeyPath, 'utf-8'));

      // 呼叫 snarkjs 進行驗證
      const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      return res;
    } catch (error) {
      const err = error as any;
      const errorMessage = err?.response?.data?.message || err?.message || "unknown error";
      this.logger.error(`Error: ${errorMessage}`);
      return false;
    }
  }

  // Trigger the finish of election
  // async getTally(electionId: string) {
  //   // 1. 檢查選舉是否已經結束，避免重複統計
  //   const election = await this.prisma.election.findUnique({ where: { id: electionId } });
  //   this.logger.log(`[TALLY INFO]: election ${election}`);
  //   // 2. If already tallied, return the method
  //   if (election?.status == ElectionStatus.FINISHED) {
  //     //throw new BadRequestException('Already tallied this election');
  //     this.logger.log(`[Tally Info] election finished ${election?.status}`);
  //     return { message: 'Already tallied', result: election.finalResult };
  //   }
  //   else if (election?.status == ElectionStatus.TALLIED || election?.status == ElectionStatus.VOTING_CLOSED) {

  //     // 3. Perform Tally
  //     const tallyData = await this.performTally(electionId);
  //     this.logger.log(`[Tally Info] ${tallyData.results}`);
  //     // 4. Write back to the db
  //     const updatedElection = await this.prisma.election.update({
  //       where: { id: electionId },
  //       data: {
  //         status: ElectionStatus.FINISHED,
  //         finalResult: tallyData.results,
  //       },
  //     });

  //     this.logger.log(`[DB Update Result] Status: ${updatedElection.status}`);
  //     // Check if finalResult is empty in the log
  //     this.logger.log(`[DB Update Result] Result: ${JSON.stringify(updatedElection.finalResult)}`);

  //     return { message: 'Tally Finished', result: tallyData.results };
  //   }
  //   else {
  //     throw new BadRequestException('The election has not been finished');
  //   }
  // }

  // // ================================== 
  // // Tally the vote when the elections are finished.
  // // ==================================
  // private async performTally(electionId: string) {
  //   // 1. Select all votes in the same election
  //   this.logger.log(`[Tally Info] PerformTally ${electionId}`);
  //   const votes = await this.prisma.vote.findMany({
  //     where: { electionId },
  //     select: {
  //       voteContent: true,
  //       encryptKey: true,
  //     },
  //   });

  //   const results: Record<string, number> = {};

  //   // 2. Accumulation
  //   for (const vote of votes) {
  //     try {
  //       const bytes = CryptoJS.AES.decrypt(vote.voteContent, vote.encryptKey || '');
  //       const decryptedContent = bytes.toString(CryptoJS.enc.Utf8);

  //       if (decryptedContent) {
  //         results[decryptedContent] = (results[decryptedContent] || 0) + 1;
  //       }

  //     } catch (error) {
  //       const err = error as any;
  //       const errorMessage = err?.response?.data?.message || err?.message || "unknown error";
  //       this.logger.error(`Error: ${errorMessage}`);
  //     }
  //   }

  //   return {
  //     electionId,
  //     totalVotes: votes.length,
  //     results,
  //   };
  // }
}

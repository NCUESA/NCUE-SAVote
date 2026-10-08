import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateElectionDto } from './dto/create-election.dto';
import { UpdateElectionDto } from './dto/update-election.dto';
import * as crypto from 'crypto';
import { ImportEligibleVotersDto } from './dto/import-eligible-voters.dto';
import { CreateEligibleVoterDto } from './dto/create-eligible-voter.dto';
import { Logger } from '@nestjs/common';
import type {
  AdminSummaryResponse,
  Election as SharedElection,
} from '@savote/shared-types';
import { ElectionStatus, ELECTION_RULES, VOTE_RULES } from '@savote/shared-types';

@Injectable()
export class ElectionsService {
  private readonly logger = new Logger(ElectionsService.name);
  constructor(private prisma: PrismaService) { }

  /**
   * Internal check to prevent modification or deletion after an election starts.
   */
  private assertCanModifyElection(election: any) {
    const now = new Date();
    if (election.startTime && now >= new Date(election.startTime)) {
      throw new BadRequestException('Election has already started and cannot be modified or deleted');
    }
  }

  /**
   * Internal check to prevent viewing results before an election ends.
   */
  private assertCanViewResults(election: any) {
    const now = new Date();
    if (!election.endTime || now < new Date(election.endTime)) {
      throw new ForbiddenException('Results are sealed until the election ends');
    }
  }

  async create(dto: CreateElectionDto) {
    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    const newElection = await this.prisma.election.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        config: dto.config,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
        publicKey: publicKey,
        privateKey: privateKey,
      } as any,
    });

    // Omit privateKey before returning to client
    const { privateKey: _, ...safeElection } = newElection;

    return safeElection;
  }
  /**
   * 可以安全地回給客戶端的 Election 欄位。
   *
   * ──────────────────────────────────────────────────────────────────────────
   * 這是本次修正中最嚴重的一個問題。
   *
   * 原本 findAll / findVisibleAll / findOne 都是直接回傳整個 election 資料列，
   * 而 Election 這張表裡存著 `privateKey` —— 也就是開票時用來解密所有選票的
   * RSA 私鑰。這三個端點又都沒有掛任何 Guard。
   *
   * 也就是說：任何人對 GET /api/elections 發一個請求，就能拿到每一場選舉的
   * 解密私鑰。實測確認過，包含正在進行中的那場。
   *
   * 用明確的 select 白名單，而不是「取出來再 delete 掉某個欄位」——
   * 後者只要有人日後新增敏感欄位就會再次外洩，而白名單是預設安全的。
   * ──────────────────────────────────────────────────────────────────────────
   */
  private static readonly PUBLIC_ELECTION_FIELDS = {
    id: true,
    name: true,
    description: true,
    type: true,
    config: true,
    status: true,
    hasDrawLottery: true,
    isVisible: true,
    participantsCount: true,
    eiligibleCount: true,
    startTime: true,
    endTime: true,
    createdAt: true,
    updatedAt: true,
    finalResult: true,
    // publicKey 是給前端加密選票用的，必須回傳
    publicKey: true,
    // privateKey 永遠不回傳
  } as const;

  async findAll() {
    return this.prisma.election.findMany({
      select: ElectionsService.PUBLIC_ELECTION_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findVisibleAll() {
    return this.prisma.election.findMany({
      where: { isVisible: true },
      select: ElectionsService.PUBLIC_ELECTION_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const election = await this.prisma.election.findUnique({
      where: { id },
      select: ElectionsService.PUBLIC_ELECTION_FIELDS,
    });
    if (!election) throw new NotFoundException('Election not found');
    return election;
  }

  /** 內部使用：需要完整資料列（含 privateKey）時走這個，絕不直接回給客戶端 */
  private async findOneInternal(id: string) {
    const election = await this.prisma.election.findUnique({ where: { id } });
    if (!election) throw new NotFoundException('Election not found');
    return election;
  }

  async update(id: string, dto: UpdateElectionDto) {
    const existing = await this.findOne(id);
    this.assertCanModifyElection(existing);
    return this.prisma.election.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        config: dto.config,
        startTime: dto.startTime ? new Date(dto.startTime) : undefined,
        endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      } as any,
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    this.assertCanModifyElection(existing);
    await this.prisma.election.delete({ where: { id } });
    return { success: true };
  }

  async importEligibleVoters(electionId: string, dto: ImportEligibleVotersDto) {
    const election = await this.findOne(electionId);
    this.assertCanModifyElection(election);

    const lines = dto.csv.trim().split(/\r?\n/);

    // 如果 CreateEligibleVoterDto 報錯，請去那個 DTO 檔案裡加上 studentIdHash: string
    const voters: any[] = [];

    for (const line of lines) {
      const [studentId, className] = line.split(',').map((s) => s.trim());
      if (studentId && className) {

        // 在這裡算出 Hash 值
        const studentIdHash = await this.hashStudentId(studentId);

        voters.push({
          studentId,
          class: className,
          electionId,
          studentIdHash // 把算好的 Hash 塞進去
        });
      }
    }

    const created = await this.prisma.eligibleVoter.createMany({
      data: voters,
      skipDuplicates: true,
    });

    return { imported: created.count };
  }

  async listEligibleVoters(electionId: string) {
    return this.prisma.eligibleVoter.findMany({
      where: { electionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async finalizeVoterList(electionId: string) {
    const election = await this.findOne(electionId);
    this.assertCanModifyElection(election);

    const voters = await this.prisma.eligibleVoter.findMany({
      where: { electionId },
      orderBy: { createdAt: 'asc' },
    });

    if (!voters.length) {
      throw new BadRequestException('No eligible voters to finalize');
    }

    // if (!election.merkleRoot) {
    //   throw new BadRequestException(
    //     'merkleRoot must be set before finalizing voter list',
    //   );
    // }

    return {
      success: true,
      totalVoters: voters.length,
    };
  }
  private hashStudentId(studentId: string): string {
    return crypto.createHash('sha256').update(studentId).digest('hex');
  }

  async updateVisibility(id: string, isVisible: boolean) {
    const election = await this.prisma.election.findUnique({ where: { id } });
    if (!election) throw new NotFoundException('Election not found');

    return this.prisma.election.update({
      where: { id },
      data: { isVisible },
    });
  }

  // =======================
  //  Tally Result
  //    Admin Use
  //    - getAdminSummary: Tally the election, trigger by admin
  //    - evaluateElectionRules: Test what the rules should be apply
  //    - toShareElection: Send the election info to the frontend 
  //    Public Use
  //    - getPublicResults: return the election result for public after election is finished
  // =======================
  async getAdminSummary(id: string): Promise<AdminSummaryResponse> {
    // 1. Fetch election with sensitive keys and candidates
    const election = await this.prisma.election.findUnique({
      where: { id },
      include: { candidates: true }
    });

    if (!election || !election.privateKey) {
      throw new NotFoundException('ELECTION_OR_KEY_NOT_FOUND');
    }

    this.assertCanViewResults(election);

    // 2. Fetch all encrypted votes
    const votes = await this.prisma.vote.findMany({
      where: { electionId: id },
      select: { voteContent: true }
    });

    // 3. Get metadata
    const totalVotes = votes.length;
    const totalEligibleVoters = await this.prisma.eligibleVoter.count({
      where: { electionId: id }
    });

    // 4. Decrypt and Tally
    const tallyMap: Record<string, number> = {};
    let blankVotes = 0;    // 廢票
    let invalidVotes = 0;  // 系統攻擊異常票

    // Initialize tally for all candidates
    election.candidates.forEach(c => {
      tallyMap[c.id] = 0;
    });

    votes.forEach((v) => {
      try {
        // Decrypt using the privateKey from database
        const decryptedBuffer = crypto.privateDecrypt(
          {
            key: election.privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
          },
          Buffer.from(v.voteContent, 'base64')
        );

        const candidateId = decryptedBuffer.toString('utf8');
        if (candidateId === VOTE_RULES.BLANK_VOTE) {
          blankVotes++;
        }
        else if (tallyMap[candidateId] !== undefined) {
          tallyMap[candidateId]++;
        } else {
          // Handle invalid or "None of the above" votes if necessary
          invalidVotes++;
          this.logger.warn(`Decrypted invalid candidateId: ${candidateId}`);
        }
      } catch (err) {
        // Check if err is an instance of Error
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to decrypt vote: ${errorMessage}`);
      }
    });

    // 5. Format candidate data for frontend
    const candidateResults = election.candidates.map((c) => ({
      ...c,
      voteCount: tallyMap[c.id] || 0,
    }));

    // 6. Determine the winner
    const validVotes = totalVotes - blankVotes - invalidVotes;

    const ruleEvaluation = this.evaluateElectionRules(
      election.type,
      candidateResults,
      validVotes,
      totalEligibleVoters
    );

    const finalTallyData = {
      tally: tallyMap,
      blankVotes: blankVotes,
      invalidVotes: invalidVotes,
      totalVotes: totalVotes,
      totalEligibleVoters: totalEligibleVoters,
      candidates: ruleEvaluation.candidates,
      result: {
        winners: ruleEvaluation.winners,
        note: ruleEvaluation.note
      }
    };

    await this.prisma.election.update({
      where: { id: id },
      data: {
        status: ElectionStatus.FINISHED,
        finalResult: finalTallyData,
      },
    });

    // 7. return results
    return {
      election: this.toSharedElection(election),
      totalVotes: totalVotes,
      tally: finalTallyData
    };

  }

  private evaluateElectionRules(
    electionType: string,
    candidates: any[],
    validVotes: number,
    totalEligibleVoters: number
  ) {
    // Fetch rule from config, fallback to zero quota if invalid type
    const rule = ELECTION_RULES[electionType] || { quota: 0 };
    const candidateCount = candidates.length;

    let thresholdVotes = 1;

    // 1. Calculate dynamic threshold based on election type
    if (electionType === 'PRESIDENTIAL' && candidateCount <= 1) {
      // Walkover election calculation
      thresholdVotes = Math.ceil(totalEligibleVoters * (rule.walkoverThresholdRate || 0));
    } else if (electionType === 'AT_LARGE_COUNCILOR') {
      // Proportional representation calculation
      thresholdVotes = Math.ceil(validVotes * (rule.thresholdRate || 0));
    }

    // 2. Universal core logic: filter, sort, and slice
    const winners = [...candidates]
      .filter(c => c.voteCount > 0 && c.voteCount >= thresholdVotes)
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, rule.quota);

    // 3. Generate dynamic evaluation notes
    let ruleNote = '';
    if (electionType === 'PRESIDENTIAL' && candidateCount <= 1) {
      const ratePct = (rule.walkoverThresholdRate || 0) * 100;
      if (winners.length > 0) {
        ruleNote = `總投票跨越 ${ratePct}% 門檻 (需達 ${thresholdVotes} 票)`;
      } else {
        ruleNote = `無人跨越 ${ratePct}% 門檻 (需達 ${thresholdVotes} 票)，無人當選`;
      }
    } else if (electionType === 'AT_LARGE_COUNCILOR') {
      const ratePct = (rule.thresholdRate || 0) * 100;
      ruleNote = `取跨越 ${ratePct}% 門檻 (需達 ${thresholdVotes} 票) 之前 ${rule.quota} 名，共 ${winners.length} 人當選`;
    } else {
      // Default fallback for standard plurality voting (e.g., DISTRICT_COUNCILOR)
      ruleNote = winners.length > 0 ? '最高票者當選' : '無人獲得有效票數';
    }

    // 4. Map isElected boolean to all candidates
    const mappedCandidates = candidates.map(c => ({
      ...c,
      isElected: winners.some(w => w.id === c.id)
    }));

    return {
      candidates: mappedCandidates,
      winners: winners,
      note: ruleNote
    };
  }

  private toSharedElection(election: any): SharedElection {
    // Extract privateKey out, keep the rest
    const { privateKey: _, ...safeElection } = election;

    return {
      ...safeElection,
      status: election.status as unknown as ElectionStatus,
      candidates: election.candidates || [],
    } as SharedElection;
  }

  async getPublicResults(id: string) {
    const election = await this.prisma.election.findUnique({
      where: { id },
    });

    if (!election) {
      throw new NotFoundException('找不到該場選舉');
    }

    // Not yet when not finished
    if (election.status !== 'TALLIED' && election.status !== 'FINISHED') {
      throw new ForbiddenException('選舉結果尚未公布，請耐心等候！');
    }

    const cachedData = election.finalResult as any;

    return {
      election: this.toSharedElection(election),
      totalVotes: cachedData?.totalVotes || 0,
      tally: cachedData // 完美對齊你前端的 VoteServiceTally 格式
    };
  }

  // =======================
  //  Lottery
  //    Admin Use
  //    -  
  //    Public Use
  //    - 
  // =======================
  async handleLottery(electionId: string, count: number) {
    const election = await this.prisma.election.findUnique({
      where: {
        id: electionId
      }
    });
    if (!election) throw new NotFoundException('Election not found');
    if (election.status !== 'TALLIED' && election.status !== 'FINISHED') {
      throw new ForbiddenException('選舉尚未結束，請耐心等候！');
    }

    if (election.hasDrawLottery) {
      return this.getLottery(electionId);
    }
    else {
      return this.drawLottery(electionId, count);
    }
  }

  async drawLottery(electionId: string, count: number) {
    // 1. Make sure N is possible
    if (count <= 0) throw new BadRequestException('The lottery number should bigger than 0');

    // 2. Take datas from userVoteKey
    const votedKeys = await this.prisma.userVoteKey.findMany({
      where: {
        electionId: electionId,
        hasVoted: true
      }
    });
    this.logger.log(`[Lottery]: electionID ${electionId}`);
    if (votedKeys.length === 0) {
      throw new BadRequestException('No one vote, can not be draw');
    }

    const votedStudentIds = votedKeys.map(key => key.hashedID);

    // 3. Join to the table eligibleVoter
    const participants = await this.prisma.eligibleVoter.findMany({
      where: {
        studentIdHash: { in: votedStudentIds },
        electionId: electionId
      },
      select: { studentId: true }
    });

    if (count > participants.length) {
      throw new BadRequestException(`Wish have ${count}, but only ${participants.length} qulified`);
    }

    // 3. 洗牌
    //
    // 原本用 Math.random()。那是可預測的偽隨機數（V8 用 xorshift128+），
    // 觀察到足夠輸出就能反推內部狀態並預測後續結果。
    // 這是會發出實體獎品的抽獎，改用 crypto.randomInt 的 CSPRNG。
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 4. 取出前 N 名的學號
    const winners = shuffled.slice(0, count).map(p => p.studentId);

    // 5. Insert to table
    await this.prisma.$transaction(async (tx) => {
      // // 選擇性功能：如果允許「重新抽獎」，就先刪除這場選舉舊的得獎名單
      // await tx.lottery.deleteMany({
      //   where: { electionId: electionId }
      // });

      await tx.lottery.createMany({
        data: winners.map(studentId => ({
          electionId: electionId,
          studentId: studentId,
        }))
      });
    });

    await this.prisma.election.update({
      where: { id: electionId },
      data: {
        hasDrawLottery: true,
        participantsCount: participants.length
      },
    });
    return;
  }

  async getLottery(electionId: string) {
    const election = await this.prisma.election.findFirst({
      where: {
        id: electionId
      }
    });

    const participantsCount = election?.participantsCount;

    const winners = await this.prisma.lottery.findMany({
      where: {
        electionId: electionId
      }
    });

    return {
      electionId,
      totalParticipants: participantsCount,
      drawCount: winners.length,
      winners: winners.map(w => w.studentId),
    };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parse } from 'csv-parse/sync';
import type {
  VoterEligibilityResponse,
  Election as SharedElection,
  ElectionStatus,
  ElectionType,
} from '@savote/shared-types';
import type { Election as PrismaElection } from '@prisma/client';
import * as crypto from 'crypto';

export interface ParsedVoterRecord {
  studentId: string;
  studentIdHash: string;
  class: string;
}

export interface ImportVotersResult {
  votersImported: number;
  duplicatesSkipped: number;
}

@Injectable()
export class VotersService {
  private readonly logger = new Logger(VotersService.name);

  constructor(
    private readonly prisma: PrismaService,
    //private readonly merkleTreeService: MerkleTreeService,
  ) { }

  // ===========================================================================
  // Core Business Logic
  // ===========================================================================

  async registerIdentityCommitment(
    electionId: string,
    studentIdHash: string,
    commitment: string,
  ) {
    // 刻意不記錄 commitment：它可以在資料庫裡對應回 hashedID，
    // 寫進日誌等於把「選民 ↔ 選票識別碼」的對照表複製一份到日誌檔。
    this.logger.log(`Registering identity commitment for election ${electionId}`);

    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) {
      throw new NotFoundException('ELECTION_NOT_FOUND');
    }

    // Registration is only allowed DURING the election
    const now = new Date();
    if (election.endTime && now >= new Date(election.endTime)) {
      throw new BadRequestException('REGISTRATION_CLOSED');
    }
    else if (election.startTime && now <= new Date(election.startTime)) {
      throw new BadRequestException('REGISTRATION_NOT_START');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 檢查選民資格並鎖定 (防止 Concurrent 註冊)
      const voter = await tx.eligibleVoter.findUnique({
        where: {
          studentIdHash_electionId: { studentIdHash, electionId },
        },
      });

      if (!voter) throw new NotFoundException('VOTER_NOT_ELIGIBLE');


      // . 檢查是否已經註冊過金鑰 
      const existingKey = await tx.userVoteKey.findFirst({
        where: {
          electionId,
          hashedID: studentIdHash
        },
      });

      if (existingKey) {
        throw new BadRequestException('ALREADY_REGISTERED');
      }

      // . 寫入：建立匿名票匭
      const newVoteKey = await tx.userVoteKey.create({
        data: {
          electionId: electionId,
          commitment: commitment,
          hasVoted: false,
          hashedID: studentIdHash
        },
      });

      this.logger.log(`Vote key created for election ${electionId}`);
      return { success: true };
    });
  }

  // ===========================================================================
  // Import / Eligibility Logic
  // ===========================================================================

    async parseCsv(buffer: Buffer): Promise<ParsedVoterRecord[]> {

      if (!buffer || !buffer.length) {

        throw new BadRequestException('CSV_FILE_EMPTY');

      }

  

      let rows: Record<string, string>[];

      try {

        rows = parse(buffer, {

          columns: true,

          skip_empty_lines: true,

          bom: true,

          trim: true,

        });

      } catch (error) {

        throw new BadRequestException('INVALID_CSV_FORMAT');

      }

  

      const normalized: ParsedVoterRecord[] = [];

      const dedupe = new Set<string>();

  

      for (const row of rows) {

        const keys = Object.keys(row);

        if (keys.length === 0) continue;

  

        // Always grab the first column, regardless of its header name (e.g. studID, 學號, etc.)

        const rawStudentId = row[keys[0]];

        const studentId = this.normalizeStudentId(rawStudentId);

        const classValue = '-';

  

        if (!studentId) {

          continue;

        }

  

        const key = `${studentId}:${classValue}`;

        if (dedupe.has(key)) {

          continue;

        }

        dedupe.add(key);

        normalized.push({

          studentId,

          studentIdHash: this.hashStudentId(studentId),

          class: classValue,

        });

      }

  

      if (normalized.length === 0) {

        throw new BadRequestException('CSV_NO_VALID_RECORDS');

      }

  

      return normalized;

    }

  async importVoters(
    electionId: string,
    fileBuffer: Buffer,
  ): Promise<ImportVotersResult> {
    this.logger.log(`Importing voters for election: ${electionId}`);
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) {
      throw new NotFoundException('ELECTION_NOT_FOUND');
    }

    const records = await this.parseCsv(fileBuffer);

    const dataToInsert = await Promise.all(
      records.map(async (record) => ({
        electionId,
        studentId: record.studentId,
        studentIdHash: record.studentIdHash,
        class: record.class,
      }))
    );

    const createResult = await this.prisma.eligibleVoter.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    this.logger.log(`Imported ${createResult.count} voters.`);

    return {
      votersImported: createResult.count,
      duplicatesSkipped: records.length - createResult.count,
    };
  }

  // ===========================================================================
  // Eligibility & Key Generation Logic
  // ===========================================================================
  async verifyEligibility(
    electionId: string,
    studentIdHash: string,
    classValue: string,
  ): Promise<any> {
    this.logger.log(`Verifying eligibility for election: ${electionId}`);

    // 1. 取得選舉資訊
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) {
      throw new NotFoundException('ELECTION_NOT_FOUND');
    }

    const sharedElection = this.toSharedElection(election);

    // 2. 檢查是否有投票資格 (在 eligible_voters 表裡尋找)
    const voter = await this.prisma.eligibleVoter.findUnique({
      where: {
        studentIdHash_electionId: {
          electionId: electionId,
          studentIdHash: studentIdHash,
        },
      },
    });

    // 如果找不到，代表沒資格
    if (!voter) {
      return {
        eligible: false,
        election: sharedElection,
        mismatchID: studentIdHash,
        reason: 'NOT_ELIGIBLE',
      };
    }

    const voteKeyRecord = await this.prisma.userVoteKey.findUnique({
      where: {
        hashedID_electionId: {
          hashedID: studentIdHash,
          electionId: electionId,
        },
      },
    });

    if (voteKeyRecord && voteKeyRecord.hasVoted) {
      return {
        eligible: false,
        election: sharedElection,
        mismatchID: studentIdHash,
        reason: 'ALREADY_VOTED',
        hasVoted: true
      }
    }

    // 3. 檢查是否已經註冊過 (看 identityCommitment 有沒有值)
    // 根據我們剛才定好的邏輯，如果有值，就代表前端已經生成過並傳給我們了
    const existingKey = await this.prisma.userVoteKey.findUnique({
      where: {
        hashedID_electionId: {
          hashedID: studentIdHash,
          electionId: electionId
        },
      },
    });

    // 4. 單純回傳狀態給前端，前端會根據 isRegistered 決定要不要跳出「註冊」畫面
    return {
      eligible: true,
      election: sharedElection,
      isRegistered: !!existingKey, // true 或 false
    };
  }

  private normalizeClass(raw: string | undefined): string {
    return raw?.toString().trim().replace(/\s+/g, '_').toUpperCase() || '';
  }

  private normalizeStudentId(raw: string | undefined): string {
    return raw?.toString().trim().toUpperCase() || '';
  }

  private hashStudentId(studentId: string): string {
    return crypto.createHash('sha256').update(studentId).digest('hex');
  }

  private toSharedElection(election: PrismaElection): SharedElection {
    const now = new Date();
    let computedStatus: any = 'DRAFT';

    if (election.startTime && election.endTime) {
      if (now < new Date(election.startTime))
        computedStatus = 'REGISTRATION_OPEN';
      else if (now <= new Date(election.endTime))
        computedStatus = 'VOTING_OPEN';
      else computedStatus = 'VOTING_CLOSED';
    }

    return {
      id: election.id,
      name: election.name,
      status: computedStatus as unknown as ElectionStatus,
      type: election.type as unknown as ElectionType,
      startTime: election.startTime,
      endTime: election.endTime,
      publicKey: election.publicKey,
      isVisible: true,
      //privateKey: null,
      createdAt: election.createdAt,
      updatedAt: election.updatedAt,
      candidates: [],
      
    };
  }
}

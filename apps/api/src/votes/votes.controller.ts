import { Controller, Post, Body, Get, Param, Req, UseGuards } from '@nestjs/common';
import { VotesService } from './votes.service';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('votes')
@Controller('votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) { }

  @Post('submit')
  // 原本這行是註解掉的 —— 任何人都能對這個端點送出選票，不需要登入。
  //
  // 取捨說明：加上 Guard 後伺服器會知道「某個已登入的學生在此刻送出了一張票」，
  // 從時間上多了一條可關聯的線索。但：
  //   (1) 現行設計本來就在 UserVoteKey 同時存著 hashedID 與 commitment，
  //       而且核銷資格與寫入選票在同一個交易，時間關聯早就存在；
  //   (2) 一個會改動選舉狀態、完全不需驗證的公開端點，風險遠大於此。
  // 這裡刻意不取用 req.user，身分只用於通過 Guard，不記錄也不寫入任何地方。
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit a ZK vote' })
  @ApiResponse({ status: 201, description: 'Vote cast successfully' })
  @ApiResponse({ status: 400, description: 'Invalid proof or input' })
  @ApiResponse({ status: 409, description: 'Double voting detected (Handled by Silent Return)' })
  async submitVote(
    @Body() submitVoteDto: SubmitVoteDto
  ) {
    //const userId = req.user.id;

    return await this.votesService.submitVote(submitVoteDto);
  }


  // @Get('/:electionId/tally')
  // @ApiOperation({ summary: 'Get election tally' })
  // getTally(@Param('electionId') electionId: string) {
  //   return this.votesService.getTally(electionId);
  // }


  /*@Get(':electionId/logs')
  @ApiOperation({ summary: 'Get audit logs' })
  getAuditLogs(@Param('electionId') electionId: string) {
    return this.votesService.getAuditLogs(electionId);
  }

  @Get(':electionId/check-nullifier/:nullifier')
  @ApiOperation({ summary: 'Check if a nullifier exists for the election' })
  async checkNullifier(
    @Param('electionId') electionId: string,
    @Param('nullifier') nullifier: string,
  ) {
    return this.votesService.checkNullifier(electionId, nullifier);
  }*/

  // @Get('hello/:electionId')
  // @UseGuards(JwtAuthGuard) // 必須登入
  // async serverHello(@Req() req: any, @Param('electionId') electionId: string) {
  //   const userId = req.user.id; // 從 JWT 拿到 userId

  //   // 呼叫 Service 執行邏輯
  //   //return this.votesService.getVoterCredential(userId, electionId);
  // }
}

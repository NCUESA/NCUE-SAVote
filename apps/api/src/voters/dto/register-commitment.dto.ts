import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class RegisterCommitmentDto {
  @IsUUID()
  electionId!: string;

  // commitment = Poseidon(studentIdHash, secret)，是 BN254 純量體中的元素，
  // 一定是十進位數字字串。原本只檢查長度，任何 32~128 字元的字串都收。
  @IsString()
  @Length(1, 78)
  @Matches(/^[0-9]+$/, { message: 'commitment 必須是十進位數字字串' })
  commitment!: string;
}

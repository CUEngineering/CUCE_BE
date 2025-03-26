import { IsEmail, IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class InviteStudentDto {
  @IsString()
  @IsNotEmpty()
  reg_number: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumber()
  @IsNotEmpty()
  program_id: number;
}

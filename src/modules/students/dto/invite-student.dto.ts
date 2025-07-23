import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

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

import { IsUUID } from 'class-validator';

export class AcceptStudentInviteDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsString()
  reg_number: string;

  @IsUUID()
  token: string;
}

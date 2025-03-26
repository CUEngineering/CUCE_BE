import { IsEmail, IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  profile_picture?: string;

  @IsNumber()
  @IsOptional()
  program_id?: number;
}

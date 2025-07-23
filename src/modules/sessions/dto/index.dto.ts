import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  session_name: string;

  @IsString()
  start_date: string;

  @IsString()
  end_date: string;

  @IsString()
  enrollment_deadline: string;

  @IsString()
  session_status: string;
}

export class CreateSessionWithStudentsDto {
  @ValidateNested()
  @Type(() => CreateSessionDto)
  @IsNotEmpty()
  data: CreateSessionDto;

  @IsArray()
  studentIds: number[];
}

export class UpdateSessionDto extends PartialType(CreateSessionDto) {}

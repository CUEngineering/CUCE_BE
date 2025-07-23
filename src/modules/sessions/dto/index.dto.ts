import { PartialType } from '@nestjs/mapped-types';

import { IsString } from 'class-validator';

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

export class UpdateSessionDto extends PartialType(CreateSessionDto) {}

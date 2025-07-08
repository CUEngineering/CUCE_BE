import { PartialType } from '@nestjs/mapped-types';

export class CreateSessionDto {
  session_name: string;
  start_date: string; // ISO format
  end_date: string;
  enrollment_deadline: string;
  session_status: string;
}

export class UpdateSessionDto extends PartialType(CreateSessionDto) {}

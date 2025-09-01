// dto/update-enrollment.dto.ts
import { EnrollmentStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateEnrollmentDto {
  @IsIn([EnrollmentStatus.APPROVED, EnrollmentStatus.REJECTED])
  enrollment_status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsBoolean()
  special_request?: boolean;

  @ValidateIf((o) => o.enrollment_status === EnrollmentStatus.REJECTED)
  @IsString()
  rejection_reason?: string;
}

export class CreateEnrollmentDto {
  @IsEnum(EnrollmentStatus)
  enrollment_status: EnrollmentStatus;

  @IsOptional()
  @IsBoolean()
  special_request?: boolean;

  @IsOptional()
  rejection_reason?: string;

  @IsInt()
  student_id: number;

  @IsInt()
  course_id: number;

  @IsInt()
  session_id: number;
}

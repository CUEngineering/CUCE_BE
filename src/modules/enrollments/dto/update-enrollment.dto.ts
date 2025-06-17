// dto/update-enrollment.dto.ts
import { EnrollmentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  enrollment_status?: EnrollmentStatus;

  @IsOptional()
  @IsBoolean()
  special_request?: boolean;

  @IsOptional()
  @IsString()
  rejection_reason?: string;

  @IsOptional()
  @IsInt()
  registrar_id?: number;

  @IsOptional()
  @IsInt()
  admin_id?: number;
}

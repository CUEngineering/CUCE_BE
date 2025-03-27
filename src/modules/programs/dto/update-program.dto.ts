import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProgramType } from './create-program.dto';

export class UpdateProgramDto {
  @IsString()
  @IsOptional()
  program_name?: string;

  @IsEnum(ProgramType)
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  })
  program_type?: ProgramType;

  @IsInt()
  @Min(1)
  @IsOptional()
  total_credits?: number;
}

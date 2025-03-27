import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

// Define ProgramType enum here since we can't import it directly
export enum ProgramType {
  UNDERGRADUATE = 'UNDERGRADUATE',
  GRADUATE = 'GRADUATE',
  MASTERS = 'MASTERS',
  DOCTORATE = 'DOCTORATE',
}

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  program_name: string;

  @IsEnum(ProgramType)
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  })
  program_type: ProgramType;

  @IsInt()
  @Min(1)
  total_credits: number;
}

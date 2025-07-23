import { ProgramType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class AddCoursesToProgramDto {
  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty({ each: true })
  @Type(() => Number)
  courses: number[];
}
export class CreateProgramWithCoursesDto {
  @IsString()
  @IsNotEmpty()
  program_name: string;

  @IsEnum(ProgramType)
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  program_type: ProgramType;

  @IsInt()
  @Min(1)
  total_credits: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  course_ids: number[]; // array of course IDs to be attached
}

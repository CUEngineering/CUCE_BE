import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

// Define CourseType enum here since we can't import it directly
export enum CourseType {
  UNDERGRADUATE = 'UNDERGRADUATE',
  GRADUATE = 'GRADUATE',
  MASTERS = 'MASTERS',
  DOCTORATE = 'DOCTORATE',
}

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  course_title: string;

  @IsString()
  @IsNotEmpty()
  course_code: string;

  @IsInt()
  @Min(1)
  course_credits: number;

  @IsEnum(CourseType)
  @Transform(({ value }) => value?.toUpperCase())
  course_type: CourseType;

  // @IsString()
  // @IsNotEmpty()
  // course_desc: string;
}

import { IsArray, IsNotEmpty, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCoursesToProgramDto {
  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty({ each: true })
  @Type(() => Number)
  courses: number[];
}

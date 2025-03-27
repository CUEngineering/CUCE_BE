import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCoursesToProgramDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Type(() => String)
  courseIds: string[];
}

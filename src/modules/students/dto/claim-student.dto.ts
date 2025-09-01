import { Type } from 'class-transformer';
import { IsNumberString } from 'class-validator';

export class ClaimStudentDto {
  @IsNumberString(undefined, {
    message: 'Registrar is invalid',
  })
  @Type(() => String)
  registrar_id: string;
}

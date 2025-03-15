import { IsEmail, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class EmailDto {
  @IsEmail()
  email: string;
}

export class InviteRegistrarDto {
  @IsEmail()
  email: string;
}

export class InviteMultipleRegistrarsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailDto)
  emails: EmailDto[];
}

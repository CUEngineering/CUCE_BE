import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateRegistrarDto {
  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  profile_picture?: string;
}

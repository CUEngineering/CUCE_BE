import { PartialType } from '@nestjs/mapped-types';
import { CreateRegistrarDto } from './create-registrar.dto';

export class UpdateRegistrarDto extends PartialType(CreateRegistrarDto) {}

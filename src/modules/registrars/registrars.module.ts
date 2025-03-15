import { Module } from '@nestjs/common';
import { RegistrarsController } from './controllers/registrars.controller';
import { RegistrarsService } from './services/registrars.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RegistrarsController],
  providers: [RegistrarsService],
  exports: [RegistrarsService],
})
export class RegistrarsModule {}

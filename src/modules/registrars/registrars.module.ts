import { Module } from '@nestjs/common';
import { RegistrarsController } from './controllers/registrars.controller';
import { RegistrarsService } from './services/registrars.service';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [SupabaseModule],
  controllers: [RegistrarsController],
  providers: [
    RegistrarsService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [RegistrarsService],
})
export class RegistrarsModule {}

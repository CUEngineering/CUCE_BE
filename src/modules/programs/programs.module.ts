import { Module } from '@nestjs/common';
import { ProgramService } from './services/program.service';
import { ProgramController } from './controllers/program.controller';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [SupabaseModule],
  controllers: [ProgramController],
  providers: [
    ProgramService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [ProgramService],
})
export class ProgramsModule {}

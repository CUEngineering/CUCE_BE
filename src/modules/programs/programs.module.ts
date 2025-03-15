import { Module } from '@nestjs/common';
import { ProgramController } from './controllers/program.controller';
import { ProgramService } from './services/program.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [ProgramController],
  providers: [ProgramService],
  exports: [ProgramService],
})
export class ProgramsModule {}

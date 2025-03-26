import { Module } from '@nestjs/common';
import { StudentsController } from './controllers/students.controller';
import { StudentsService } from './services/students.service';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [SupabaseModule],
  controllers: [StudentsController],
  providers: [
    StudentsService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [StudentsService],
})
export class StudentsModule {}

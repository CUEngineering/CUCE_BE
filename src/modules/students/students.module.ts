import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SupabaseModule } from '../../supabase/supabase.module';
import { CoursesModule } from '../courses/courses.module';
import { StudentsController } from './controllers/students.controller';
import { StudentsService } from './services/students.service';

@Module({
  imports: [SupabaseModule, CoursesModule],
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

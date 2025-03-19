import { Module } from '@nestjs/common';
import { CourseService } from './services/course.service';
import { CourseController } from './controllers/course.controller';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [SupabaseModule],
  controllers: [CourseController],
  providers: [
    CourseService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [CourseService],
})
export class CoursesModule {}

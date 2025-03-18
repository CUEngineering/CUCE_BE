import { Injectable } from '@nestjs/common';
import { CreateCourseDto } from '../dto/create-course.dto';
import { SupabaseService } from '../../../supabase/supabase.service';

@Injectable()
export class CourseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createCourseDto: CreateCourseDto, accessToken: string) {
    return this.supabaseService.insert(accessToken, 'courses', createCourseDto);
  }

  async findAll(accessToken: string) {
    return this.supabaseService.select(accessToken, 'courses', {});
  }

  async findOne(id: string, accessToken: string) {
    return this.supabaseService.select(accessToken, 'courses', {
      filter: { course_id: id },
    });
  }
}

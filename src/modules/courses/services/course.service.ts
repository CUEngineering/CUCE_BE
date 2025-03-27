import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { SupabaseService } from '../../../supabase/supabase.service';
import { CourseType } from '../dto/create-course.dto';

@Injectable()
export class CourseService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private getDefaultCapacity(courseType: CourseType): number {
    switch (courseType) {
      case CourseType.UNDERGRADUATE:
        return 4;
      case CourseType.GRADUATE:
        return 3;
      case CourseType.MASTERS:
        return 2;
      case CourseType.DOCTORATE:
        return 1;
      default:
        return 4; // Default fallback
    }
  }

  async create(createCourseDto: CreateCourseDto, accessToken: string) {
    const defaultCapacity = this.getDefaultCapacity(
      createCourseDto.course_type,
    );

    const courseData = {
      course_title: createCourseDto.course_title,
      course_code: createCourseDto.course_code,
      course_credits: createCourseDto.course_credits,
      course_type: createCourseDto.course_type,
      default_capacity: defaultCapacity,
    };
    return this.supabaseService.insert(accessToken, 'courses', courseData);
  }

  async findAll(accessToken: string) {
    return this.supabaseService.select(accessToken, 'courses', {});
  }

  async findOne(id: string, accessToken: string) {
    const result = await this.supabaseService.select(accessToken, 'courses', {
      filter: { course_id: id },
    });

    if (!result || result.length === 0) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return result[0];
  }

  async update(
    id: string,
    updateCourseDto: UpdateCourseDto,
    accessToken: string,
  ) {
    // First check if course exists
    await this.findOne(id, accessToken);

    const updateData: any = {
      ...updateCourseDto,
    };

    // If course_type is being updated, recalculate default_capacity
    if (updateCourseDto.course_type) {
      updateData.default_capacity = this.getDefaultCapacity(
        updateCourseDto.course_type,
      );
    }

    return this.supabaseService.update(
      accessToken,
      'courses',
      { course_id: id },
      updateData,
    );
  }
}

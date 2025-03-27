import { Injectable, Req, NotFoundException } from '@nestjs/common';
import { CreateProgramDto } from '../dto/create-program.dto';
import { AddCoursesToProgramDto } from '../dto/add-courses-to-program.dto';
import { SupabaseService } from '../../../supabase/supabase.service';

@Injectable()
export class ProgramService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createProgramDto: CreateProgramDto, accessToken: string) {
    return this.supabaseService.insert(
      accessToken,
      'programs',
      createProgramDto,
    );
  }

  async findAll(accessToken: string) {
    return this.supabaseService.select(accessToken, 'programs', {});
  }

  async findOne(id: string, accessToken: string) {
    const result = await this.supabaseService.select(accessToken, 'programs', {
      filter: { program_id: id },
    });

    if (!result || result.length === 0) {
      throw new NotFoundException(`Program with ID ${id} not found`);
    }

    return result[0];
  }

  async getProgramCourses(id: string, accessToken: string) {
    return this.supabaseService.select(accessToken, 'program_courses', {
      filter: { program_id: id },
    });
  }

  async getProgramStudents(id: string, accessToken: string) {
    return this.supabaseService.select(accessToken, 'students', {
      filter: { program_id: id },
    });
  }

  async addCourses(
    programId: string,
    addCoursesDto: AddCoursesToProgramDto,
    accessToken: string,
  ) {
    // First check if program exists
    await this.findOne(programId, accessToken);

    // Create program_courses entries for each course
    const programCourses = addCoursesDto.courseIds.map((courseId) => ({
      program_id: programId,
      course_id: courseId,
    }));

    return this.supabaseService.insert(
      accessToken,
      'program_courses',
      programCourses,
    );
  }

  async removeCourse(programId: string, courseId: string, accessToken: string) {
    // First check if program exists
    await this.findOne(programId, accessToken);

    // Delete the program_course entry
    return this.supabaseService.delete(accessToken, 'program_courses', {
      program_id: programId,
      course_id: courseId,
    });
  }
}

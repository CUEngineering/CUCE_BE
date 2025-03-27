import {
  Injectable,
  Req,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateProgramDto } from '../dto/create-program.dto';
import { AddCoursesToProgramDto } from '../dto/add-courses-to-program.dto';
import { UpdateProgramDto } from '../dto/update-program.dto';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  ProgramCourse,
  ProgramCourseWithEnrollmentStatus,
  Student,
  RawProgramCourse,
  StudentWithDetails,
  ProgramStudent,
  ProgramWithStudentCount,
} from '../types/program.types';

@Injectable()
export class ProgramService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createProgramDto: CreateProgramDto, accessToken: string) {
    const programData = {
      ...createProgramDto,
      updated_at: new Date().toISOString(),
    };
    return this.supabaseService.insert(accessToken, 'programs', programData);
  }

  async findAll(accessToken: string): Promise<ProgramWithStudentCount[]> {
    try {
      // Get all programs
      const result = await this.supabaseService.select(
        accessToken,
        'programs',
        {},
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      const programs = result as unknown as ProgramWithStudentCount[];

      // Get student counts for all programs
      const programsWithCounts = await Promise.all(
        programs.map(async (program) => {
          const students = await this.supabaseService.select(
            accessToken,
            'students',
            {
              filter: { program_id: program.program_id },
            },
          );

          return {
            ...program,
            total_students:
              students && Array.isArray(students) ? students.length : 0,
          };
        }),
      );

      return programsWithCounts;
    } catch (error) {
      throw new InternalServerErrorException('Failed to get programs');
    }
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

  async update(
    id: string,
    updateProgramDto: UpdateProgramDto,
    accessToken: string,
  ) {
    // First check if program exists
    await this.findOne(id, accessToken);

    const programData = {
      ...updateProgramDto,
      updated_at: new Date().toISOString(),
    };

    return this.supabaseService.update(
      accessToken,
      'programs',
      { program_id: id },
      programData,
    );
  }

  private async checkCourseHasEnrollments(
    programId: string,
    courseId: number,
    accessToken: string,
  ): Promise<boolean> {
    try {
      // Get all students in this program
      const result = await this.supabaseService.select(
        accessToken,
        'students',
        {
          filter: { program_id: programId },
        },
      );

      if (!result || !Array.isArray(result)) {
        return false;
      }

      const students = result as unknown as Student[];

      if (students.length === 0) {
        return false;
      }

      // Get student IDs from this program
      const studentIds = students.map((student) => student.student_id);

      // Check if any student from this program is enrolled in this course
      const enrollments = await this.supabaseService.select(
        accessToken,
        'enrollments',
        {
          filter: {
            course_id: courseId,
            student_id: studentIds,
          },
          limit: 1,
        },
      );

      return enrollments && enrollments.length > 0;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to check course enrollments',
      );
    }
  }

  async getProgramCourses(
    id: string,
    accessToken: string,
  ): Promise<ProgramCourseWithEnrollmentStatus[]> {
    try {
      // First check if program exists
      const programResult = await this.supabaseService.select(
        accessToken,
        'programs',
        {
          filter: { program_id: id },
        },
      );

      if (!programResult || programResult.length === 0) {
        throw new NotFoundException(`Program with ID ${id} not found`);
      }

      const result = await this.supabaseService.select(
        accessToken,
        'program_courses',
        {
          filter: { program_id: id },
        },
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      // Ensure course_id is a number
      const programCourses = (result as unknown as RawProgramCourse[]).map(
        (item) => ({
          program_id: item.program_id,
          course_id: Number(item.course_id),
          updated_at: item.updated_at || new Date().toISOString(),
        }),
      ) as ProgramCourse[];

      // Add hasEnrollments flag to each course
      const coursesWithEnrollmentStatus = await Promise.all(
        programCourses.map(async (pc) => {
          try {
            const hasEnrollments = await this.checkCourseHasEnrollments(
              id,
              pc.course_id,
              accessToken,
            );
            return {
              ...pc,
              hasEnrollments,
            };
          } catch (error) {
            // If we can't check enrollments for a course, mark it as having enrollments to be safe
            return {
              ...pc,
              hasEnrollments: true,
            };
          }
        }),
      );

      return coursesWithEnrollmentStatus;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get program courses');
    }
  }

  async getProgramStudents(
    id: string,
    accessToken: string,
  ): Promise<ProgramStudent[]> {
    try {
      // First check if program exists
      const programResult = await this.supabaseService.select(
        accessToken,
        'programs',
        {
          filter: { program_id: id },
        },
      );

      if (!programResult || programResult.length === 0) {
        throw new NotFoundException(`Program with ID ${id} not found`);
      }

      // Get all students in this program with their enrollments and course data
      const result = await this.supabaseService.select(
        accessToken,
        'students',
        {
          filter: { program_id: id },
          columns: `
            student_id,
            reg_number,
            first_name,
            last_name,
            email,
            profile_picture,
            enrollments(
              enrollment_status,
              course:courses(
                course_credits
              )
            )
          `,
        },
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      // Calculate total credits for each student
      return (result as unknown as StudentWithDetails[]).map((student) => {
        const enrollments = student.enrollments || [];
        const totalCredits = enrollments
          .filter(
            (e) =>
              e.enrollment_status === 'APPROVED' ||
              e.enrollment_status === 'ACTIVE' ||
              e.enrollment_status === 'COMPLETED',
          )
          .reduce(
            (acc, enrollment) => acc + enrollment.course.course_credits,
            0,
          );

        return {
          student_id: student.student_id,
          reg_number: student.reg_number,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          profile_picture: student.profile_picture,
          totalCredits,
        };
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to get program students');
    }
  }

  async addCourses(
    programId: string,
    addCoursesDto: AddCoursesToProgramDto,
    accessToken: string,
  ) {
    // First check if program exists
    await this.findOne(programId, accessToken);

    const currentTimestamp = new Date().toISOString();

    // Create program_courses entries for each course
    const programCourses = addCoursesDto.courses.map((courseId) => ({
      program_id: programId,
      course_id: courseId,
      updated_at: currentTimestamp,
    }));

    return this.supabaseService.insert(
      accessToken,
      'program_courses',
      programCourses,
    );
  }

  async removeCourse(programId: string, courseId: number, accessToken: string) {
    // First check if program exists
    await this.findOne(programId, accessToken);

    // Check if course has enrollments from students in this program
    const hasEnrollments = await this.checkCourseHasEnrollments(
      programId,
      courseId,
      accessToken,
    );
    if (hasEnrollments) {
      throw new BadRequestException(
        `Cannot remove course ${courseId} from program ${programId} because it has existing enrollments from students in this program`,
      );
    }

    // Delete the program_course entry
    return this.supabaseService.delete(accessToken, 'program_courses', {
      program_id: programId,
      course_id: courseId,
    });
  }

  async delete(id: string, accessToken: string) {
    // First check if program exists
    await this.findOne(id, accessToken);

    // Check if program has any students
    const students = await this.supabaseService.select(
      accessToken,
      'students',
      {
        filter: { program_id: id },
      },
    );

    if (students && Array.isArray(students) && students.length > 0) {
      throw new BadRequestException(
        `Cannot delete program ${id} because it has ${students.length} enrolled students`,
      );
    }

    // Delete the program
    return this.supabaseService.delete(accessToken, 'programs', {
      program_id: id,
    });
  }
}

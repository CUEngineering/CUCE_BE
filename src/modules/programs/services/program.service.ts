import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  AddCoursesToProgramDto,
  CreateProgramWithCoursesDto,
} from '../dto/add-courses-to-program.dto';
import { CreateProgramDto } from '../dto/create-program.dto';
import { UpdateProgramDto } from '../dto/update-program.dto';
import {
  ProgramCourse,
  ProgramCourseWithEnrollmentStatus,
  ProgramStudent,
  ProgramWithStudentCount,
  RawProgramCourse,
  Student,
  StudentWithDetails,
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

  // v1
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
  // v2
  async getAllProgramsWithStats(accessToken: string) {
    try {
      const programs = await this.supabaseService.select(
        accessToken,
        'programs',
        {
          columns: `
          program_id,
          program_name,
          program_type,
          total_credits,
          created_at,
          updated_at,
          program_courses(program_id),
          students(program_id)
        `,
          orderBy: {
            column: 'created_at',
            ascending: false,
          },
        },
      );

      return programs.map((p: any) => {
        return {
          programId: p.program_id,
          programName: p.program_name,
          programType: p.program_type,
          totalCredits: p.total_credits,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          numberOfCourses: p.program_courses?.length || 0,
          numberOfStudents: p.students?.length || 0,
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to retrieve programs: ${error.message}`,
      );
    }
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

      // Get course details and enrollment information
      const coursesWithDetails = await Promise.all(
        programCourses.map(async (pc) => {
          try {
            // Fetch course details
            const courseDetails = await this.supabaseService.select(
              accessToken,
              'courses',
              {
                columns: 'course_id, course_title, course_code, course_credits',
                filter: { course_id: pc.course_id },
              },
            );

            if (!courseDetails || courseDetails.length === 0) {
              // If course not found, return basic info with defaults
              return {
                ...pc,
                course_title: 'Unknown Course',
                course_code: 'N/A',
                course_credits: 0,
                hasEnrollments: false,
                total_enrollments: 0,
              };
            }

            const course = courseDetails[0] as any;

            const hasEnrollments = await this.checkCourseHasEnrollments(
              id,
              pc.course_id,
              accessToken,
            );

            // Get total enrollments for active/approved/completed statuses
            const students = await this.supabaseService.select(
              accessToken,
              'students',
              {
                filter: { program_id: id },
              },
            );

            let totalEnrollments = 0;

            if (students && Array.isArray(students)) {
              const studentIds = (students as unknown as Student[]).map(
                (student) => student.student_id,
              );

              const enrollments = await this.supabaseService.select(
                accessToken,
                'enrollments',
                {
                  filter: {
                    course_id: pc.course_id,
                    student_id: studentIds,
                    enrollment_status: ['APPROVED', 'ACTIVE', 'COMPLETED'],
                  },
                },
              );

              totalEnrollments =
                enrollments && Array.isArray(enrollments)
                  ? enrollments.length
                  : 0;
            }

            return {
              ...pc,
              course_title: course.course_title,
              course_code: course.course_code,
              course_credits: course.course_credits,
              hasEnrollments,
              total_enrollments: totalEnrollments,
            };
          } catch (error) {
            // If we can't fetch course details or check enrollments, return safe defaults
            return {
              ...pc,
              course_title: 'Error Loading Course',
              course_code: 'ERROR',
              course_credits: 0,
              hasEnrollments: true,
              total_enrollments: 0,
            };
          }
        }),
      );

      return coursesWithDetails;
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

  async createWithCourses(
    dto: CreateProgramWithCoursesDto,
    accessToken: string,
  ) {
    try {
      const { course_ids, ...programFields } = dto;

      const programData = {
        ...programFields,
        updated_at: new Date().toISOString(),
      };

      // Insert program and get the inserted ID
      const programInsert = await this.supabaseService.insert(
        accessToken,
        'programs',
        programData,
      );
      const program = programInsert?.[0];
      if (!program) {
        throw new Error('Program creation failed');
      }

      const programCourses = course_ids.map((course_id) => ({
        program_id: program.program_id,
        course_id,
        updated_at: new Date().toISOString(),
      }));

      // Insert into program_courses
      await this.supabaseService.insert(
        accessToken,
        'program_courses',
        programCourses,
      );

      return {
        message: 'Program and course links created successfully',
        program,
        course_ids,
      };
    } catch (error) {
      console.error('Error creating program with courses:', error);
    }
  }
}

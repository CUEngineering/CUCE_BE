import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProgramDto } from '../dto/create-program.dto';

@Injectable()
export class ProgramService {
  constructor(private prisma: PrismaService) {}

  async create(createProgramDto: CreateProgramDto) {
    return this.prisma.program.create({
      data: createProgramDto,
    });
  }

  async findAll() {
    return this.prisma.program.findMany();
  }

  async findOne(id: string) {
    return this.prisma.program.findUnique({
      where: { program_id: id },
    });
  }

  async getProgramCourses(programId: string) {
    const programCourses = await this.prisma.programCourse.findMany({
      where: { program_id: programId },
      include: {
        course: true,
      },
    });

    const coursesWithEnrollmentCount = await Promise.all(
      programCourses.map(async (pc) => {
        const enrollmentCount = await this.prisma.enrollment.count({
          where: { course_id: pc.course_id },
        });

        return {
          course_id: pc.course.course_id,
          course_title: pc.course.course_title,
          course_code: pc.course.course_code,
          course_credits: pc.course.course_credits,
          enrolled_students_count: enrollmentCount,
        };
      }),
    );

    return coursesWithEnrollmentCount;
  }

  async getProgramStudents(programId: string) {
    const students = await this.prisma.student.findMany({
      where: { program_id: programId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
      },
    });

    const studentsWithCompletedCredits = await Promise.all(
      students.map(async (student) => {
        // Get all completed enrollments for student
        const completedEnrollments = await this.prisma.enrollment.findMany({
          where: {
            student_id: student.id,
            enrollment_status: 'APPROVED',
          },
          include: {
            course: true,
          },
        });

        // Sum up all course credits
        const completedCredits = completedEnrollments.reduce(
          (sum, enrollment) => sum + enrollment.course.course_credits,
          0,
        );

        return {
          ...student,
          completed_credits: completedCredits,
        };
      }),
    );

    return studentsWithCompletedCredits;
  }
}

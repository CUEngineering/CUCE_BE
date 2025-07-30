import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  CreateEnrollmentDto,
  UpdateEnrollmentDto,
} from '../dto/update-enrollment.dto';
import { Enrollment } from '../types/enrollment.types';

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Create a new enrollment request
   */
  async createEnrollment(
    studentId: number,
    courseId: number,
    sessionId: number,
    isSpecialRequest = false,
  ) {
    try {
      // Check if student already has a non-rejected enrollment for this course in this session
      const existingEnrollment = await this.prisma.enrollments.findFirst({
        where: {
          student_id: studentId,
          course_id: courseId,
          session_id: sessionId,
          enrollment_status: {
            notIn: ['REJECTED'],
          },
        },
      });

      if (existingEnrollment) {
        throw new BadRequestException(
          `You already have an active enrollment for this course with status: ${existingEnrollment.enrollment_status}`,
        );
      }

      // Check if session is active and enrollment deadline hasn't passed
      const session = await this.prisma.sessions.findUnique({
        where: { session_id: sessionId },
      });

      if (!session) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }

      if (session.session_status !== 'ACTIVE') {
        throw new BadRequestException(
          'Enrollment is only allowed for active sessions',
        );
      }

      if (new Date() > new Date(session.enrollment_deadline)) {
        throw new BadRequestException(
          'Enrollment deadline has passed for this session',
        );
      }

      // Check if course exists and is open for enrollment
      const sessionCourse = await this.prisma.session_courses.findUnique({
        where: {
          session_id_course_id: {
            session_id: sessionId,
            course_id: courseId,
          },
        },
      });

      if (!sessionCourse) {
        throw new NotFoundException(
          `Course with ID ${courseId} is not available for this session`,
        );
      }

      if (sessionCourse.status !== 'OPEN' && !isSpecialRequest) {
        throw new BadRequestException(
          'This course is closed for enrollment. You can submit a special request if needed.',
        );
      }

      // Create enrollment with PENDING status
      const enrollment = await this.prisma.enrollments.create({
        data: {
          student_id: studentId,
          course_id: courseId,
          session_id: sessionId,
          enrollment_status: 'PENDING',
          special_request: isSpecialRequest,
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        message: isSpecialRequest
          ? 'Special enrollment request submitted successfully'
          : 'Enrollment request submitted successfully',
        enrollment,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to create enrollment: ${error.message}`,
        );
      }

      throw new InternalServerErrorException(
        'An unknown error occurred while creating enrollment',
      );
    }
  }

  /**
   * Approve an enrollment
   */
  async approveEnrollment(enrollmentId: number, registrarId: number) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
      });

      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollmentId} not found`,
        );
      }

      if (enrollment.enrollment_status !== 'PENDING') {
        throw new BadRequestException(
          `Cannot approve enrollment with status ${enrollment.enrollment_status}`,
        );
      }

      // Check if registrar is already assigned to this student for this session
      const existingAssignment = await this.prisma.enrollments.findFirst({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          registrar_id: { not: null },
        },
      });

      // If registrar is already assigned but different from current one, prevent approval
      if (
        existingAssignment &&
        existingAssignment.registrar_id !== registrarId
      ) {
        throw new ForbiddenException(
          `Another registrar is already assigned to this student for this session`,
        );
      }

      // Update enrollment to APPROVED status and assign registrar
      const updatedEnrollment = await this.prisma.enrollments.update({
        where: { enrollment_id: enrollmentId },
        data: {
          enrollment_status: 'APPROVED',
          registrar_id: registrarId,
        },
      });

      // Also assign this registrar to all other pending enrollments from this student in this session
      await this.prisma.enrollments.updateMany({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          enrollment_status: 'PENDING',
          registrar_id: null,
        },
        data: {
          registrar_id: registrarId,
        },
      });

      return {
        success: true,
        message: 'Enrollment approved successfully',
        enrollment: updatedEnrollment,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to approve enrollment: ${error.message}`,
        );
      }

      throw new InternalServerErrorException(
        'An unknown error occurred while approving enrollment',
      );
    }
  }

  /**
   * Reject an enrollment with a reason
   */
  async rejectEnrollment(
    enrollmentId: number,
    registrarId: number,
    rejectionReason: string,
  ) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
      });

      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollmentId} not found`,
        );
      }

      if (enrollment.enrollment_status !== 'PENDING') {
        throw new BadRequestException(
          `Cannot reject enrollment with status ${enrollment.enrollment_status}`,
        );
      }

      // Check if registrar is already assigned to this student for this session
      const existingAssignment = await this.prisma.enrollments.findFirst({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          registrar_id: { not: null },
        },
      });

      // If registrar is already assigned but different from current one, prevent rejection
      if (
        existingAssignment &&
        existingAssignment.registrar_id !== registrarId
      ) {
        throw new ForbiddenException(
          `Another registrar is already assigned to this student for this session`,
        );
      }

      if (!rejectionReason) {
        throw new BadRequestException('Rejection reason is required');
      }

      // Update enrollment to REJECTED status, assign registrar, and add rejection reason
      const updatedEnrollment = await this.prisma.enrollments.update({
        where: { enrollment_id: enrollmentId },
        data: {
          enrollment_status: 'REJECTED',
          registrar_id: registrarId,
          rejection_reason: rejectionReason,
        },
      });

      // Also assign this registrar to all other pending enrollments from this student in this session
      await this.prisma.enrollments.updateMany({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          enrollment_status: 'PENDING',
          registrar_id: null,
        },
        data: {
          registrar_id: registrarId,
        },
      });

      return {
        success: true,
        message: 'Enrollment rejected successfully',
        enrollment: updatedEnrollment,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to reject enrollment: ${error.message}`,
        );
      }

      throw new InternalServerErrorException(
        'An unknown error occurred while rejecting enrollment',
      );
    }
  }

  /**
   * Cancel an enrollment
   */
  async cancelEnrollment(
    enrollmentId: number,
    userId: string,
    isAdmin = false,
  ) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
        include: { students: true },
      });

      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollmentId} not found`,
        );
      }

      // Check if enrollment is in a terminal state
      if (
        ['REJECTED', 'COMPLETED', 'CANCELLED'].includes(
          enrollment.enrollment_status,
        )
      ) {
        throw new BadRequestException(
          `Cannot cancel enrollment with status ${enrollment.enrollment_status}`,
        );
      }

      // If not admin, verify this is the student's own enrollment
      if (!isAdmin && enrollment.students.user_id !== userId) {
        throw new ForbiddenException(
          'You do not have permission to cancel this enrollment',
        );
      }

      // Update enrollment to CANCELLED status
      const updatedEnrollment = await this.prisma.enrollments.update({
        where: { enrollment_id: enrollmentId },
        data: {
          enrollment_status: 'CANCELLED',
        },
      });

      return {
        success: true,
        message: 'Enrollment cancelled successfully',
        enrollment: updatedEnrollment,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to cancel enrollment: ${error.message}`,
        );
      }

      throw new InternalServerErrorException(
        'An unknown error occurred while cancelling enrollment',
      );
    }
  }

  /**
   * Automatically transition enrollments when session status changes
   */
  async updateEnrollmentsForSessionChange(
    sessionId: number,
    newSessionStatus: string,
  ) {
    try {
      if (newSessionStatus === 'ACTIVE') {
        // When session becomes active, change all APPROVED enrollments to ACTIVE
        await this.prisma.enrollments.updateMany({
          where: {
            session_id: sessionId,
            enrollment_status: 'APPROVED',
          },
          data: {
            enrollment_status: 'ACTIVE',
          },
        });
      } else if (newSessionStatus === 'CLOSED') {
        // When session is closed, change all ACTIVE enrollments to COMPLETED
        await this.prisma.enrollments.updateMany({
          where: {
            session_id: sessionId,
            enrollment_status: 'ACTIVE',
          },
          data: {
            enrollment_status: 'COMPLETED',
          },
        });
      }

      return {
        success: true,
        message: `Enrollments updated successfully for session ${sessionId}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to update enrollments for session change: ${error.message}`,
        );
      }

      throw new InternalServerErrorException(
        'An unknown error occurred while updating enrollments',
      );
    }
  }

  /**
   * Get all enrollments
   */
  async findAll(filters: any = {}) {
    try {
      return await this.prisma.enrollments.findMany({
        where: filters,
        include: {
          courses: true,
          students: true,
          registrars: true,
          sessions: true,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to find enrollments: ${error.message}`,
        );
      }

      throw new InternalServerErrorException(
        'An unknown error occurred while retrieving enrollments',
      );
    }
  }

  /**
   * Get a specific enrollment
   */
  async findOne(enrollmentId: number) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
        include: {
          // course: true,
          courses: true,

          students: true,
          registrars: true,
          sessions: true,
        },
      });

      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollmentId} not found`,
        );
      }

      return enrollment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to find enrollment: ${error.message}`,
        );
      }

      throw new InternalServerErrorException(
        'An unknown error occurred while retrieving enrollment',
      );
    }
  }

  // SupaBase
  async getEnrollmentListView(
    accessToken: string,
    currentUserId: number,
    currentUserRole: string,
    filters: Record<string, any> = {},
  ): Promise<
    {
      enrollmentId: number;
      studentName: string;
      studentId: string;
      studentImage: string;
      courseCode: string;
      courseName: string;
      courseStatus: string;
      courseCredit: string;
      courseDescription: string;
      program: string;
      status: 'approved' | 'pending' | 'rejected';
      assignedRegistrar?: string;
      assignedRegistrarImage?: string;
      assignedStatus: 'unassigned' | 'toOthers' | 'toMe';
      sessionName: string;
      sessionId: string;
      CourseId: string;
      reason: string;
      createdAt?: Date;
      updatedAt?: Date;
    }[]
  > {
    const enrollments = (await this.supabaseService.select(
      accessToken,
      'enrollments',
      {
        columns: `
      *, 
      students(*, programs(*)), 
      courses(*), 
      registrars(*), 
      sessions(*), 
      admins(*), 
      session_course:session_id(*)
    `,
        filter: filters,
      },
    )) as unknown as Enrollment[];

    return enrollments.map((e) => {
      let status: 'approved' | 'pending' | 'rejected';
      switch (e.enrollment_status) {
        case 'APPROVED':
          status = 'approved';
          break;
        case 'REJECTED':
          status = 'rejected';
          break;
        default:
          status = 'pending';
          break;
      }

      // Compute assignedStatus
      let assignedStatus: 'unassigned' | 'toOthers' | 'toMe';
      if (!e.registrar_id && !e.admin_id) {
        assignedStatus = 'unassigned';
      } else if (
        (currentUserRole === 'registrar' && e.registrar_id === currentUserId) ||
        (currentUserRole === 'admin' && e.admin_id === currentUserId)
      ) {
        assignedStatus = 'toMe';
      } else {
        assignedStatus = 'toOthers';
      }

      return {
        enrollmentId: e.enrollment_id,
        studentName:
          `${e.students?.first_name ?? ''} ${e.students?.last_name ?? ''}`.trim(),
        studentId: e.students?.reg_number ?? '',
        studentImage: e.students?.profile_picture ?? '',
        courseCode: e.courses?.course_code ?? '',
        courseCredit: e.courses?.course_credits ?? '',
        courseName: e.courses?.course_title ?? '',
        courseDescription: e.courses?.course_desc ?? '',
        sessionId: e.session_course.session_id ?? '',
        CourseId: e.courses?.course_id ?? '',
        courseStatus: e.session_course?.session_status ?? 'closed',
        program: e.students?.programs?.program_name ?? '',
        status,
        assignedRegistrar:
          `${e.registrars?.first_name ?? ''} ${e.registrars?.last_name ?? ''}`.trim(),
        assignedRegistrarImage: e.registrars?.profile_picture ?? '',
        assignedStatus,
        sessionName: e.session_course?.session_name ?? '',
        reason: e.rejection_reason,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      };
    });
  }

  async update(
    enrollment_id: number,
    updateDto: UpdateEnrollmentDto,
    accessToken: string,
  ): Promise<{ success: boolean; message: string; enrollment: any }> {
    try {
      const existing = await this.supabaseService.select(
        accessToken,
        'enrollments',
        {
          filter: { enrollment_id },
        },
      );

      if (!existing || (existing as any[]).length === 0) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollment_id} not found`,
        );
      }

      const updated = await this.supabaseService.update(
        accessToken,
        'enrollments',
        { enrollment_id },
        {
          ...updateDto,
          updated_at: new Date(),
        },
      );

      if (!updated || (updated as any[]).length === 0) {
        throw new InternalServerErrorException('Failed to update enrollment');
      }

      return {
        success: true,
        message: `Enrollment with ID ${enrollment_id} updated successfully`,
        enrollment: updated[0],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update enrollment');
    }
  }

  async create(
    createDto: CreateEnrollmentDto,
    accessToken: string,
  ): Promise<{ success: boolean; message: string; enrollment: any }> {
    const { student_id, course_id, session_id } = createDto;

    // 1. Check for duplicate enrollment with same student_id, course_id, session_id
    const possibleDuplicates = await this.supabaseService.select(
      accessToken,
      'enrollments',
      {
        filter: { student_id, course_id, session_id },
      },
    );
    const duplicates = possibleDuplicates.filter((enrollment: any) =>
      ['APPROVED', 'PENDING'].includes(enrollment.enrollment_status),
    );

    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Enrollment already exists for student_id ${student_id}, course_id ${course_id}, session_id ${session_id}`,
      );
    }

    if (duplicates && duplicates.length > 0) {
      throw new BadRequestException(
        `Enrollment already exists for student_id ${student_id}, course_id ${course_id}, session_id ${session_id}`,
      );
    }

    const existingEnrollment: any[] = await this.supabaseService.select(
      accessToken,
      'enrollments',
      {
        filter: { student_id, session_id },
      },
    );

    let registrar_id = null;
    let admin_id = null;

    if (existingEnrollment && existingEnrollment.length > 0) {
      registrar_id = existingEnrollment[0].registrar_id || null;
      admin_id = existingEnrollment[0].admin_id || null;
    }

    const enrollmentData = {
      ...createDto,
      ...(registrar_id !== null && { registrar_id }),
      ...(admin_id !== null && { admin_id }),
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 4. Insert new enrollment
    const inserted = await this.supabaseService.insert(
      accessToken,
      'enrollments',
      enrollmentData,
    );

    return {
      success: true,
      message: 'Enrollment created successfully',
      enrollment: inserted[0],
    };
  }
}

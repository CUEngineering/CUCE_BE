import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../../../supabase/supabase.service';

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
        include: { student: true },
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
      if (!isAdmin && enrollment.student.user_id !== userId) {
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
          course: true,
          student: true,
          registrar: true,
          session: true,
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
          course: true,
          student: true,
          registrar: true,
          session: true,
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
}

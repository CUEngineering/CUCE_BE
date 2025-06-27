import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SupabaseService } from '../../../supabase/supabase.service';
import { EnrollmentsService } from '../../enrollments/services/enrollments.service';

@Injectable()
export class SessionsService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Get all sessions
   */
  async findAll() {
    try {
      return await this.prisma.sessions.findMany({
        orderBy: {
          created_at: 'desc',
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to retrieve sessions: ${error.message}`,
      );
    }
  }

  /**
   * Get a specific session
   */
  async findOne(sessionId: number) {
    try {
      const session = await this.prisma.sessions.findUnique({
        where: { session_id: sessionId },
      });

      if (!session) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to retrieve session: ${error.message}`,
      );
    }
  }

  /**
   * Create a new session
   */
  async create(sessionData: {
    session_name: string;
    start_date: Date;
    end_date: Date;
    enrollment_deadline: Date;
  }) {
    try {
      // Validate dates
      const now = new Date();
      const startDate = new Date(sessionData.start_date);
      const endDate = new Date(sessionData.end_date);
      const enrollmentDeadline = new Date(sessionData.enrollment_deadline);

      if (startDate < now) {
        throw new BadRequestException('Start date cannot be in the past');
      }

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }

      if (enrollmentDeadline >= startDate) {
        throw new BadRequestException(
          'Enrollment deadline must be before start date',
        );
      }

      // Create the session with UPCOMING status
      const session = await this.prisma.sessions.create({
        data: {
          ...sessionData,
          session_status: 'UPCOMING',
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        message: 'Session created successfully',
        session,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to create session: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while creating session',
      );
    }
  }

  /**
   * Update a session
   */
  async update(
    sessionId: number,
    updateData: {
      session_name?: string;
      start_date?: Date;
      end_date?: Date;
      enrollment_deadline?: Date;
    },
  ) {
    try {
      const session = await this.findOne(sessionId);

      // Cannot update active or closed sessions
      if (session.session_status !== 'UPCOMING') {
        throw new BadRequestException(
          `Cannot update a session with status ${session.session_status}`,
        );
      }

      // Validate dates if provided
      if (
        updateData.start_date ||
        updateData.end_date ||
        updateData.enrollment_deadline
      ) {
        const startDate = updateData.start_date
          ? new Date(updateData.start_date)
          : new Date(session.start_date);
        const endDate = updateData.end_date
          ? new Date(updateData.end_date)
          : new Date(session.end_date);
        const enrollmentDeadline = updateData.enrollment_deadline
          ? new Date(updateData.enrollment_deadline)
          : new Date(session.enrollment_deadline);

        const now = new Date();

        if (startDate < now) {
          throw new BadRequestException('Start date cannot be in the past');
        }

        if (endDate <= startDate) {
          throw new BadRequestException('End date must be after start date');
        }

        if (enrollmentDeadline >= startDate) {
          throw new BadRequestException(
            'Enrollment deadline must be before start date',
          );
        }
      }

      // Update the session
      const updatedSession = await this.prisma.sessions.update({
        where: { session_id: sessionId },
        data: updateData,
      });

      return {
        success: true,
        message: 'Session updated successfully',
        session: updatedSession,
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
          `Failed to update session: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while updating session',
      );
    }
  }

  /**
   * Start a session
   * This will close any currently active sessions and update enrollment statuses
   */
  async startSession(sessionId: number) {
    try {
      const session = await this.findOne(sessionId);

      if (session.session_status !== 'UPCOMING') {
        throw new BadRequestException(
          `Cannot start a session with status ${session.session_status}`,
        );
      }

      // Close any currently active sessions
      const activeSessions = await this.prisma.sessions.findMany({
        where: {
          session_status: 'ACTIVE',
        },
      });

      for (const activeSession of activeSessions) {
        await this.closeSession(activeSession.session_id);
      }

      // Update the session status to ACTIVE
      const updatedSession = await this.prisma.sessions.update({
        where: { session_id: sessionId },
        data: {
          session_status: 'ACTIVE',
        },
      });

      // Update enrollment statuses from APPROVED to ACTIVE
      await this.enrollmentsService.updateEnrollmentsForSessionChange(
        sessionId,
        'ACTIVE',
      );

      return {
        success: true,
        message: 'Session started successfully',
        session: updatedSession,
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
          `Failed to start session: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while starting session',
      );
    }
  }

  /**
   * Close a session
   * This will update enrollment statuses from ACTIVE to COMPLETED
   */
  async closeSession(sessionId: number) {
    try {
      const session = await this.findOne(sessionId);

      if (session.session_status !== 'ACTIVE') {
        throw new BadRequestException(
          `Cannot close a session with status ${session.session_status}`,
        );
      }

      // Update the session status to CLOSED
      const updatedSession = await this.prisma.sessions.update({
        where: { session_id: sessionId },
        data: {
          session_status: 'CLOSED',
        },
      });

      // Update enrollment statuses from ACTIVE to COMPLETED
      await this.enrollmentsService.updateEnrollmentsForSessionChange(
        sessionId,
        'CLOSED',
      );

      return {
        success: true,
        message: 'Session closed successfully',
        session: updatedSession,
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
          `Failed to close session: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while closing session',
      );
    }
  }

  //SUPABASE
  async getAllSessionsWithStats(
    accessToken: string,
    status?: 'active' | 'closed' | 'upcoming',
  ) {
    try {
      const filter: Record<string, any> = {};

      if (status === 'closed') {
        filter.session_status = 'CLOSED';
      } else if (status === 'active') {
        filter.session_status = 'ACTIVE';
      } else if (status === 'upcoming') {
        filter.session_status = 'UPCOMING';
      }

      const sessions = await this.supabaseService.select(
        accessToken,
        'sessions',
        {
          columns: `
        session_id,
        session_name,
        start_date,
        end_date,
        enrollment_deadline,
        session_status,
        session_courses(session_id),
        session_students(session_id)
      `,
          filter,
          orderBy: {
            column: 'created_at',
            ascending: false,
          },
        },
      );

      return sessions.map((s: any) => ({
        sessionId: s.session_id,
        sessionName: s.session_name,
        startDate: s.start_date,
        endDate: s.end_date,
        enrollmentDeadline: s.enrollment_deadline,
        sessionStatus: s.session_status,
        numberOfCourses: s.session_courses?.length || 0,
        numberOfStudents: s.session_students?.length || 0,
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to retrieve sessions: ${error.message}`,
      );
    }
  }
}

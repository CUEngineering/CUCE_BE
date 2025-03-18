import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EnrollmentsService } from '../../enrollments/services/enrollments.service';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /**
   * Get all sessions
   */
  async findAll() {
    try {
      return await this.prisma.session.findMany({
        orderBy: {
          start_date: 'desc',
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to find sessions: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while retrieving sessions',
      );
    }
  }

  /**
   * Get a specific session
   */
  async findOne(sessionId: string) {
    try {
      const session = await this.prisma.session.findUnique({
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

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to find session: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while retrieving session',
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
      const session = await this.prisma.session.create({
        data: {
          ...sessionData,
          session_status: 'UPCOMING',
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
    sessionId: string,
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
      const updatedSession = await this.prisma.session.update({
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
  async startSession(sessionId: string) {
    try {
      const session = await this.findOne(sessionId);

      if (session.session_status !== 'UPCOMING') {
        throw new BadRequestException(
          `Cannot start a session with status ${session.session_status}`,
        );
      }

      // Close any currently active sessions
      const activeSessions = await this.prisma.session.findMany({
        where: {
          session_status: 'ACTIVE',
        },
      });

      for (const activeSession of activeSessions) {
        await this.closeSession(activeSession.session_id);
      }

      // Update the session status to ACTIVE
      const updatedSession = await this.prisma.session.update({
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
  async closeSession(sessionId: string) {
    try {
      const session = await this.findOne(sessionId);

      if (session.session_status !== 'ACTIVE') {
        throw new BadRequestException(
          `Cannot close a session with status ${session.session_status}`,
        );
      }

      // Update the session status to CLOSED
      const updatedSession = await this.prisma.session.update({
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
}

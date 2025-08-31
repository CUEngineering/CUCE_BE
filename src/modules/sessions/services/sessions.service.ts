import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { SharedSessionService } from 'src/modules/shared/services/session.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import { EnrollmentsService } from '../../enrollments/services/enrollments.service';
import { CreateSessionDto, UpdateSessionDto } from '../dto/index.dto';

@Injectable()
export class SessionsService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly supabaseService: SupabaseService,
    private readonly sharedSessionService: SharedSessionService,
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
      throw new InternalServerErrorException(`Failed to retrieve sessions: ${error.message}`);
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

      throw new InternalServerErrorException(`Failed to retrieve session: ${error.message}`);
    }
  }

  /**
   * Create a new session
   */
  async create(sessionData: { session_name: string; start_date: Date; end_date: Date; enrollment_deadline: Date }) {
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
        throw new BadRequestException('Enrollment deadline must be before start date');
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
        throw new InternalServerErrorException(`Failed to create session: ${error.message}`);
      }
      throw new InternalServerErrorException('An unknown error occurred while creating session');
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
        throw new BadRequestException(`Cannot update a session with status ${session.session_status}`);
      }

      // Validate dates if provided
      if (updateData.start_date || updateData.end_date || updateData.enrollment_deadline) {
        const startDate = updateData.start_date ? new Date(updateData.start_date) : new Date(session.start_date);
        const endDate = updateData.end_date ? new Date(updateData.end_date) : new Date(session.end_date);
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
          throw new BadRequestException('Enrollment deadline must be before start date');
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
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to update session: ${error.message}`);
      }
      throw new InternalServerErrorException('An unknown error occurred while updating session');
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
        throw new BadRequestException(`Cannot start a session with status ${session.session_status}`);
      }

      const adminSupabaseClient = this.sharedSessionService.adminSupabaseClient;
      const activeSessionIds = await this.sharedSessionService.getActiveSessionIds(adminSupabaseClient);

      // Close any currently active sessions
      for await (const activeSessionId of activeSessionIds) {
        await this.closeSession(Number(activeSessionId));
      }

      // Update the session status to ACTIVE
      await this.prisma.$executeRaw`
        update 
          sessions
        set
          session_status = 'ACTIVE',
          start_date = now()
        where
          session_id = ${session.session_id}
      `;

      const updatedSession = await this.findOne(session.session_id);

      // Update enrollment statuses from APPROVED to ACTIVE
      await this.enrollmentsService.updateEnrollmentsForSessionChange(sessionId, 'ACTIVE');

      return {
        success: true,
        message: 'Session started successfully',
        session: updatedSession,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to start session: ${error.message}`);
      }
      throw new InternalServerErrorException('An unknown error occurred while starting session');
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
        throw new BadRequestException(`Cannot close a session with status ${session.session_status}`);
      }

      // Update the session status to CLOSED
      const updatedSession = await this.prisma.sessions.update({
        where: { session_id: sessionId },
        data: {
          session_status: 'CLOSED',
        },
      });

      // Update enrollment statuses from ACTIVE to COMPLETED
      await this.enrollmentsService.updateEnrollmentsForSessionChange(sessionId, 'CLOSED');

      return {
        success: true,
        message: 'Session closed successfully',
        session: updatedSession,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to close session: ${error.message}`);
      }
      throw new InternalServerErrorException('An unknown error occurred while closing session');
    }
  }

  // SUPABASE
  async getAllSessionsWithStats(accessToken: string, status?: 'active' | 'closed' | 'upcoming' | 'not_closed') {
    try {
      const filter: Record<string, any> = {};

      if (status === 'closed') {
        filter.session_status = 'CLOSED';
      } else if (status === 'active') {
        filter.session_status = 'ACTIVE';
      } else if (status === 'upcoming') {
        filter.session_status = 'UPCOMING';
      } else if (status === 'not_closed') {
        filter.session_status = { neq: 'CLOSED' };
      }

      const sessions = await this.supabaseService.select(accessToken, 'sessions', {
        columns: `
        session_id,
        session_name,
        start_date,
        end_date,
        enrollment_deadline,
        session_status,
        session_courses(session_id, status),
        session_students(session_id)
      `,
        filter,
        orderBy: {
          column: 'created_at',
          ascending: false,
        },
      });

      return sessions.map((s: any) => {
        const activeCourses = s.session_courses?.filter((c: any) => c.status === 'OPEN') || [];

        return {
          sessionId: s.session_id,
          sessionName: s.session_name,
          startDate: s.start_date,
          endDate: s.end_date,
          enrollmentDeadline: s.enrollment_deadline,
          sessionStatus: s.session_status,
          numberOfOpenCourses: activeCourses.length,
          numberOfStudents: s.session_students?.length || 0,
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(`Failed to retrieve sessions: ${error.message}`);
    }
  }

  async findAllFilterSessions(accessToken: string) {
    try {
      const supabase = this.supabaseService.getClientWithAuth(accessToken);
      const sessionsResp = await supabase
        .from('sessions')
        .select(
          `
            session_id,
            session_name,
            start_date,
            end_date,
            enrollment_deadline,
            session_status,
            created_at,
            updated_at
          `,
        )
        .in('session_status', ['ACTIVE', 'CLOSED'])
        .order('created_at', {
          ascending: true,
        });

      if (sessionsResp.error) {
        throw new BadRequestException(`An error occurred while fetching session filter`);
      }

      return sessionsResp.data;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to retrieve sessions: ${error.message}`);
    }
  }

  async getStudentsBySession(accessToken: string, sessionId: number) {
    try {
      const result = await this.supabaseService.select(accessToken, 'session_students', {
        columns: `
          student_id,
          students(
            student_id,
            first_name,
            last_name,
            email,
            profile_picture,
            reg_number,
            programs(program_id, program_name, program_type)
          )
        `,
        filter: { session_id: sessionId },
      });

      return result.map((ss: any) => ({
        studentId: ss.student_id,
        firstName: ss.students?.first_name,
        lastName: ss.students?.last_name,
        email: ss.students?.email,
        regNumber: ss.students?.reg_number,
        profilePicture: ss.students?.profile_picture,
        program: ss.students?.programs
          ? {
              programId: ss.students.programs.program_id,
              name: ss.students.programs.program_name,
              type: ss.students.programs.program_type,
            }
          : null,
      }));
    } catch (error) {
      throw new InternalServerErrorException(`Failed to retrieve session students: ${error.message}`);
    }
  }

  async getCoursesBySession(accessToken: string, sessionId: number) {
    try {
      // Fetch all session_courses for this session
      const sessionCourses = await this.supabaseService.select(accessToken, 'session_courses', {
        columns: `
          session_id,
          course_id,
          status,
          courses(
            course_id,
            course_title,
            course_code,
            course_credits,
            course_type
          )
        `,
        filter: { session_id: sessionId },
      });

      // Fetch all enrollments for this session
      const enrollments = await this.supabaseService.select(accessToken, 'enrollments', {
        columns: 'course_id',
        filter: { session_id: sessionId },
      });

      const enrollmentCounts = enrollments.reduce((acc: Record<number, number>, e: any) => {
        acc[e.course_id] = (acc[e.course_id] || 0) + 1;
        return acc;
      }, {});

      // Fetch all courses (in case some are missing in session_courses)
      const allCourses = await this.supabaseService.select(accessToken, 'courses', {
        columns: `
          course_id,
          course_title,
          course_code,
          course_credits,
          course_type
        `,
      });

      // Create a Set of course_ids that are already in sessionCourses
      const existingCourseIds = new Set(sessionCourses.map((sc: any) => sc.course_id));

      // Add missing courses with default CLOSED status
      const missingCourses = allCourses
        .filter((course: any) => !existingCourseIds.has(course.course_id))
        .map((course: any) => ({
          courseId: course.course_id,
          status: 'CLOSED',
          title: course.course_title,
          code: course.course_code,
          credits: course.course_credits,
          type: course.course_type,
          numberOfStudents: 0,
        }));

      // Map existing sessionCourses
      const mappedCourses = sessionCourses.map((sc: any) => ({
        courseId: sc.course_id,
        status: sc.status,
        title: sc.courses?.course_title,
        code: sc.courses?.course_code,
        credits: sc.courses?.course_credits,
        type: sc.courses?.course_type,
        numberOfStudents: enrollmentCounts[sc.course_id] || 0,
      }));

      // Combine both
      return [...mappedCourses, ...missingCourses];
    } catch (error) {
      throw new InternalServerErrorException(`Failed to retrieve session courses: ${error.message}`);
    }
  }

  async getSessionDetail(accessToken: string, sessionId: number) {
    try {
      const session = await this.supabaseService.select(accessToken, 'sessions', {
        columns: `
          session_id,
          session_name,
          start_date,
          end_date,
          enrollment_deadline,
          session_status,
          session_courses(session_id, course_id, status, adjusted_capacity, created_at, updated_at),
        session_students(session_id, student_id),
          created_at,
          updated_at
        `,
        filter: { session_id: sessionId },
      });

      if (!session) throw new NotFoundException('Session not found');

      return session[0];
    } catch (error) {
      throw new InternalServerErrorException(`Failed to retrieve session detail: ${error.message}`);
    }
  }

  async createSession(accessToken: string, dto: CreateSessionDto) {
    try {
      const result = await this.supabaseService.insert(accessToken, 'sessions', dto);

      if (!result || result.length === 0) {
        throw new BadRequestException('Failed to create session');
      }

      return result[0];
    } catch (error) {
      throw new InternalServerErrorException(`Failed to create session: ${error.message}`);
    }
  }

  async updateSession(accessToken: string, sessionId: number, dto: UpdateSessionDto) {
    try {
      const result = await this.supabaseService.update(accessToken, 'sessions', { session_id: sessionId }, dto);

      if (!result || result.length === 0) {
        throw new NotFoundException('Session not found or update failed');
      }

      return result[0];
    } catch (error) {
      throw new InternalServerErrorException(`Failed to update session: ${error.message}`);
    }
  }

  async deleteSession(accessToken: string, sessionId: number): Promise<void> {
    try {
      const result = await this.supabaseService.delete(accessToken, 'sessions', { session_id: sessionId });

      if (!result || result.length === 0) {
        throw new NotFoundException('Session not found or already deleted');
      }
    } catch (error) {
      throw new InternalServerErrorException(`Failed to delete session: ${error.message}`);
    }
  }

  async removeStudentFromSession(accessToken: string, sessionId: number, studentId: number): Promise<void> {
    try {
      const result = await this.supabaseService.delete(accessToken, 'session_students', {
        session_id: sessionId,
        student_id: studentId,
      });

      if (!result || result.length === 0) {
        throw new NotFoundException('Student not found in session');
      }
    } catch (error) {
      throw new InternalServerErrorException(`Failed to remove student from session: ${error.message}`);
    }
  }

  async updateCourseStatus(accessToken: string, sessionId: number, courseId: number, status: string) {
    try {
      const result = await this.supabaseService.update(
        accessToken,
        'session_courses',
        {
          session_id: sessionId,
          course_id: courseId,
        },
        { status },
      );

      if (!result || result.length === 0) {
        const courseData = await this.supabaseService.select(accessToken, 'courses', {
          filter: { course_id: courseId },
        });

        if (!courseData || courseData.length === 0) {
          throw new NotFoundException('Course not found');
        }

        const course = courseData[0] as any;

        const insertResult = await this.supabaseService.insert(accessToken, 'session_courses', {
          session_id: sessionId,
          course_id: courseId,
          status,
          adjusted_capacity: course.default_capacity,
          updated_at: new Date(),
        });

        return {
          message: 'Course not found for session, so a new session_course was created',
          data: insertResult,
        };
      }

      return { message: 'Course status updated successfully' };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to update or insert course status: ${error.message}`);
    }
  }

  async addStudentsToSession(accessToken: string, sessionId: number, studentIds: number[]): Promise<void> {
    try {
      const payload = studentIds.map((studentId) => ({
        session_id: sessionId,
        student_id: studentId,
        updated_at: new Date().toISOString(),
      }));

      const result = await this.supabaseService.insert(accessToken, 'session_students', payload);

      if (!result || result.length === 0) {
        throw new InternalServerErrorException('Failed to add students to session');
      }
    } catch (error) {
      throw new InternalServerErrorException(`Error adding students to session: ${error.message}`);
    }
  }

  // session.service.ts
  async createSessionWithStudents(accessToken: string, dto: CreateSessionDto, studentIds: number[]) {
    try {
      const sessionResult = await this.supabaseService.insert(accessToken, 'sessions', dto);

      if (!sessionResult || sessionResult.length === 0) {
        throw new BadRequestException('Failed to create session');
      }

      const session = sessionResult[0];

      const payload = studentIds.map((studentId) => ({
        session_id: session.session_id,
        student_id: studentId,
        updated_at: new Date().toISOString(),
      }));

      const studentResult = await this.supabaseService.insert(accessToken, 'session_students', payload);

      if (!studentResult || studentResult.length === 0) {
        throw new InternalServerErrorException('Failed to add students to session');
      }

      return {
        session,
        students_added: studentResult.length,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to create session with students: ${error.message}`);
    }
  }

  // Every 10 seconds, close sessions automatically
  @Interval('autoCloseSessions', 10000)
  async autoCloseSessions() {
    const sessionIdsToClose =
      (
        await this.prisma.$queryRaw<
          [
            {
              sessionIdsToClose: (string | number)[];
            },
          ]
        >`
        select
          array_agg(s."session_id") as "sessionIdsToClose"
        from
          sessions s
        where
          s."session_status" <> 'CLOSED'
          and
          now() > s."end_date"
        limit 1
      `
      )[0]?.sessionIdsToClose ?? [];

    console.log(`Session IDs to close at ${new Date()} =====> `, sessionIdsToClose);

    for await (const sessionId of sessionIdsToClose) {
      await this.closeSession(Number(sessionId));
    }
  }

  // Every 10 seconds, start sessions automatically
  @Interval('autoStartSessions', 10000)
  async autoStartSessions() {
    const sessionIdsToStart =
      (
        await this.prisma.$queryRaw<
          [
            {
              sessionIdsToStart: (string | number)[];
            },
          ]
        >`
        select
          array_agg(s."session_id") as "sessionIdsToStart"
        from
          sessions s
        where
          s."session_status" = 'UPCOMING'
          and
          now() > s."start_date"
        limit 1
      `
      )[0]?.sessionIdsToStart ?? [];

    console.log(`Session IDs to start at ${new Date()}=====> `, sessionIdsToStart);

    for await (const sessionId of sessionIdsToStart) {
      await this.startSession(Number(sessionId));
    }
  }

  // Every 10 seconds, close session courses after session enrollment deadline automatically
  @Interval('closeSessionCourse', 10000)
  async closeSessionCourse() {
    const noOfRowsAffected = await this.prisma.$executeRaw`
      update
        session_courses
      set
        status = 'CLOSED'
      where
        session_id in (
          select
            s.session_id
          from
            sessions s
          where
            s."session_status" = 'ACTIVE'
            and
            now() > s."enrollment_deadline"
        )
    `;

    console.log(`No of session course closed at ${new Date()}=====> `, noOfRowsAffected);
  }
}

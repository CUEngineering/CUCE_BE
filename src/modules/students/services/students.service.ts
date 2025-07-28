import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { File as MulterFile } from 'multer';

import { ConfigService } from '@nestjs/config';
import { EnrollmentStatus, InvitationStatus, UserType } from '@prisma/client';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { RegistrarsService } from 'src/modules/registrars/services/registrars.service';
import { sendEmail } from 'src/utils/email.helper';
import { encodeEmail } from 'src/utils/emailEncrypt';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  AcceptStudentInviteDto,
  InviteStudentDto,
} from '../dto/invite-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import {
  SessionResponse,
  Student,
  StudentResponse,
  StudentStats,
  StudentWithRegistrar,
} from '../types/student.types';

function safeUuidv4(): string {
  try {
    return randomUUID();
  } catch {
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

@Injectable()
export class StudentsService {
  private adminClient: SupabaseClient;
  private readonly logger = new Logger(RegistrarsService.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL and Service Role Key must be provided');
    }

    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async findAll(accessToken: string): Promise<StudentWithRegistrar[]> {
    try {
      if (!accessToken) {
        throw new UnauthorizedException('Access token is required');
      }

      const result = (await this.supabaseService.select(
        accessToken,
        'students',
        {
          columns: `
        student_id,
        reg_number,
        first_name,
        last_name,
        email,
        profile_picture,
        program_id,
        program:programs(program_name, program_type, total_credits),
        enrollments(
          enrollment_id,
          registrar_id,
          sessions(session_status),
          registrars(registrar_id, first_name, last_name, email, profile_picture)
        )
      `,
          filter: {
            'enrollments.sessions.session_status': { eq: 'ACTIVE' },
            'enrollments.enrollment_status': { eq: 'APPROVED' },
          },
        },
      )) as unknown as StudentWithRegistrar[];

      if (!result) {
        this.logger.warn('No students found in the database');
        return [];
      }

      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `Error fetching all students: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  async findOne(student_id: number, accessToken: string): Promise<Student> {
    try {
      // Get student personal details and program info
      const result = (await this.supabaseService.select(
        accessToken,
        'students',
        {
          filter: { student_id },
          columns:
            'student_id, reg_number, first_name, last_name, email, profile_picture, program_id, program:programs(program_name, program_type, total_credits)',
        },
      )) as unknown as Student[];

      if (!result || result.length === 0) {
        throw new NotFoundException(`Student with ID ${student_id} not found`);
      }

      const student = result[0];

      // Get student sessions with courses
      //   const sessions = await this.getStudentSessions(student_id, accessToken);

      // Get student stats
      //   const stats = await this.getStudentStats(student_id, accessToken);

      return {
        ...student,
        // sessions,
        // stats,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error fetching student ${student_id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch student');
    }
  }

  async update(
    student_id: number,
    updateStudentDto: UpdateStudentDto,
    accessToken: string,
  ): Promise<Student> {
    try {
      // First verify student exists
      await this.findOne(student_id, accessToken);

      // If email is being updated, check if it's already in use
      if (updateStudentDto.email) {
        const existingStudent = (await this.supabaseService.select(
          accessToken,
          'students',
          {
            filter: {
              email: updateStudentDto.email,
              student_id: { not: student_id },
            },
          },
        )) as unknown as Student[];

        if (existingStudent && existingStudent.length > 0) {
          throw new BadRequestException(
            `Email ${updateStudentDto.email} is already in use`,
          );
        }
      }

      // If program_id is being updated, verify it exists
      if (updateStudentDto.program_id) {
        const program = (await this.supabaseService.select(
          accessToken,
          'programs',
          {
            filter: { program_id: updateStudentDto.program_id },
          },
        )) as unknown as any[];

        if (!program || program.length === 0) {
          throw new BadRequestException(
            `Program with ID ${updateStudentDto.program_id} not found`,
          );
        }
      }

      const result = (await this.supabaseService.update(
        accessToken,
        'students',
        { student_id },
        updateStudentDto,
      )) as unknown as Student[];

      if (!result || result.length === 0) {
        throw new NotFoundException(`Student with ID ${student_id} not found`);
      }

      return result[0];
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Error updating student ${student_id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to update student');
    }
  }

  async inviteStudent(
    inviteDto: InviteStudentDto,
    accessToken: string,
  ): Promise<StudentResponse> {
    let invitationId: number | null = null;
    try {
      const { email, reg_number, program_id } = inviteDto;

      // Check if student with this reg_number already exists
      const existingStudent = (await this.supabaseService.select(
        accessToken,
        'students',
        {
          filter: { reg_number },
        },
      )) as unknown as Student[];

      if (existingStudent && existingStudent.length > 0) {
        throw new BadRequestException(
          `A student with registration number ${reg_number} already exists`,
        );
      }

      // Check if invitation already exists for this email with PENDING status
      const existingInvitation = (await this.supabaseService.select(
        accessToken,
        'invitations',
        {
          filter: {
            email,
            status: InvitationStatus.PENDING,
          },
        },
      )) as unknown as any[];

      if (existingInvitation && existingInvitation.length > 0) {
        throw new BadRequestException(
          `An invitation for ${email} already exists and is pending`,
        );
      }

      // Check if program exists
      const program = (await this.supabaseService.select(
        accessToken,
        'programs',
        {
          filter: { program_id },
        },
      )) as unknown as any[];

      if (!program || program.length === 0) {
        throw new BadRequestException(
          `Program with ID ${program_id} not found`,
        );
      }

      // Generate safe UUID for token
      const token = safeUuidv4();

      // Create new invitation
      const invitation = (await this.supabaseService.insert(
        accessToken,
        'invitations',
        {
          email,
          token,
          user_type: UserType.STUDENT,
          status: InvitationStatus.PENDING,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          updated_at: new Date().toISOString(),
        },
      )) as unknown as any[];

      if (!invitation || invitation.length === 0) {
        throw new InternalServerErrorException('Failed to create invitation');
      }

      // Store invitation ID for potential rollback
      invitationId = invitation[0].invitation_id;

      // Create student record with minimal information
      const student = (await this.supabaseService.insert(
        accessToken,
        'students',
        {
          reg_number,
          email,
          program_id,
          updated_at: new Date().toISOString(),
        },
      )) as unknown as Student[];

      if (!student || student.length === 0) {
        throw new InternalServerErrorException(
          'Failed to create student record',
        );
      }
      const encodedEmail = encodeURIComponent(encodeEmail(email));
      const number = encodeURIComponent(encodeEmail(reg_number));

      const link = `${process.env.APP_BASE_URL}/accept-student?token=${token}&email=${encodedEmail}&registration_id=${number}`;

      await sendEmail({
        to: email,
        subject: 'You have been invited as a Student',
        template: 'student-invite.html',
        context: {
          email,
          reg_number,
          token,
          link: link,
        },
      });
      return {
        success: true,
        message: `Invitation sent to ${email}`,
        student: student[0],
      };
    } catch (error) {
      // Attempt rollback if we have an invitation ID
      if (invitationId) {
        try {
          await this.supabaseService.delete(accessToken, 'invitations', {
            invitation_id: invitationId,
          });
        } catch (rollbackError) {
          // Log the rollback error but don't throw it
          this.logger.error(
            `Failed to rollback invitation creation: ${rollbackError.message}`,
            rollbackError.stack,
          );
        }
      }

      // Rethrow known NestJS exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Error inviting student: ${error.message}`,
        error.stack,
      );

      // Handle unexpected errors
      throw new InternalServerErrorException(
        `Failed to invite student: ${error.message}`,
      );
    }
  }

  async getStudentStats(
    student_id: number,
    accessToken: string,
  ): Promise<StudentStats> {
    try {
      // Get all enrollments for this student with course data in a single query
      const enrollments = (await this.supabaseService.select(
        accessToken,
        'enrollments',
        {
          filter: { student_id },
          columns: `
            enrollment_id,
            enrollment_status,
            session_id,
            course:courses(
              course_id,
              course_credits
            )
          `,
        },
      )) as unknown as Array<{
        enrollment_id: number;
        enrollment_status: EnrollmentStatus;
        session_id: number;
        course: {
          course_id: number;
          course_credits: number;
        };
      }>;

      if (!enrollments) {
        this.logger.warn(`No enrollments found for student ${student_id}`);
        return {
          totalEnrollments: 0,
          enrollmentsByStatus: {} as Record<EnrollmentStatus, number>,
          totalCredits: 0,
        };
      }

      // Get active session in the same query
      const activeSession = (await this.supabaseService.select(
        accessToken,
        'sessions',
        {
          filter: { session_status: 'ACTIVE' },
          columns: `
            session_id,
            session_name,
            start_date,
            end_date,
            enrollment_deadline,
            session_status
          `,
          limit: 1,
        },
      )) as unknown as Array<{
        session_id: number;
        session_name: string;
        start_date: string;
        end_date: string;
        enrollment_deadline: string;
        session_status: string;
      }>;

      // Calculate overall stats
      const enrollmentsByStatus = enrollments.reduce(
        (acc, enrollment) => {
          acc[enrollment.enrollment_status] =
            (acc[enrollment.enrollment_status] || 0) + 1;
          return acc;
        },
        {} as Record<EnrollmentStatus, number>,
      );

      // Calculate total credits from approved and completed enrollments
      const totalCredits = enrollments
        .filter(
          (e) =>
            e.enrollment_status === 'APPROVED' ||
            e.enrollment_status === 'ACTIVE' ||
            e.enrollment_status === 'COMPLETED',
        )
        .reduce((acc, enrollment) => acc + enrollment.course.course_credits, 0);

      const stats: StudentStats = {
        totalEnrollments: enrollments.length,
        enrollmentsByStatus,
        totalCredits,
      };

      // If there's an active session, calculate its stats
      if (activeSession && activeSession.length > 0) {
        const sessionEnrollments = enrollments.filter(
          (e) => e.session_id === activeSession[0].session_id,
        );

        const sessionEnrollmentsByStatus = sessionEnrollments.reduce(
          (acc, enrollment) => {
            acc[enrollment.enrollment_status] =
              (acc[enrollment.enrollment_status] || 0) + 1;
            return acc;
          },
          {} as Record<EnrollmentStatus, number>,
        );

        const sessionTotalCredits = sessionEnrollments
          .filter(
            (e) =>
              e.enrollment_status === 'APPROVED' ||
              e.enrollment_status === 'COMPLETED',
          )
          .reduce(
            (acc, enrollment) => acc + enrollment.course.course_credits,
            0,
          );

        stats.activeSession = {
          session_id: activeSession[0].session_id,
          session_name: activeSession[0].session_name,
          start_date: new Date(activeSession[0].start_date),
          end_date: new Date(activeSession[0].end_date),
          enrollment_deadline: new Date(activeSession[0].enrollment_deadline),
          session_status: activeSession[0].session_status,
          totalEnrollments: sessionEnrollments.length,
          enrollmentsByStatus: sessionEnrollmentsByStatus,
          totalCredits: sessionTotalCredits,
        };
      }

      return stats;
    } catch (error) {
      this.logger.error(
        `Error fetching stats for student ${student_id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to fetch student stats');
    }
  }

  async getStudentSessions(student_id: number, accessToken: string) {
    try {
      // Validate student_id
      if (!student_id || student_id <= 0) {
        throw new BadRequestException('Invalid student ID');
      }
      // Verify student exists
      await this.findOne(student_id, accessToken);

      const sessions = await this.fetchStudentSessions(student_id, accessToken);

      // Check if there are any sessions
      if (!sessions || sessions.length === 0) {
        throw new NotFoundException(
          `No sessions found for student ${student_id}`,
        );
      }

      return this.formatSessions(sessions, student_id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error fetching sessions for student ${student_id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error fetching sessions for student ${student_id}: ${error.message}`,
      );
    }
  }

  private async fetchStudentSessions(
    student_id: number,
    accessToken: string,
  ): Promise<SessionResponse[]> {
    const sessions = await this.supabaseService.select(
      accessToken,
      'session_students',
      {
        filter: { student_id },
        columns: `
          session:sessions(
            session_id,
            session_name,
            start_date,
            end_date,
            enrollment_deadline,
            session_status,
            enrollments(
              enrollment_id,
              enrollment_status,
              special_request,
              rejection_reason,
              student_id,
              courses(
                course_id,
                course_title,
                course_code,
                course_credits,
                course_type,
                default_capacity,
                course_desc
              )
            )
          )
        `,
      },
    );

    if (
      !sessions ||
      (Array.isArray(sessions) && sessions.some((item) => 'error' in item))
    ) {
      throw new InternalServerErrorException('Failed to fetch sessions');
    }

    return sessions as unknown as SessionResponse[];
  }

  private getStudentEnrollments(
    enrollments: SessionResponse['session']['enrollments'],
    student_id: number,
  ) {
    return enrollments
      .filter((enrollment) => enrollment.student_id === student_id)
      .map((enrollment) => ({
        enrollment_id: enrollment.enrollment_id,
        enrollment_status: enrollment.enrollment_status as EnrollmentStatus,
        special_request: enrollment.special_request,
        rejection_reason: enrollment.rejection_reason,
        ...enrollment.courses,
        student_id: enrollment.student_id,
      }));
  }

  private formatSessions(sessions: SessionResponse[], student_id: number) {
    return sessions.map((item) => ({
      session_id: item.session.session_id,
      session_name: item.session.session_name,
      start_date: new Date(item.session.start_date),
      end_date: new Date(item.session.end_date),
      enrollment_deadline: new Date(item.session.enrollment_deadline),
      session_status: item.session.session_status,
      enrollments: this.getStudentEnrollments(
        item.session.enrollments,
        student_id,
      ),
    }));
  }

  async acceptStudentInvite(dto: AcceptStudentInviteDto, file?: MulterFile) {
    const { email, password, first_name, last_name, reg_number, token } = dto;

    try {
      const { data: invitation, error: invitationError } =
        await this.adminClient
          .from('invitations')
          .select('*')
          .eq('email', email)
          .eq('token', token)
          .eq('status', 'PENDING')
          .single();

      if (invitationError || !invitation) {
        throw new UnauthorizedException('Invalid or expired invitation');
      }

      const invitationDate = new Date(invitation.created_at);
      const expiryDate = new Date(
        invitationDate.getTime() + 7 * 24 * 60 * 60 * 1000,
      );
      if (new Date() > expiryDate) {
        throw new UnauthorizedException('Invitation has expired');
      }

      const { data: existingStudent } = await this.adminClient
        .from('students')
        .select('email')
        .or(`email.eq.${email},reg_number.eq.${reg_number}`)
        .maybeSingle();

      if (!existingStudent) {
        throw new ConflictException(
          'Student with this email or registration number not found',
        );
      }

      const { data: authData, error: authError } =
        await this.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              email_confirmed: true,
            },
          },
        });

      if (authError) {
        if (authError.message.includes('already in use')) {
          throw new ConflictException('Email is already registered');
        }
        throw new InternalServerErrorException(
          `Auth user creation failed: ${authError.message}`,
        );
      }

      if (!authData.user) {
        throw new InternalServerErrorException('User creation failed');
      }

      const userId = authData.user.id;
      let profileUrl = '';
      if (file) {
        profileUrl = await this.supabaseService.uploadImage(file);
      }

      const { data: student, error: studentError } = await this.adminClient
        .from('students')
        .update({
          first_name,
          last_name,
          email,
          profile_picture: profileUrl || null,
          user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('reg_number', reg_number)
        .select('*')
        .single();

      if (studentError) {
        await this.supabase.auth.admin.deleteUser(userId);
        throw new InternalServerErrorException(
          `Student creation failed: ${studentError.message}`,
        );
      }

      const { error: roleError } = await this.adminClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'STUDENT',
          updated_at: new Date().toISOString(),
        });

      if (roleError) {
        throw new InternalServerErrorException(
          `User role creation failed: ${roleError.message}`,
        );
      }

      const { error: updateInvitationError } = await this.adminClient
        .from('invitations')
        .update({
          status: 'ACCEPTED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateInvitationError) {
        this.logger.error(
          'Failed to update invitation status:',
          updateInvitationError.message,
        );
      }

      return {
        user: {
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          reg_number: student.reg_number,
          profilePicture: student.profile_picture,
          user_id: student.user_id,
        },
        session: authData.session,
        role: 'STUDENT',
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to accept student invitation',
      );
    }
  }

  async rejectStudent(
    student_id: number,
    accessToken: string,
  ): Promise<{ message: string }> {
    try {
      const response = await this.supabaseService.update(
        accessToken,
        'students',
        { student_id },
        { status: 'REJECTED' },
      );

      if (!response || (Array.isArray(response) && response.length === 0)) {
        throw new NotFoundException(
          `Student with ID ${student_id} not found or could not be updated`,
        );
      }

      return { message: `Student ${student_id} status updated to REJECTED` };
    } catch (error) {
      this.logger.error(
        `Error rejecting student ${student_id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to reject student');
    }
  }

  async deleteStudent(
    student_id: number,
    accessToken: string,
  ): Promise<{ message: string }> {
    try {
      const response = await this.supabaseService.delete(
        accessToken,
        'students',
        { student_id },
      );

      if (!response || (Array.isArray(response) && response.length === 0)) {
        throw new NotFoundException(
          `Student with ID ${student_id} not found or could not be deleted`,
        );
      }

      return { message: `Student ${student_id} has been deleted` };
    } catch (error) {
      this.logger.error(
        `Error deleting student ${student_id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to delete student');
    }
  }
}

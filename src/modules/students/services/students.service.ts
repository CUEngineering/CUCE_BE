import type { EnrollmentStatus, sessions } from '@prisma/client';
import type { File as MulterFile } from 'multer';
import type { AcceptStudentInviteDto, InviteStudentDto } from '../dto/invite-student.dto';
import type { UpdateStudentDto } from '../dto/update-student.dto';
import type { Student, StudentResponse, StudentStats, StudentWithRegistrar } from '../types/student.types';
import { randomUUID } from 'node:crypto';
import * as process from 'node:process';
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
import { ConfigService } from '@nestjs/config';

import { InvitationStatus, Prisma, UserType } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import isNumeric from 'fast-isnumeric';
import { pick } from 'lodash';
import { bignumber } from 'mathjs';
import { CourseService } from 'src/modules/courses/services/course.service';
import { RegistrarsService } from 'src/modules/registrars/services/registrars.service';
import { SharedSessionService } from 'src/modules/shared/services/session.service';
import { sendEmail } from 'src/utils/email.helper';
import { encodeEmail } from 'src/utils/emailEncrypt';
import { processPaginationInputOpts } from 'src/utils/general.helper';
import { SupabaseService } from '../../../supabase/supabase.service';

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
    @Inject(SupabaseService)
    private readonly supabaseService: SupabaseService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(SharedSessionService)
    private readonly sharedSessionService: SharedSessionService,
    @Inject(CourseService)
    private readonly courseService: CourseService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

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

  async findAllStudents(options: {
    search?: string;
    perPage?: string | number;
    page?: string | number;
  }): Promise<StudentWithRegistrar[]> {
    const { search } = options;
    const paginationInputOpts = processPaginationInputOpts(pick(options, ['perPage', 'page']));

    paginationInputOpts.perPage = 1000;
    paginationInputOpts.limit = 1000;
    paginationInputOpts.offset = 0;
    paginationInputOpts.page = 1;

    try {
      const sql = `
        select
          s.student_id,
          s.reg_number,
          s.first_name,
          s.last_name,
          s.email,
          s.profile_picture,
          s.program_id,
          s.status,
          s.created_at,
          s.updated_at,
          jsonb_build_object(
            'program_id',
            p.program_id,
            'program_name',
            p.program_name,
            'program_type',
            p.program_type,
            'total_credits',
            p.total_credits
          ) as program,
          (
            select
              jsonb_build_object(
                'invitation_id',
                i.invitation_id,
                'email',
                i.email,
                'expires_at',
                i.expires_at,
                'status',
                i.status,
                'user_type',
                i.user_type,
                'created_at',
                i.created_at,
                'updated_at',
                i.updated_at
              )
            from
              invitations i
            where
              i.user_type = 'STUDENT'
              and
              i.email = s.email
            order by
              i.expires_at asc
            limit 1
          ) as invitation,
          (
            select
              jsonb_build_object(
                'registrar_id',
                r.registrar_id,
                'first_name',
                r.first_name,
                'last_name',
                r.last_name,
                'email',
                r.email,
                'profile_picture',
                r.profile_picture,
                'is_suspended',
                r.is_suspended,
                'is_deactivated',
                r.is_deactivated
              )
            from
              sessions se
            inner join
              student_registrar_sessions srs
              on (
                srs.session_id = se.session_id
              )
            inner join
              students "is"
              on (
                "is"."student_id" = srs."student_id"
              )
            inner join
              registrars r
              on (
                srs.registrar_id = r.registrar_id
              )
            where
              se.session_status = 'ACTIVE'
              and
              "is"."student_id" = s."student_id"
            limit 1
          ) as registrar,
          (
            exists (
              select
                1
              from 
                sessions se
              inner join
                session_students st
                on (
                  se.session_id = st.session_id
                )
              where
                se.session_status = 'ACTIVE'
                and
                st.student_id = s.student_id
              limit 1
            )
            and 
            not exists (
              select
                1
              from
                sessions se
              inner join
                student_registrar_sessions srs
                on (
                  srs.session_id = se.session_id
                )
              inner join
                students "is"
                on (
                  "is"."student_id" = srs."student_id"
                )
              where
                se.session_status = 'ACTIVE'
                and
                "is"."student_id" = s."student_id"
              limit 1
            )
          ) as can_claim,
          coalesce(
            (
              select
                count(pc.course_id)
              from
                program_courses pc
              where
                pc.program_id = s.program_id
              limit 1
            ),
            0
          ) as program_course_count
        from
          students s
        inner join
          programs p
          on (
            p.program_id = s.program_id
          )
        where
          s.student_id > 0
        order by
          s.updated_at desc,
          s.created_at desc,
          s.student_id desc
        limit 
          ${paginationInputOpts.limit}
        offset
          ${paginationInputOpts.offset}
      `;

      const prismaSql = Prisma.sql([sql]);
      const students = await this.sharedSessionService.prismaClient.$queryRaw<StudentWithRegistrar[]>(prismaSql);

      if (!students.length) {
        this.logger.warn('No students found in the database');
        return [];
      }

      return students.map((s) => {
        s.program_course_count = bignumber(s.program_course_count).toNumber();
        return s;
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(`Error fetching all students: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  async findAllSessionStudents(options: {
    accessToken: string;
    role: 'admin' | 'registrar';
    roleId: string | number;
    sessionId?: string | number;
    assignedTo: 'all' | 'none' | 'me' | 'others';
    search?: string;
    perPage?: string | number;
    page?: string | number;
  }): Promise<StudentWithRegistrar[]> {
    const { accessToken, role, roleId, sessionId, assignedTo } = options;
    const paginationInputOpts = processPaginationInputOpts(pick(options, ['perPage', 'page']));

    paginationInputOpts.perPage = 1000;
    paginationInputOpts.limit = 1000;
    paginationInputOpts.offset = 0;
    paginationInputOpts.page = 1;

    try {
      if (!accessToken) {
        throw new UnauthorizedException('Access token is required');
      }

      if (role === 'registrar' && assignedTo === 'others') {
        return [];
      }

      let registrarId: string = String(role === 'registrar' ? (roleId ?? '') : '');
      if (role === 'admin') {
        const adminRegistrarResp = await this.sharedSessionService.prismaClient.$queryRaw<
          [
            {
              registrar_id: string | number;
            },
          ]
        >`
          select
            r.registrar_id
          from
            admins a
          inner join
            registrars r
            on (
              a.email = r.email
            )
          where
            a.admin_id = ${roleId}
          limit 1
        `;

        if (!adminRegistrarResp.length) {
          throw new BadRequestException(`Administrator doesn't have a registrar account`);
        }

        registrarId = String(adminRegistrarResp[0].registrar_id);
      }

      if (!registrarId) {
        throw new BadRequestException(`Registrar identifier is invalid`);
      }

      console.log('Options used is ====> ', {
        sessionId,
        assignedTo,
        registrarId,
      });

      const sql = `
        select
          s.student_id,
          s.reg_number,
          s.first_name,
          s.last_name,
          s.email,
          s.profile_picture,
          s.program_id,
          s.status,
          s.created_at,
          s.updated_at,
          jsonb_build_object(
            'program_id',
            p.program_id,
            'program_name',
            p.program_name,
            'program_type',
            p.program_type,
            'total_credits',
            p.total_credits
          ) as program,
          (
            select
              jsonb_build_object(
                'invitation_id',
                i.invitation_id,
                'email',
                i.email,
                'expires_at',
                i.expires_at,
                'status',
                i.status,
                'user_type',
                i.user_type,
                'created_at',
                i.created_at,
                'updated_at',
                i.updated_at
              )
            from
              invitations i
            where
              i.user_type = 'STUDENT'
              and
              i.email = s.email
            order by
              i.expires_at asc
            limit 1
          ) as invitation,
          (
            case
              when srs.student_id is null then null
            else
              jsonb_build_object(
                'registrar_id',
                r.registrar_id,
                'first_name',
                r.first_name,
                'last_name',
                r.last_name,
                'email',
                r.email,
                'profile_picture',
                r.profile_picture,
                'is_suspended',
                r.is_suspended,
                'is_deactivated',
                r.is_deactivated
              )
            end
          ) as registrar,
          (
            case
            when ss.session_status = 'ACTIVE' and r.registrar_id is null then
              true
            else
              false
            end
          ) as can_claim,
          coalesce(
            (
              select
                count(pc.course_id)
              from
                program_courses pc
              where
                pc.program_id = s.program_id
              limit 1
            ),
            0
          ) as program_course_count
        from
          students s
        inner join
          programs p
          on (
            p.program_id = s.program_id
          )
        inner join
          session_students sst
          on (
            s.student_id = sst.student_id
          )
        inner join
          sessions ss
          on (
            ss.session_id = sst.session_id
          )
        ${['me', 'others'].includes(assignedTo) ? `inner join` : `left join`}
          student_registrar_sessions srs
          on (
            srs.student_id = s.student_id
            and
            srs.session_id = ss.session_id
          )
        left join
          registrars r
          on (
            srs.registrar_id = r.registrar_id
          )
        where
          ss.session_id = ${sessionId}
          and
          ${
            assignedTo === 'me'
              ? `srs.registrar_id = ${registrarId}`
              : assignedTo === 'none'
                ? `srs.registrar_id is null`
                : assignedTo === 'others'
                  ? `srs.registrar_id <> ${registrarId}`
                  : 's.student_id > 0'
          }
        group by
          s.student_id,
          p.program_id,
          ss.session_id,
          srs.student_id,
          r.registrar_id
        order by
          s.updated_at desc,
          s.created_at desc,
          s.student_id desc
        limit 
          ${paginationInputOpts.limit}
        offset
          ${paginationInputOpts.offset}
      `;

      const prismaSql = Prisma.sql([sql]);
      const students = await this.sharedSessionService.prismaClient.$queryRaw<StudentWithRegistrar[]>(prismaSql);

      if (!students.length) {
        this.logger.warn('No students found in the database');
        return [];
      }

      return students.map((s) => {
        s.program_course_count = bignumber(s.program_course_count).toNumber();
        return s;
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(`Error fetching all students: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch students');
    }
  }

  async findOne(options: {
    id: number | string;
    role: 'admin' | 'registrar';
    roleId: string | number;
  }): Promise<StudentWithRegistrar> {
    const { role, roleId, id: studentId } = options;

    try {
      const sql = `
        select
          s.student_id,
          s.reg_number,
          s.first_name,
          s.last_name,
          s.email,
          s.profile_picture,
          s.program_id,
          s.status,
          s.created_at,
          s.updated_at,
          jsonb_build_object(
            'program_id',
            p.program_id,
            'program_name',
            p.program_name,
            'program_type',
            p.program_type,
            'total_credits',
            p.total_credits
          ) as program,
          (
            select
              jsonb_build_object(
                'invitation_id',
                i.invitation_id,
                'email',
                i.email,
                'expires_at',
                i.expires_at,
                'status',
                i.status,
                'user_type',
                i.user_type,
                'created_at',
                i.created_at,
                'updated_at',
                i.updated_at
              )
            from
              invitations i
            where
              i.user_type = 'STUDENT'
              and
              i.email = s.email
            order by
              i.expires_at asc
            limit 1
          ) as invitation,
          (
            select
              jsonb_build_object(
                'registrar_id',
                r.registrar_id,
                'first_name',
                r.first_name,
                'last_name',
                r.last_name,
                'email',
                r.email,
                'profile_picture',
                r.profile_picture,
                'is_suspended',
                r.is_suspended,
                'is_deactivated',
                r.is_deactivated
              )
            from
              sessions se
            inner join
              student_registrar_sessions srs
              on (
                srs.session_id = se.session_id
              )
            inner join
              students "is"
              on (
                "is"."student_id" = srs."student_id"
              )
            inner join
              registrars r
              on (
                srs.registrar_id = r.registrar_id
              )
            where
              se.session_status = 'ACTIVE'
              and
              "is"."student_id" = s."student_id"
            limit 1
          ) as registrar,
          (
            exists (
              select
                1
              from 
                sessions se
              inner join
                session_students st
                on (
                  se.session_id = st.session_id
                )
              where
                se.session_status = 'ACTIVE'
                and
                st.student_id = s.student_id
              limit 1
            )
            and 
            not exists (
              select
                1
              from
                sessions se
              inner join
                student_registrar_sessions srs
                on (
                  srs.session_id = se.session_id
                )
              inner join
                students "is"
                on (
                  "is"."student_id" = srs."student_id"
                )
              where
                se.session_status = 'ACTIVE'
                and
                "is"."student_id" = s."student_id"
              limit 1
            )
          ) as can_claim,
          coalesce(
            (
              select
                count(pc.course_id)
              from
                program_courses pc
              where
                pc.program_id = s.program_id
              limit 1
            ),
            0
          ) as program_course_count
        from
          students s
        inner join
          programs p
          on (
            p.program_id = s.program_id
          )
        where
          s.student_id = ${studentId}
        limit 1
      `;

      const prismaSql = Prisma.sql([sql]);
      const studentTuple = await this.sharedSessionService.prismaClient.$queryRaw<[StudentWithRegistrar]>(prismaSql);

      if (!studentTuple.length) {
        this.logger.warn('No student found in the database');
        throw new NotFoundException(`Ooops.. student record is not available at the moment`);
      }

      studentTuple[0].program_course_count = bignumber(studentTuple[0].program_course_count).toNumber();
      return studentTuple[0];
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error fetching student ${studentId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch student');
    }
  }

  async update(student_id: number, updateStudentDto: UpdateStudentDto, accessToken: string): Promise<Student> {
    try {
      // First verify student exists
      const supabase = await this.supabaseService.getClientWithAuth(accessToken);
      await supabase
        .from('students')
        .select(
          `
            studuent_id
          `,
        )
        .eq('student_id', student_id)
        .limit(1)
        .single();

      // If email is being updated, check if it's already in use
      if (updateStudentDto.email) {
        const existingStudent = (await this.supabaseService.select(accessToken, 'students', {
          filter: {
            email: updateStudentDto.email,
            student_id: { not: student_id },
          },
        })) as unknown as Student[];

        if (existingStudent && existingStudent.length > 0) {
          throw new BadRequestException(`Email ${updateStudentDto.email} is already in use`);
        }
      }

      // If program_id is being updated, verify it exists
      if (updateStudentDto.program_id) {
        const program = (await this.supabaseService.select(accessToken, 'programs', {
          filter: { program_id: updateStudentDto.program_id },
        })) as unknown as any[];

        if (!program || program.length === 0) {
          throw new BadRequestException(`Program with ID ${updateStudentDto.program_id} not found`);
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
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating student ${student_id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update student');
    }
  }

  async inviteStudent(inviteDto: InviteStudentDto, accessToken: string): Promise<StudentResponse> {
    let invitationId: number | null = null;
    try {
      const { email, reg_number, program_id } = inviteDto;

      // Check if student with this reg_number already exists
      const existingStudent = (await this.supabaseService.select(accessToken, 'students', {
        filter: { reg_number },
      })) as unknown as Student[];

      if (existingStudent && existingStudent.length > 0) {
        throw new BadRequestException(`A student with registration number ${reg_number} already exists`);
      }

      // Check if invitation already exists for this email with PENDING status
      const existingInvitation = (await this.supabaseService.select(accessToken, 'invitations', {
        filter: {
          email,
          status: InvitationStatus.PENDING,
        },
      })) as unknown as any[];

      if (existingInvitation && existingInvitation.length > 0) {
        throw new BadRequestException(`An invitation for ${email} already exists and is pending`);
      }

      // Check if program exists
      const program = (await this.supabaseService.select(accessToken, 'programs', {
        filter: { program_id },
      })) as unknown as any[];

      if (!program || program.length === 0) {
        throw new BadRequestException(`Program with ID ${program_id} not found`);
      }

      // Generate safe UUID for token
      const token = safeUuidv4();

      // Create new invitation
      const invitation = (await this.supabaseService.insert(accessToken, 'invitations', {
        email,
        token,
        user_type: UserType.STUDENT,
        status: InvitationStatus.PENDING,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        updated_at: new Date().toISOString(),
      })) as unknown as any[];

      if (!invitation || invitation.length === 0) {
        throw new InternalServerErrorException('Failed to create invitation');
      }

      // Store invitation ID for potential rollback
      invitationId = invitation[0].invitation_id;

      // Create student record with minimal information
      const student = (await this.supabaseService.insert(accessToken, 'students', {
        reg_number,
        email,
        program_id,
        updated_at: new Date().toISOString(),
      })) as unknown as Student[];

      if (!student || student.length === 0) {
        throw new InternalServerErrorException('Failed to create student record');
      }
      const encodedEmail = encodeURIComponent(encodeEmail(email));
      const number = encodeURIComponent(encodeEmail(reg_number));

      const link = `${process.env.APP_BASE_URL}/accept-student?token=${token}&email=${encodedEmail}&cuce_unique_stdId=${number}`;

      await sendEmail({
        to: email,
        subject: 'You have been invited as a Student',
        template: 'student-invite.html',
        context: {
          email,
          reg_number,
          token,
          link,
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
          this.logger.error(`Failed to rollback invitation creation: ${rollbackError.message}`, rollbackError.stack);
        }
      }

      // Rethrow known NestJS exceptions
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(`Error inviting student: ${error.message}`, error.stack);

      // Handle unexpected errors
      throw new InternalServerErrorException(`Failed to invite student: ${error.message}`);
    }
  }

  async getStudentStats(student_id: number, accessToken: string): Promise<StudentStats> {
    try {
      // Get all enrollments for this student with course data in a single query
      const enrollments = (await this.supabaseService.select(accessToken, 'enrollments', {
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
      })) as unknown as Array<{
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
      const activeSession = (await this.supabaseService.select(accessToken, 'sessions', {
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
      })) as unknown as Array<{
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
          acc[enrollment.enrollment_status] = (acc[enrollment.enrollment_status] || 0) + 1;
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
        const sessionEnrollments = enrollments.filter((e) => e.session_id === activeSession[0].session_id);

        const sessionEnrollmentsByStatus = sessionEnrollments.reduce(
          (acc, enrollment) => {
            acc[enrollment.enrollment_status] = (acc[enrollment.enrollment_status] || 0) + 1;
            return acc;
          },
          {} as Record<EnrollmentStatus, number>,
        );

        const sessionTotalCredits = sessionEnrollments
          .filter((e) => e.enrollment_status === 'APPROVED' || e.enrollment_status === 'COMPLETED')
          .reduce((acc, enrollment) => acc + enrollment.course.course_credits, 0);

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
      this.logger.error(`Error fetching stats for student ${student_id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch student stats');
    }
  }

  async getStudentSessions(student_id: number | string) {
    try {
      // Validate student_id
      if (!isNumeric(student_id)) {
        throw new BadRequestException('Invalid student ID');
      }

      const sessions = await this.sharedSessionService.prismaClient.$queryRaw<
        Pick<
          sessions,
          'session_id' | 'session_name' | 'start_date' | 'end_date' | 'enrollment_deadline' | 'session_status'
        >[]
      >`
        select
          s.session_id,
          s.session_name,
          s.start_date,
          s.end_date,
          s.enrollment_deadline,
          s.session_status
        from
          sessions s
        inner join
          session_students st
          on (
            s.session_id = st.session_id
          )
        where
          st.student_id = ${student_id}
      `;

      // Check if there are any sessions
      if (!sessions) {
        throw new NotFoundException(`No sessions found for student ${student_id}`);
      }

      return sessions;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error fetching sessions for student ${student_id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error fetching sessions for student ${student_id}: ${error.message}`);
    }
  }

  async getStudentSessionCourses(session_id: number | string, student_id: number | string) {
    try {
      // Validate session_id
      if (!isNumeric(session_id)) {
        throw new BadRequestException('Invalid session ID');
      }

      // Validate student_id
      if (!isNumeric(student_id)) {
        throw new BadRequestException('Invalid student ID');
      }

      const courses = await this.courseService.getStudentCoursesInSessionsUsingId(student_id, [session_id], true);

      // Check if there are any sessions
      if (!courses) {
        throw new NotFoundException(`No courses found for student ${student_id} in session ${session_id}`);
      }

      return courses;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error fetching courses for student ${student_id} in session ${session_id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error fetching sessions for student ${student_id} in session ${session_id}: ${error.message}`,
      );
    }
  }

  async getStudentProgramCourses(student_id: number | string) {
    try {
      // Validate student_id
      if (!isNumeric(student_id)) {
        throw new BadRequestException('Invalid student ID');
      }

      const courses = await this.courseService.getStudentProgramCoursesUsingId(student_id);

      // Check if there are any sessions
      if (!courses) {
        throw new NotFoundException(`No courses found for student ${student_id} program`);
      }

      return courses;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error fetching courses for student ${student_id} program: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error fetching sessions for student ${student_id} program: ${error.message}`,
      );
    }
  }

  async claimStudent(options: {
    studentId: number | string;
    registrarId: string | number;
    role: 'admin' | 'registrar';
    roleId: string | number;
  }) {
    const { role, studentId } = options;
    console.log('Claim optons ====> ', options);
    const [student, registraResp] = await Promise.all([
      this.findOne({
        id: studentId,
        role: 'registrar',
        roleId: options.registrarId,
      }),
      this.sharedSessionService.prismaClient.$queryRaw<
        [
          {
            registrar_id: string | number;
            active_session_id: string | number | null;
          } | null,
        ]
      >`
        select 
          r.registrar_id,
          (
            select 
              s.session_id
            from 
              sessions s
            where 
              s.session_status = 'ACTIVE'
            limit 1
          ) as active_session_id
        from 
          registrars r
        where 
          r.registrar_id = ${Number(options.registrarId)}
        limit 1
      `,
    ]);

    console.log('Claim fetch results ====> ', {
      student,
      registraResp,
    });

    if (!student) {
      throw new NotFoundException(`Selected student data is invalid`);
    }

    if (!registraResp.length) {
      throw new BadRequestException(`Registrar data is invalid`);
    }

    const activeSessionId = registraResp[0]?.active_session_id;
    if (!activeSessionId) {
      throw new BadRequestException(`There is currently no active session`);
    }

    if (role === 'registrar' && !student.can_claim) {
      throw new BadRequestException(`Selected student is already claimed for this academic session`);
    }

    const prismaSql = Prisma.sql([
      `
        insert into student_registrar_sessions (student_id, registrar_id, session_id, updated_at)
        values (${studentId}, ${options.registrarId}, ${activeSessionId}, now())
        on conflict (student_id, registrar_id, session_id) do update
        set
          registrar_id = EXCLUDED.registrar_id,
          updated_at = now();
      `,
    ]);

    const noOfRowsAffected = await this.sharedSessionService.prismaClient.$executeRaw(prismaSql);

    return noOfRowsAffected;
  }

  async acceptStudentInvite(dto: AcceptStudentInviteDto, file?: MulterFile) {
    const { email, password, first_name, last_name, reg_number, token } = dto;

    try {
      const { data: invitation, error: invitationError } = await this.adminClient
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
      const expiryDate = new Date(invitationDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (new Date() > expiryDate) {
        throw new UnauthorizedException('Invitation has expired');
      }

      const { data: existingStudent } = await this.adminClient
        .from('students')
        .select('email')
        .or(`email.eq.${email},reg_number.eq.${reg_number}`)
        .maybeSingle();

      if (!existingStudent) {
        throw new ConflictException('Student with this email or registration number not found');
      }

      const { data: authData, error: authError } = await this.supabase.auth.signUp({
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
        throw new InternalServerErrorException(`Auth user creation failed: ${authError.message}`);
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
        throw new InternalServerErrorException(`Student creation failed: ${studentError.message}`);
      }

      const { error: roleError } = await this.adminClient.from('user_roles').insert({
        user_id: userId,
        role: 'STUDENT',
        updated_at: new Date().toISOString(),
      });

      if (roleError) {
        throw new InternalServerErrorException(`User role creation failed: ${roleError.message}`);
      }

      const { error: updateInvitationError } = await this.adminClient
        .from('invitations')
        .update({
          status: 'ACCEPTED',
          updated_at: new Date().toISOString(),
        })
        .eq('invitation_id', invitation.invitation_id);

      if (updateInvitationError) {
        this.logger.error('Failed to update invitation status:', updateInvitationError.message);
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

      throw new InternalServerErrorException('Failed to accept student invitation');
    }
  }

  async rejectStudent(student_id: number, accessToken: string): Promise<{ message: string }> {
    try {
      const response = await this.supabaseService.update(
        accessToken,
        'students',
        { student_id },
        { status: 'REJECTED' },
      );

      if (!response || (Array.isArray(response) && response.length === 0)) {
        throw new NotFoundException(`Student with ID ${student_id} not found or could not be updated`);
      }

      return { message: `Student ${student_id} status updated to REJECTED` };
    } catch (error) {
      this.logger.error(`Error rejecting student ${student_id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to reject student');
    }
  }

  async deleteStudent(student_id: number, accessToken: string): Promise<{ message: string }> {
    try {
      const response = await this.supabaseService.delete(accessToken, 'students', { student_id });

      if (!response || (Array.isArray(response) && response.length === 0)) {
        throw new NotFoundException(`Student with ID ${student_id} not found or could not be deleted`);
      }

      return { message: `Student ${student_id} has been deleted` };
    } catch (error) {
      this.logger.error(`Error deleting student ${student_id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to delete student');
    }
  }
}

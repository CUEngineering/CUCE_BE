import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { File as MulterFile } from 'multer';
import { SupabaseService } from '../../../supabase/supabase.service';
import { UpdateRegistrarDto } from '../dto/update-registrar.dto';
import {
  Invitation,
  InvitationResponse,
} from '../interfaces/invitation.interface';
import {
  Enrollment,
  Registrar,
  RegistrarResponse,
  RegistrarStats,
} from '../types/registrar.types';

import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from 'src/utils/email.helper';
import { AcceptInviteDto } from '../dto/accept-registrar.dto';

function safeUuidv4(): string {
  try {
    return randomUUID();
  } catch {
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

interface EmailDto {
  email: string;
}

@Injectable()
export class RegistrarsService {
  private adminClient: SupabaseClient;
  private readonly logger = new Logger(RegistrarsService.name);

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    private readonly supabaseService: SupabaseService,
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly configService: ConfigService,
  ) {
    // Initialize admin client with service role key
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

  async findAll(accessToken: string): Promise<Registrar[]> {
    const result = (await this.supabaseService.select(
      accessToken,
      'registrars',
      {},
    )) as unknown as Registrar[];

    // Get stats for each registrar
    const registrarsWithStats = await Promise.all(
      result.map(async (registrar) => {
        const stats = await this.getRegistrarStats(
          registrar.registrar_id,
          accessToken,
        );
        return {
          ...registrar,
          stats,
        };
      }),
    );

    return registrarsWithStats;
  }

  async findOne(registrar_id: number, accessToken: string): Promise<Registrar> {
    const result = (await this.supabaseService.select(
      accessToken,
      'registrars',
      {
        filter: { registrar_id },
      },
    )) as unknown as Registrar[];

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `Registrar with ID ${registrar_id} not found`,
      );
    }

    return result[0];
  }

  async update(
    registrar_id: number,
    updateRegistrarDto: UpdateRegistrarDto,
    accessToken: string,
  ): Promise<Registrar> {
    const result = (await this.supabaseService.update(
      accessToken,
      'registrars',
      { registrar_id },
      updateRegistrarDto,
    )) as unknown as Registrar[];

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `Registrar with ID ${registrar_id} not found`,
      );
    }

    return result[0];
  }

  async remove(
    registrar_id: number,
    accessToken: string,
  ): Promise<RegistrarResponse> {
    try {
      // First check if registrar exists and current state
      const registrar = await this.findOne(registrar_id, accessToken);

      if (registrar.is_deactivated) {
        throw new BadRequestException('Registrar is already deactivated');
      }

      const result = (await this.supabaseService.update(
        accessToken,
        'registrars',
        { registrar_id },
        {
          is_deactivated: true,
        },
      )) as unknown as Registrar[];

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      return {
        success: true,
        message: `Registrar with ID ${registrar_id} deactivated successfully`,
        registrar: result[0],
      };
    } catch (error) {
      // Rethrow known NestJS exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Error deactivating registrar ${registrar_id}: ${error.message}`,
        error.stack,
      );

      // Handle unexpected errors
      throw new InternalServerErrorException('Failed to deactivate registrar');
    }
  }

  async inviteRegistrar(
    inviteDto: EmailDto,
    accessToken: string,
  ): Promise<InvitationResponse> {
    const { email } = inviteDto;

    // Check if invitation already exists for this email with PENDING status
    const existingInvitation = (await this.supabaseService.select(
      accessToken,
      'invitations',
      {
        filter: {
          email,
          status: 'PENDING',
        },
      },
    )) as unknown as Invitation[];

    if (existingInvitation && existingInvitation.length > 0) {
      throw new BadRequestException(
        `An invitation for ${email} already exists and is pending`,
      );
    }

    // Generate safe UUIDs
    const token = safeUuidv4();

    // Create new invitation
    const invitation = (await this.supabaseService.insert(
      accessToken,
      'invitations',
      {
        email,
        token,
        user_type: 'REGISTRAR',
        status: 'PENDING',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        updated_at: new Date().toISOString(),
      },
    )) as unknown as Invitation[];

    await sendEmail({
      to: email,
      subject: 'You have been invited as a Registrar',
      template: 'registrar-invite.html',
      context: {
        email,
        token,
        link: `${process.env.APP_BASE_URL}/accept-invite?token=${token}`,
      },
    });

    return {
      success: true,
      message: `Invitation sent to ${email}`,
      invitation: invitation[0],
    };
  }

  async suspend(
    registrar_id: number,
    accessToken: string,
  ): Promise<RegistrarResponse> {
    try {
      // First check if registrar exists and current state
      const registrar = await this.findOne(registrar_id, accessToken);

      if (registrar.is_suspended) {
        throw new BadRequestException('Registrar is already suspended');
      }

      const result = (await this.supabaseService.update(
        accessToken,
        'registrars',
        { registrar_id },
        {
          is_suspended: true,
        },
      )) as unknown as Registrar[];

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      return {
        success: true,
        message: 'Registrar suspended successfully',
        registrar: result[0],
      };
    } catch (error) {
      // Rethrow known NestJS exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Error suspending registrar ${registrar_id}: ${error.message}`,
        error.stack,
      );

      // Handle unexpected errors
      throw new InternalServerErrorException(
        `Failed to suspend registrar: ${error}`,
      );
    }
  }

  async liftSuspension(
    registrar_id: number,
    accessToken: string,
  ): Promise<RegistrarResponse> {
    try {
      // First check if registrar exists and current state
      const registrar = await this.findOne(registrar_id, accessToken);

      if (!registrar.is_suspended) {
        throw new BadRequestException('Registrar is not suspended');
      }

      const result = (await this.supabaseService.update(
        accessToken,
        'registrars',
        { registrar_id },
        {
          is_suspended: false,
        },
      )) as unknown as Registrar[];

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      return {
        success: true,
        message: 'Registrar suspension lifted successfully',
        registrar: result[0],
      };
    } catch (error) {
      // Rethrow known NestJS exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Error lifting suspension for registrar ${registrar_id}: ${error.message}`,
        error.stack,
      );

      // Handle unexpected errors
      throw new InternalServerErrorException(
        'Failed to lift registrar suspension',
      );
    }
  }

  async getRegistrarStats(
    registrar_id: number,
    accessToken: string,
  ): Promise<RegistrarStats> {
    // Verify registrar exists
    await this.findOne(registrar_id, accessToken);

    // Get all enrollments for this registrar
    const enrollments = (await this.supabaseService.select(
      accessToken,
      'enrollments',
      {
        filter: { registrar_id },
      },
    )) as unknown as Enrollment[];

    // Get unique sessions
    const uniqueSessions = [...new Set(enrollments.map((e) => e.session_id))];

    const activeEnrollments = enrollments.filter(
      (e) => e.enrollment_status === 'ACTIVE',
    );

    const completedEnrollments = enrollments.filter(
      (e) => e.enrollment_status === 'COMPLETED',
    );

    const approvedEnrollments = enrollments.filter(
      (e) => e.enrollment_status === 'APPROVED',
    );

    const rejectedEnrollments = enrollments.filter(
      (e) => e.enrollment_status === 'REJECTED',
    );

    const cancelledEnrollments = enrollments.filter(
      (e) => e.enrollment_status === 'CANCELLED',
    );

    return {
      totalSessions: uniqueSessions.length,
      totalEnrollments: enrollments.length,
      activeEnrollments: activeEnrollments.length,
      completedEnrollments: completedEnrollments.length,
      cancelledEnrollments: cancelledEnrollments.length,
      approvedEnrollments: approvedEnrollments.length,
      rejectedEnrollments: rejectedEnrollments.length,
    };
  }

  async resendInvitation(
    email: string,
    accessToken: string,
  ): Promise<InvitationResponse> {
    const invitations = (await this.supabaseService.select(
      accessToken,
      'invitations',
      {
        filter: {
          email,
          status: 'PENDING',
        },
      },
    )) as unknown as Invitation[];

    if (!invitations.length) {
      throw new NotFoundException(`No pending invitation found for ${email}`);
    }

    const invitation = invitations[0];

    const token = safeUuidv4();
    const updatedInvitation = (await this.supabaseService.update(
      accessToken,
      'invitations',
      {
        token,
        updated_at: new Date().toISOString(),
      },
      { email, status: 'PENDING' },
    )) as unknown as Invitation[];

    await sendEmail({
      to: email,
      subject: 'Resent Invitation as a Registrar',
      template: 'registrar-invite.html',
      context: {
        email,
        token,
        link: `${process.env.APP_BASE_URL}/accept-invite?token=${token}`,
      },
    });

    return {
      success: true,
      message: `Invitation resent to ${email}`,
      invitation: updatedInvitation[0],
    };
  }

  async deleteInvitation(
    email: string,
    accessToken: string,
  ): Promise<{ success: boolean; message: string }> {
    const invitations = (await this.supabaseService.select(
      accessToken,
      'invitations',
      {
        filter: {
          email,
          status: 'PENDING',
        },
      },
    )) as unknown as Invitation[];

    if (!invitations.length) {
      throw new NotFoundException(`No pending invitation found for ${email}`);
    }

    await this.supabaseService.delete(accessToken, 'invitations', {
      email,
      status: 'PENDING',
    });

    return {
      success: true,
      message: `Pending invitation for ${email} has been deleted.`,
    };
  }

  async acceptInvite(dto: AcceptInviteDto, file?: MulterFile) {
    const { email, password, first_name, last_name, token } = dto;

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

      const { data: existingRegistrar } = await this.adminClient
        .from('registrars')
        .select('email')
        .eq('email', email)
        .single();

      if (existingRegistrar) {
        throw new ConflictException('Registrar with this email already exists');
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

      const { data: registrar, error: registrarError } = await this.adminClient
        .from('registrars')
        .insert({
          first_name: first_name,
          last_name: last_name,
          email: email,
          profile_picture: profileUrl || null,
          user_id: userId,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (registrarError) {
        await this.supabase.auth.admin.deleteUser(userId);
        throw new InternalServerErrorException(
          `Registrar creation failed: ${registrarError.message}`,
        );
      }

      const { error: roleError } = await this.adminClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'REGISTRAR',
        });
      if (roleError) {
        await this.adminClient
          .from('registrars')
          .delete()
          .eq('user_id', userId);
        await this.supabase.auth.admin.deleteUser(userId);
        throw new InternalServerErrorException(
          `User role creation failed: ${roleError.message}`,
        );
      }
      const { error: updateInvitationError } = await this.adminClient
        .from('invitations')
        .update({
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (updateInvitationError) {
        console.error(
          'Failed to update invitation status:',
          updateInvitationError,
        );
      }
      return {
        user: {
          registrar_id: registrar.registrar_id,
          first_name: registrar.first_name,
          last_name: registrar.last_name,
          email: registrar.email,
          profilePicture: registrar.profile_picture,
          user_id: registrar.user_id,
        },
        session: authData.session,
        role: 'REGISTRAR',
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to accept invitation');
    }
  }
}

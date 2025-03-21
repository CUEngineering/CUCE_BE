import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { UpdateRegistrarDto } from '../dto/update-registrar.dto';
import {
  Invitation,
  InvitationResponse,
} from '../interfaces/invitation.interface';
import { randomUUID } from 'crypto';
import {
  Registrar,
  Enrollment,
  RegistrarStats,
  RegistrarResponse,
} from '../types/registrar.types';

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
  private readonly logger = new Logger(RegistrarsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

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
          suspended_at: new Date().toISOString(),
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
      throw new InternalServerErrorException('Failed to suspend registrar');
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

    const cancelledEnrollments = enrollments.filter(
      (e) => e.enrollment_status === 'CANCELLED',
    );

    return {
      totalSessions: uniqueSessions.length,
      totalEnrollments: enrollments.length,
      activeEnrollments: activeEnrollments.length,
      completedEnrollments: completedEnrollments.length,
      cancelledEnrollments: cancelledEnrollments.length,
    };
  }
}

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { CreateRegistrarDto } from '../dto/create-registrar.dto';
import { UpdateRegistrarDto } from '../dto/update-registrar.dto';
import {
  Invitation,
  InvitationResponse,
} from '../interfaces/invitation.interface';
import { randomUUID } from 'crypto';

interface Enrollment {
  enrollment_id: string;
  enrollment_status: string;
  session_id: string;
}

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
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(accessToken: string) {
    return this.supabaseService.select(accessToken, 'registrars', {});
  }

  async findOne(registrar_id: string, accessToken: string) {
    const result = await this.supabaseService.select(
      accessToken,
      'registrars',
      {
        filter: { registrar_id },
      },
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `Registrar with ID ${registrar_id} not found`,
      );
    }

    return result[0];
  }

  async create(createRegistrarDto: CreateRegistrarDto, accessToken: string) {
    const id = safeUuidv4();
    return this.supabaseService.insert(accessToken, 'registrars', {
      ...createRegistrarDto,
      registrar_id: id,
    });
  }

  async update(
    registrar_id: string,
    updateRegistrarDto: UpdateRegistrarDto,
    accessToken: string,
  ) {
    const result = await this.supabaseService.update(
      accessToken,
      'registrars',
      { registrar_id },
      updateRegistrarDto,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `Registrar with ID ${registrar_id} not found`,
      );
    }

    return result[0];
  }

  async remove(registrar_id: string, accessToken: string) {
    const result = await this.supabaseService.delete(
      accessToken,
      'registrars',
      { registrar_id },
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `Registrar with ID ${registrar_id} not found`,
      );
    }

    return {
      success: true,
      message: `Registrar with ID ${registrar_id} removed successfully`,
    };
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
    const invitation_id = safeUuidv4();
    const token = safeUuidv4();

    // Create new invitation
    const invitation = (await this.supabaseService.insert(
      accessToken,
      'invitations',
      {
        invitation_id,
        email,
        token,
        user_type: 'REGISTRAR',
        status: 'PENDING',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    )) as unknown as Invitation[];

    return {
      success: true,
      message: `Invitation sent to ${email}`,
      invitation: invitation[0],
    };
  }

  async suspend(registrar_id: string, accessToken: string) {
    const result = await this.supabaseService.update(
      accessToken,
      'registrars',
      { registrar_id },
      { is_suspended: true },
    );

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
  }

  async liftSuspension(registrar_id: string, accessToken: string) {
    const result = await this.supabaseService.update(
      accessToken,
      'registrars',
      { registrar_id },
      { is_suspended: false },
    );

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
  }

  async getRegistrarStats(registrar_id: string, accessToken: string) {
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

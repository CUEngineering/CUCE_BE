import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRegistrarDto } from '../dto/create-registrar.dto';
import { UpdateRegistrarDto } from '../dto/update-registrar.dto';
import { InviteRegistrarDto } from '../dto/invite-registrar.dto';
import { randomUUID } from 'crypto';

interface PrismaError extends Error {
  code?: string;
}

function isPrismaError(error: unknown): error is PrismaError {
  return error instanceof Error && 'code' in error;
}

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Function to safely generate a UUID
 */
function safeUuidv4(): string {
  try {
    // Use Node.js built-in crypto module which has proper typing
    return randomUUID();
  } catch {
    // Extremely unlikely, but just in case
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

@Injectable()
export class RegistrarsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    try {
      return await this.prisma.registrar.findMany({
        include: {
          // The Prisma schema doesn't have a User model
          // Instead, we need to use appropriate fields from the Registrar model
        },
      });
    } catch (error) {
      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to find registrars: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while finding registrars',
      );
    }
  }

  async findOne(registrar_id: string) {
    try {
      const registrar = await this.prisma.registrar.findUnique({
        where: { registrar_id },
      });

      if (!registrar) {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      return registrar;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to find registrar: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while finding registrar',
      );
    }
  }

  async create(createRegistrarDto: CreateRegistrarDto) {
    try {
      const id = safeUuidv4();

      const registrar = await this.prisma.registrar.create({
        data: {
          ...createRegistrarDto,
          registrar_id: id,
        },
      });

      return registrar;
    } catch (error) {
      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to create registrar: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while creating registrar',
      );
    }
  }

  async update(registrar_id: string, updateRegistrarDto: UpdateRegistrarDto) {
    try {
      const registrar = await this.prisma.registrar.update({
        where: { registrar_id },
        data: updateRegistrarDto,
      });

      return registrar;
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2025') {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to update registrar: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while updating registrar',
      );
    }
  }

  async remove(registrar_id: string) {
    try {
      await this.prisma.registrar.delete({
        where: { registrar_id },
      });

      return {
        success: true,
        message: `Registrar with ID ${registrar_id} removed successfully`,
      };
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2025') {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to remove registrar: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while removing registrar',
      );
    }
  }

  async inviteRegistrar(inviteDto: InviteRegistrarDto) {
    try {
      const { email } = inviteDto;

      // Check if invitation already exists for this email with PENDING status
      const existingInvitation = await this.prisma.invitation.findFirst({
        where: {
          email,
          status: 'PENDING',
        },
      });

      if (existingInvitation) {
        throw new BadRequestException(
          `An invitation for ${email} already exists and is pending`,
        );
      }

      // Generate safe UUIDs
      const invitation_id = safeUuidv4();
      const token = safeUuidv4();

      // Create new invitation
      const invitation = await this.prisma.invitation.create({
        data: {
          invitation_id,
          email,
          token,
          user_type: 'REGISTRAR',
          status: 'PENDING',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return {
        success: true,
        message: `Invitation sent to ${email}`,
        invitation,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to invite registrar: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while inviting registrar',
      );
    }
  }

  async cancelInvitation(invitation_id: string) {
    try {
      // Check if invitation exists and is pending
      const invitation = await this.prisma.invitation.findUnique({
        where: { invitation_id },
      });

      if (!invitation) {
        throw new NotFoundException(
          `Invitation with ID ${invitation_id} not found`,
        );
      }

      if (invitation.status !== 'PENDING') {
        throw new BadRequestException(
          `Invitation is ${invitation.status.toLowerCase()}, cannot be cancelled`,
        );
      }

      // Update invitation status
      await this.prisma.invitation.update({
        where: { invitation_id },
        data: {
          status: 'CANCELLED',
        },
      });

      return {
        success: true,
        message: `Invitation cancelled successfully`,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to cancel invitation: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while cancelling invitation',
      );
    }
  }

  async suspend(registrar_id: string) {
    try {
      const registrar = await this.prisma.registrar.update({
        where: { registrar_id },
        data: {
          is_suspended: true,
        },
      });

      return {
        success: true,
        message: `Registrar suspended successfully`,
        registrar,
      };
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2025') {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to suspend registrar: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while suspending registrar',
      );
    }
  }

  async liftSuspension(registrar_id: string) {
    try {
      const registrar = await this.prisma.registrar.update({
        where: { registrar_id },
        data: {
          is_suspended: false,
        },
      });

      return {
        success: true,
        message: `Registrar suspension lifted successfully`,
        registrar,
      };
    } catch (error) {
      if (isPrismaError(error) && error.code === 'P2025') {
        throw new NotFoundException(
          `Registrar with ID ${registrar_id} not found`,
        );
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to lift suspension: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while lifting suspension',
      );
    }
  }

  async getRegistrarStats(registrar_id: string) {
    try {
      // Verify registrar exists
      await this.findOne(registrar_id);

      // Instead of finding sessions directly, we'll find the sessions through enrollments
      const enrollments = await this.prisma.enrollment.findMany({
        where: { registrar_id },
        include: {
          session: true,
        },
      });

      // Get unique sessions from enrollments
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
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (isError(error)) {
        throw new InternalServerErrorException(
          `Failed to get registrar stats: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while getting registrar stats',
      );
    }
  }
}

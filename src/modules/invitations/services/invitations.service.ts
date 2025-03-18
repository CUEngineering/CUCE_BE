import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { randomUUID } from 'crypto';

// Define custom Invitation type based on Prisma schema
export type Invitation = {
  invitation_id: string;
  email: string;
  token: string;
  expires_at: Date;
  status: string;
  user_type: string;
  student_id?: string | null;
  registrar_id?: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Type guard to check if a value is an Error
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to verify AcceptInvitationDto properties
 */
function hasRequiredDtoProperties(
  dto: AcceptInvitationDto,
): dto is AcceptInvitationDto & {
  firstName: string;
  lastName: string;
  password: string;
} {
  return (
    typeof dto.firstName === 'string' &&
    typeof dto.lastName === 'string' &&
    typeof dto.password === 'string'
  );
}

/**
 * Function to safely generate a UUID
 */
function safeUuidv4(): string {
  try {
    // Use Node.js built-in crypto module which has proper typing
    return randomUUID();
  } catch {
    // Fallback mechanism
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string): Promise<Invitation[]> {
    try {
      const where: Record<string, any> = {};

      if (status) {
        where.status = status.toUpperCase();
      }

      return await this.prisma.invitation.findMany({
        where,
        orderBy: {
          created_at: 'desc',
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to find invitations: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while finding invitations',
      );
    }
  }

  async findOne(invitation_id: string): Promise<Invitation> {
    try {
      const invitation = await this.prisma.invitation.findUnique({
        where: { invitation_id },
      });

      if (!invitation) {
        throw new NotFoundException(
          `Invitation with ID ${invitation_id} not found`,
        );
      }

      return invitation;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to find invitation: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while finding invitation',
      );
    }
  }

  async acceptInvitation(
    invitation_id: string,
    dto: AcceptInvitationDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const invitation = await this.findOne(invitation_id);

      if (invitation.status !== 'PENDING') {
        throw new BadRequestException(
          `Invitation is ${invitation.status.toLowerCase()}, cannot be accepted`,
        );
      }

      // Update invitation status
      await this.prisma.invitation.update({
        where: { invitation_id },
        data: {
          status: 'ACCEPTED',
        },
      });

      // If this is a registrar invitation, create the registrar record
      if (invitation.user_type === 'REGISTRAR') {
        const registrar_id = safeUuidv4();

        // Validate DTO has required properties
        if (!hasRequiredDtoProperties(dto)) {
          throw new BadRequestException(
            'Missing required fields in invitation acceptance',
          );
        }

        await this.prisma.registrar.create({
          data: {
            registrar_id,
            email: invitation.email,
            first_name: dto.firstName,
            last_name: dto.lastName,
            // We would normally set user_id here to link to auth system
          },
        });

        return {
          success: true,
          message: 'Registrar account created successfully',
        };
      }

      // Handle other user types as needed

      return {
        success: true,
        message: 'Invitation accepted successfully',
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
          `Failed to accept invitation: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while accepting invitation',
      );
    }
  }

  async resendInvitation(invitation_id: string) {
    try {
      const invitation = await this.findOne(invitation_id);

      if (invitation.status !== 'PENDING') {
        throw new BadRequestException(
          `Invitation is ${invitation.status.toLowerCase()}, cannot be resent`,
        );
      }

      // Generate new token
      const token = safeUuidv4();

      // Update invitation with new token and expiration date
      const updatedInvitation = await this.prisma.invitation.update({
        where: { invitation_id },
        data: {
          token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return {
        success: true,
        message: `Invitation resent to ${invitation.email}`,
        invitation: updatedInvitation,
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
          `Failed to resend invitation: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while resending invitation',
      );
    }
  }

  async cancelInvitation(invitation_id: string) {
    try {
      const invitation = await this.findOne(invitation_id);

      if (invitation.status !== 'PENDING') {
        throw new BadRequestException(
          `Invitation is ${invitation.status.toLowerCase()}, cannot be cancelled`,
        );
      }

      const updatedInvitation = await this.prisma.invitation.update({
        where: { invitation_id },
        data: {
          status: 'CANCELLED',
        },
      });

      return {
        success: true,
        message: `Invitation to ${invitation.email} has been cancelled`,
        invitation: updatedInvitation,
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
          `Failed to cancel invitation: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while cancelling invitation',
      );
    }
  }

  async remove(invitation_id: string) {
    try {
      await this.findOne(invitation_id);

      await this.prisma.invitation.delete({
        where: { invitation_id },
      });

      return {
        success: true,
        message: `Invitation with ID ${invitation_id} has been removed`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to remove invitation: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while removing invitation',
      );
    }
  }

  async validateToken(token: string) {
    try {
      const invitation = await this.prisma.invitation.findFirst({
        where: { token },
      });

      if (!invitation) {
        return {
          valid: false,
          message: 'Invalid invitation token',
        };
      }

      if (invitation.status !== 'PENDING') {
        return {
          valid: false,
          message: `Invitation is ${invitation.status.toLowerCase()}`,
          invitation,
        };
      }

      if (invitation.expires_at < new Date()) {
        // Automatically update to expired
        await this.prisma.invitation.update({
          where: { invitation_id: invitation.invitation_id },
          data: {
            status: 'EXPIRED',
          },
        });

        return {
          valid: false,
          message: 'Invitation has expired',
          invitation: { ...invitation, status: 'EXPIRED' },
        };
      }

      return {
        valid: true,
        message: 'Invitation token is valid',
        invitation,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Failed to validate token: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'An unknown error occurred while validating token',
      );
    }
  }
}

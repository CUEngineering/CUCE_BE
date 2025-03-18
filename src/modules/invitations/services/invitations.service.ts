import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { ResendInvitationDto } from '../dto/resend-invitation.dto';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

/**
 * Function to safely generate a UUID
 */
function safeUuidv4(): string {
  try {
    return uuidv4();
  } catch {
    // Extremely unlikely, but just in case
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
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

  async findOne(invitation_id: string) {
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
    acceptInvitationDto: AcceptInvitationDto,
  ) {
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

      // Since there's no User model in the schema, we need to handle this differently
      // Currently, Registrar and Student models have user_id fields that reference
      // an external authentication system

      // If this is a registrar invitation, create the registrar record
      if (invitation.user_type === 'REGISTRAR') {
        const registrar_id = safeUuidv4();
        const firstName = acceptInvitationDto.firstName;
        const lastName = acceptInvitationDto.lastName;

        await this.prisma.registrar.create({
          data: {
            registrar_id,
            email: invitation.email,
            first_name: firstName,
            last_name: lastName,
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

      if (error instanceof Error) {
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

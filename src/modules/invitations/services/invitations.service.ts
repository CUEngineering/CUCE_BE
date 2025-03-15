import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { ResendInvitationDto } from '../dto/resend-invitation.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string) {
    const where: Record<string, any> = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    return this.prisma.invitation.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    return invitation;
  }

  async acceptInvitation(id: string, acceptInvitationDto: AcceptInvitationDto) {
    try {
      const invitation = await this.findOne(id);

      if (invitation.status !== 'PENDING') {
        return {
          success: false,
          message: `Invitation is ${invitation.status.toLowerCase()}, cannot be accepted`,
        };
      }

      // Update invitation status
      await this.prisma.invitation.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
        },
      });

      // Create user and registrar based on invitation
      const user = await this.prisma.user.create({
        data: {
          id: uuidv4(),
          email: invitation.email,
          firstName: acceptInvitationDto.firstName,
          lastName: acceptInvitationDto.lastName,
          password: acceptInvitationDto.password, // Should be hashed in a real application
          userType: invitation.userType,
        },
      });

      // Create registrar if the invitation was for a registrar
      if (invitation.userType === 'REGISTRAR') {
        await this.prisma.registrar.create({
          data: {
            id: uuidv4(),
            userId: user.id,
          },
        });
      }

      return {
        success: true,
        message: 'Invitation accepted successfully',
        user,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        message: error.message || 'Failed to accept invitation',
      };
    }
  }

  async resendInvitation(id: string, resendInvitationDto: ResendInvitationDto) {
    try {
      const invitation = await this.findOne(id);

      if (invitation.status !== 'PENDING') {
        return {
          success: false,
          message: `Invitation is ${invitation.status.toLowerCase()}, cannot be resent`,
        };
      }

      // Update invitation with new expiration date and token
      const updatedInvitation = await this.prisma.invitation.update({
        where: { id },
        data: {
          token: uuidv4(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return {
        success: true,
        message: `Invitation resent to ${invitation.email}`,
        invitation: updatedInvitation,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        message: error.message || 'Failed to resend invitation',
      };
    }
  }

  async cancelInvitation(id: string) {
    try {
      const invitation = await this.findOne(id);

      if (invitation.status !== 'PENDING') {
        return {
          success: false,
          message: `Invitation is ${invitation.status.toLowerCase()}, cannot be cancelled`,
        };
      }

      const updatedInvitation = await this.prisma.invitation.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      return {
        success: true,
        message: `Invitation to ${invitation.email} has been cancelled`,
        invitation: updatedInvitation,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        message: error.message || 'Failed to cancel invitation',
      };
    }
  }

  async remove(id: string) {
    try {
      await this.findOne(id);

      await this.prisma.invitation.delete({
        where: { id },
      });

      return {
        success: true,
        message: `Invitation with ID ${id} has been removed`,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        message: error.message || 'Failed to remove invitation',
      };
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

      if (invitation.expiresAt < new Date()) {
        return {
          valid: false,
          message: 'Invitation has expired',
          invitation,
        };
      }

      return {
        valid: true,
        message: 'Invitation token is valid',
        invitation,
      };
    } catch (err) {
      const error = err as Error;
      return {
        valid: false,
        message: error.message || 'Failed to validate token',
      };
    }
  }
}

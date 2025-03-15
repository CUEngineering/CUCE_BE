import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InviteRegistrarDto } from '../dto/invite-registrar.dto';
import { v4 as uuidv4 } from 'uuid';

interface UpdateRegistrarDto {
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_picture?: string;
}

@Injectable()
export class RegistrarsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.registrar.findMany({
      include: {
        user: true,
      },
    });
  }

  async findOne(id: string) {
    const registrar = await this.prisma.registrar.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!registrar) {
      throw new NotFoundException(`Registrar with ID ${id} not found`);
    }

    return registrar;
  }

  async update(id: string, updateRegistrarDto: UpdateRegistrarDto) {
    try {
      return await this.prisma.registrar.update({
        where: { id },
        data: updateRegistrarDto,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Registrar with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.registrar.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Registrar with ID ${id} not found`);
      }
      throw error;
    }
  }

  async inviteRegistrar(inviteRegistrarDto: InviteRegistrarDto) {
    try {
      const { email } = inviteRegistrarDto;

      // Check if invitation already exists
      const existingInvitation = await this.prisma.invitation.findFirst({
        where: {
          email,
          status: 'PENDING',
        },
      });

      if (existingInvitation) {
        return {
          success: false,
          message: `An invitation for ${email} already exists`,
          invitation: existingInvitation,
        };
      }

      // Create new invitation
      const invitation = await this.prisma.invitation.create({
        data: {
          id: uuidv4(),
          email,
          token: uuidv4(),
          userType: 'REGISTRAR',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      return {
        success: true,
        message: `Invitation sent to ${email}`,
        invitation,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        message: error.message || 'An unknown error occurred',
        error,
      };
    }
  }

  async cancelInvitation(id: string) {
    try {
      return await this.prisma.invitation.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2025') {
        throw new NotFoundException(`Invitation with ID ${id} not found`);
      }
      throw error;
    }
  }

  async suspendRegistrar(id: string) {
    return this.prisma.registrar.update({
      where: { id },
      data: {
        isSuspended: true,
      },
    });
  }

  async liftSuspension(id: string) {
    return this.prisma.registrar.update({
      where: { id },
      data: {
        isSuspended: false,
      },
    });
  }

  async getRegistrarStats(id: string) {
    const registrar = await this.findOne(id);

    const where: Record<string, any> = {
      registrarId: id,
    };

    const enrollments = await this.prisma.enrollment.findMany({
      where,
      include: {
        session: {
          include: {
            course: true,
          },
        },
      },
    });

    const totalEnrollments = enrollments.length;
    const activeEnrollments = enrollments.filter(
      (e) => e.status === 'ACTIVE',
    ).length;
    const completedEnrollments = enrollments.filter(
      (e) => e.status === 'COMPLETED',
    ).length;
    const cancelledEnrollments = enrollments.filter(
      (e) => e.status === 'CANCELLED',
    ).length;

    return {
      registrar,
      stats: {
        totalEnrollments,
        activeEnrollments,
        completedEnrollments,
        cancelledEnrollments,
      },
    };
  }
}

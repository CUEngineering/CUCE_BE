import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SupabaseService } from '../../../supabase/supabase.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { randomUUID } from 'crypto';
import { InvitationStatus } from '@prisma/client';

/**
 * Clean, simplified invitation service
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Find all invitations with optional status filter
   */
  async findAll(status?: string) {
    try {
      // Validate status input if provided
      if (
        status &&
        !Object.values(InvitationStatus).includes(
          status.toUpperCase() as InvitationStatus,
        )
      ) {
        throw new BadRequestException(`Invalid invitation status: ${status}`);
      }

      // Use a safe record for the where clause with proper typing
      const where: Record<string, any> = {};

      if (status) {
        // Convert the string status to the proper enum
        where.status = status.toUpperCase() as InvitationStatus;
      }

      try {
        const invitations = await this.prisma.invitations.findMany({
          where,
          orderBy: {
            created_at: 'desc',
          },
        });

        return invitations;
      } catch (dbError) {
        // Log detailed database error
        this.logger.error(
          `Database error when finding invitations: ${dbError.message}`,
          dbError.stack,
        );

        // Check for specific Prisma error codes
        if (dbError.code === 'P1001') {
          throw new InternalServerErrorException(
            'Unable to connect to the database',
          );
        }

        throw new InternalServerErrorException(
          `Failed to find invitations: ${dbError.message}`,
        );
      }
    } catch (error) {
      // Rethrow known error types
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Unexpected error during invitation retrieval: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Failed to retrieve invitations: An unexpected error occurred',
      );
    }
  }

  /**
   * Find a single invitation by ID
   */
  async findOne(invitation_id: string) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      // Validate UUID format
      if (!this.isValidUUID(invitation_id)) {
        throw new BadRequestException('Invalid invitation ID format');
      }

      // Attempt to find the invitation
      try {
        const invitation = await this.prisma.invitations.findUnique({
          where: { invitation_id },
        });

        if (!invitation) {
          throw new NotFoundException(
            `Invitation with ID ${invitation_id} not found`,
          );
        }

        return invitation;
      } catch (dbError) {
        // Log detailed database error
        this.logger.error(
          `Database error when finding invitation: ${dbError.message}`,
          dbError.stack,
        );

        // Check for specific Prisma error codes
        if (dbError.code === 'P1001') {
          throw new InternalServerErrorException(
            'Unable to connect to the database',
          );
        }

        throw new InternalServerErrorException(
          `Failed to find invitation: ${dbError.message}`,
        );
      }
    } catch (error) {
      // Rethrow known error types
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Unexpected error during invitation retrieval: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Failed to retrieve invitation: An unexpected error occurred',
      );
    }
  }

  /**
   * Validate invitation token
   */
  async validateToken(token: string) {
    try {
      const invitation = await this.prisma.invitations.findFirst({
        where: { token },
      });

      if (!invitation) {
        return {
          valid: false,
          message: 'Invalid invitation token',
        };
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        return {
          valid: false,
          message: `Invitation is ${invitation.status.toLowerCase()}`,
          invitation,
        };
      }

      if (invitation.expires_at < new Date()) {
        // Automatically update to expired
        await this.prisma.invitations.update({
          where: { invitation_id: invitation.invitation_id },
          data: {
            status: InvitationStatus.EXPIRED,
          },
        });

        return {
          valid: false,
          message: 'Invitation has expired',
          invitation: { ...invitation, status: InvitationStatus.EXPIRED },
        };
      }

      return {
        valid: true,
        message: 'Invitation token is valid',
        invitation,
      };
    } catch (error) {
      this.logger.error(
        `Failed to validate token: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to validate token: ${error.message}`,
      );
    }
  }

  /**
   * Helper method to update invitation status
   */
  private async updateInvitationStatus(
    invitation_id: string,
    status: InvitationStatus,
  ) {
    try {
      return await this.prisma.invitations.update({
        where: { invitation_id },
        data: { status },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update invitation status: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to update invitation status: ${error.message}`,
      );
    }
  }

  /**
   * Accept an invitation with cleaner error handling
   */
  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    try {
      // Step 1: Validate the invitation token
      const validation = await this.validateToken(token);

      if (!validation.valid || !validation.invitation) {
        throw new BadRequestException(validation.message);
      }

      const invitation = validation.invitation;

      // Step 2: Create the user account
      const { user, session } = await this.supabaseService.signUp(
        invitation.email,
        dto.password,
      );

      if (!user || !session) {
        throw new InternalServerErrorException('Failed to create user account');
      }

      // Create a client with the new user's token
      const client = this.supabaseService.getClientWithAuth(
        session.access_token,
      );

      try {
        // Step 3: Try to insert the user role
        const { error: roleError } = await client.from('user_roles').insert({
          user_id: user.id,
          role: invitation.user_type,
        });

        if (roleError) {
          this.logger.warn(
            `Role creation failed with client token: ${roleError.message}`,
          );

          // Try with admin client if RLS blocks it
          const { error: adminRoleError } =
            await this.supabaseService.adminInsert('user_roles', {
              user_id: user.id,
              role: invitation.user_type,
            });

          if (adminRoleError) {
            // Clean up the user if role creation fails
            await this.supabaseService.deleteUser(user.id);
            throw new InternalServerErrorException(
              `Role creation failed: ${adminRoleError.message}`,
            );
          }
        }
      } catch (error) {
        // If role assignment fails, clean up the user
        await this.supabaseService.deleteUser(user.id);
        throw new InternalServerErrorException(
          `Role assignment failed: ${error.message}`,
        );
      }

      // Step 4: Create the appropriate profile based on user type
      try {
        if (invitation.user_type === 'REGISTRAR') {
          // Create registrar profile
          const { data: registrar, error: registrarError } = await client
            .from('registrars')
            .insert({
              registrar_id: randomUUID(),
              email: user.email,
              first_name: dto.firstName,
              last_name: dto.lastName,
              user_id: user.id,
            })
            .select()
            .single();

          if (registrarError) {
            // Try with admin client if needed
            const { data: adminRegistrar, error: adminRegistrarError } =
              await this.supabaseService.adminInsertSingle('registrars', {
                registrar_id: randomUUID(),
                email: user.email,
                first_name: dto.firstName,
                last_name: dto.lastName,
                user_id: user.id,
              });

            if (adminRegistrarError || !adminRegistrar) {
              // Clean up the user
              await this.supabaseService.deleteUser(user.id);
              throw new Error(
                adminRegistrarError?.message ||
                  'Failed to create registrar profile with admin client',
              );
            }

            // Use the admin-created registrar
            const registrarData = adminRegistrar;

            // Step 5: Update the invitation status
            await this.updateInvitationStatus(
              invitation.invitation_id,
              InvitationStatus.ACCEPTED,
            );

            // Return the complete response
            return {
              user: {
                id: user.id,
                email: user.email,
                first_name: dto.firstName,
                last_name: dto.lastName,
                role: invitation.user_type,
              },
              session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              },
              registrar: registrarData,
            };
          }

          if (!registrar) {
            throw new Error('Failed to create registrar profile');
          }

          // Step 5: Update the invitation status
          await this.updateInvitationStatus(
            invitation.invitation_id,
            InvitationStatus.ACCEPTED,
          );

          // Return the complete response
          return {
            user: {
              id: user.id,
              email: user.email,
              first_name: dto.firstName,
              last_name: dto.lastName,
              role: invitation.user_type,
            },
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },
            registrar,
          };
        } else if (invitation.user_type === 'STUDENT') {
          // Handle student creation (implementation left out for brevity)
          throw new BadRequestException(
            'Student registration not implemented yet',
          );
        } else {
          throw new BadRequestException(
            `Unsupported user type: ${invitation.user_type}`,
          );
        }
      } catch (error) {
        // If profile creation fails, clean up the user
        await this.supabaseService.deleteUser(user.id);
        throw new InternalServerErrorException(
          `Profile creation failed: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Invitation acceptance failed: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to accept invitation: ${error.message}`,
      );
    }
  }

  /**
   * Resend an invitation with a new token and expiration date
   */
  async resendInvitation(invitation_id: string) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      // Validate UUID format
      if (!this.isValidUUID(invitation_id)) {
        throw new BadRequestException('Invalid invitation ID format');
      }

      // Attempt to find the invitation
      let invitation;
      try {
        invitation = await this.findOne(invitation_id);
      } catch (findError) {
        // Distinguish between different types of not found errors
        if (findError instanceof NotFoundException) {
          throw findError;
        }

        // Handle potential database connection or network errors
        this.logger.error(
          `Database error when finding invitation: ${findError.message}`,
          findError.stack,
        );
        throw new InternalServerErrorException(
          'Unable to retrieve invitation due to a system error',
        );
      }

      // Check invitation status
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException(
          `Invitation is ${invitation.status.toLowerCase()}, cannot be resent`,
        );
      }

      // Generate new token and update expiry
      const token = randomUUID();
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Attempt to update invitation
      let updatedInvitation;
      try {
        updatedInvitation = await this.prisma.invitations.update({
          where: { invitation_id },
          data: { token, expires_at },
        });
      } catch (updateError) {
        // Log detailed error information
        this.logger.error(
          `Failed to update invitation: ${updateError.message}`,
          updateError.stack,
        );

        // Check for specific error types
        if (updateError.code === 'P2002') {
          throw new InternalServerErrorException(
            'Unique constraint violation during invitation resend',
          );
        }

        // Generic database update error
        throw new InternalServerErrorException(
          `Unable to resend invitation: ${updateError.message}`,
        );
      }

      return {
        success: true,
        message: `Invitation resent to ${invitation.email}`,
        invitation: updatedInvitation,
      };
    } catch (error) {
      // Rethrow known error types
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Unexpected error during invitation resend: ${error.message}`,
        error.stack,
      );

      // Provide a generic error response for unexpected errors
      throw new InternalServerErrorException(
        `Failed to resend invitation: An unexpected error occurred`,
      );
    }
  }

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitation_id: string) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      // Validate UUID format
      if (!this.isValidUUID(invitation_id)) {
        throw new BadRequestException('Invalid invitation ID format');
      }

      // Attempt to find the invitation
      let invitation;
      try {
        invitation = await this.findOne(invitation_id);
      } catch (findError) {
        // Distinguish between different types of not found errors
        if (findError instanceof NotFoundException) {
          throw new NotFoundException(
            `No invitation found with ID ${invitation_id}`,
          );
        }

        // Handle potential database connection or network errors
        this.logger.error(
          `Database error when finding invitation: ${findError.message}`,
          findError.stack,
        );
        throw new InternalServerErrorException(
          'Unable to retrieve invitation due to a system error',
        );
      }

      // Check invitation status
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException(
          `Invitation is ${invitation.status.toLowerCase()}, cannot be cancelled`,
        );
      }

      // Attempt to update invitation status
      let updatedInvitation;
      try {
        updatedInvitation = await this.updateInvitationStatus(
          invitation_id,
          InvitationStatus.CANCELLED,
        );
      } catch (updateError) {
        // Log detailed error information
        this.logger.error(
          `Failed to update invitation status: ${updateError.message}`,
          updateError.stack,
        );

        // Check for specific error types
        if (updateError.code === 'P2002') {
          throw new InternalServerErrorException(
            'Unique constraint violation during invitation cancellation',
          );
        }

        // Generic database update error
        throw new InternalServerErrorException(
          `Unable to cancel invitation: ${updateError.message}`,
        );
      }

      return {
        success: true,
        message: `Invitation to ${invitation.email} has been cancelled`,
        invitation: updatedInvitation,
      };
    } catch (error) {
      // Rethrow known error types
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Unexpected error during invitation cancellation: ${error.message}`,
        error.stack,
      );

      // Provide a generic error response for unexpected errors
      throw new InternalServerErrorException(
        `Failed to cancel invitation: An unexpected error occurred`,
      );
    }
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    if (!uuid) return false;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Remove an invitation
   */
  async remove(invitation_id: string) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      // Validate UUID format
      if (!this.isValidUUID(invitation_id)) {
        throw new BadRequestException('Invalid invitation ID format');
      }

      // Attempt to find the invitation first
      try {
        await this.findOne(invitation_id);
      } catch (findError) {
        // Rethrow if it's a not found error
        if (findError instanceof NotFoundException) {
          throw findError;
        }

        // Handle potential database connection or network errors
        this.logger.error(
          `Database error when finding invitation: ${findError.message}`,
          findError.stack,
        );
        throw new InternalServerErrorException(
          'Unable to retrieve invitation due to a system error',
        );
      }

      // Attempt to delete the invitation
      try {
        await this.prisma.invitations.delete({
          where: { invitation_id },
        });
      } catch (deleteError) {
        // Log detailed error information
        this.logger.error(
          `Failed to remove invitation: ${deleteError.message}`,
          deleteError.stack,
        );

        // Check for specific error types
        if (deleteError.code === 'P2025') {
          throw new NotFoundException(
            `Invitation with ID ${invitation_id} not found or already deleted`,
          );
        }

        // Generic database delete error
        throw new InternalServerErrorException(
          `Unable to remove invitation: ${deleteError.message}`,
        );
      }

      return {
        success: true,
        message: `Invitation with ID ${invitation_id} has been removed`,
      };
    } catch (error) {
      // Rethrow known error types
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log unexpected errors
      this.logger.error(
        `Unexpected error during invitation removal: ${error.message}`,
        error.stack,
      );

      // Provide a generic error response for unexpected errors
      throw new InternalServerErrorException(
        `Failed to remove invitation: An unexpected error occurred`,
      );
    }
  }
}

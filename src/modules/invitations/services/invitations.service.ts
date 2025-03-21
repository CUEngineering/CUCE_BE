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
import { AcceptanceState, StepState } from '../types/invitation.types';
import { InvitationError, InvitationErrorType } from '../types/errors';

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
  async findAll(accessToken: string, status?: string) {
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

      const query: {
        filter?: Record<string, any>;
        orderBy?: { column: string; ascending: boolean };
      } = {
        orderBy: { column: 'created_at', ascending: false },
      };

      if (status) {
        query.filter = { status: status.toUpperCase() };
      }

      const invitations = await this.supabaseService.select(
        accessToken,
        'invitations',
        query,
      );

      return invitations;
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

      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Find a single invitation by ID
   */
  async findOne(accessToken: string, invitation_id: number) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      const query = {
        filter: { invitation_id },
      };

      const invitations = await this.supabaseService.select(
        accessToken,
        'invitations',
        query,
      );

      if (!invitations || invitations.length === 0) {
        throw new NotFoundException(
          `Invitation with ID ${invitation_id} not found`,
        );
      }

      return invitations[0];
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

      throw new InternalServerErrorException(`${error}`);
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
    invitation_id: number,
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

  private initializeAcceptanceState(): AcceptanceState {
    return {
      steps: {
        tokenValidation: { success: false },
        userCreation: { success: false },
        roleAssignment: { success: false },
        profileCreation: { success: false },
        invitationUpdate: { success: false },
      },
      currentStep: 'tokenValidation',
      rollbackNeeded: false,
      rollbackSteps: [],
    };
  }

  private async handleRollback(state: AcceptanceState): Promise<void> {
    if (state.rollbackSteps.length === 0) return;

    for (const step of state.rollbackSteps.reverse()) {
      try {
        switch (step) {
          case 'userCreation':
            if (state.steps.userCreation.data?.id) {
              await this.supabaseService.deleteUser(
                state.steps.userCreation.data.id,
              );
            }
            break;
          case 'roleAssignment':
            if (state.steps.roleAssignment.data?.id) {
              await this.prisma.user_roles.delete({
                where: { id: state.steps.roleAssignment.data.id },
              });
            }
            break;
          case 'profileCreation':
            if (state.steps.profileCreation.data?.registrar_id) {
              await this.prisma.registrars.delete({
                where: {
                  registrar_id: state.steps.profileCreation.data.registrar_id,
                },
              });
            }
            break;
        }
      } catch (error) {
        this.logger.error(`Rollback failed for step ${step}:`, error);
      }
    }
  }

  async acceptInvitation(token: string, dto: AcceptInvitationDto) {
    const state = this.initializeAcceptanceState();

    try {
      // Step 1: Token Validation
      state.currentStep = 'tokenValidation';
      const invitation = await this.prisma.invitations.findFirst({
        where: {
          token,
          status: InvitationStatus.PENDING,
          expires_at: { gt: new Date() },
        },
      });

      if (!invitation) {
        throw new InvitationError(
          InvitationErrorType.INVALID_TOKEN,
          'Invalid or expired invitation token',
          400,
        );
      }

      if (invitation.status === InvitationStatus.ACCEPTED) {
        throw new InvitationError(
          InvitationErrorType.ALREADY_ACCEPTED,
          'Invitation has already been accepted',
          400,
        );
      }

      state.steps.tokenValidation = { success: true, data: invitation };

      // Step 2: User Creation
      state.currentStep = 'userCreation';
      let userData;
      try {
        const { user, session } = await this.supabaseService.signUp(
          invitation.email,
          dto.password,
        );

        if (!user || !session) {
          throw new InvitationError(
            InvitationErrorType.AUTH_SERVICE_ERROR,
            'Failed to create user account',
            500,
          );
        }

        userData = { user, session };
        state.steps.userCreation = {
          success: true,
          data: { id: user.id, session },
        };
        state.rollbackSteps.push('userCreation');
      } catch (error) {
        if (error?.message?.includes('already exists')) {
          throw new InvitationError(
            InvitationErrorType.EMAIL_EXISTS,
            'Account already exists',
            409,
          );
        }
        throw new InvitationError(
          InvitationErrorType.AUTH_SERVICE_ERROR,
          'Authentication service error',
          500,
          error,
        );
      }

      // Step 3: Role Assignment using user token
      state.currentStep = 'roleAssignment';
      const userClient = this.supabaseService.getClientWithAuth(
        userData.session.access_token,
      );

      const { data: roleData, error: roleError } = await userClient
        .from('user_roles')
        .insert({
          user_id: userData.user.id,
          role: invitation.user_type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (roleError) {
        state.rollbackNeeded = true;
        throw new InvitationError(
          InvitationErrorType.SUPABASE_ERROR,
          `Role assignment failed: ${roleError.message}`,
          500,
          roleError,
        );
      }

      state.steps.roleAssignment = { success: true, data: roleData };
      state.rollbackSteps.push('roleAssignment');

      // Step 4: Create Profile
      state.currentStep = 'profileCreation';
      if (invitation.user_type === 'REGISTRAR') {
        const { data: registrar, error: registrarError } = await userClient
          .from('registrars')
          .insert({
            email: userData.user.email,
            first_name: dto.firstName,
            last_name: dto.lastName,
            user_id: userData.user.id,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (registrarError) {
          state.rollbackNeeded = true;
          throw new InvitationError(
            InvitationErrorType.SUPABASE_ERROR,
            `Profile creation failed: ${registrarError.message}`,
            500,
            registrarError,
          );
        }

        state.steps.profileCreation = { success: true, data: registrar };
        state.rollbackSteps.push('profileCreation');

        // Step 5: Update Invitation Status
        state.currentStep = 'invitationUpdate';
        const { data, error: updateError } = await userClient
          .from('invitations')
          .update({
            status: InvitationStatus.ACCEPTED,
            updated_at: new Date().toISOString(),
            registrar_id: registrar.registrar_id,
          })
          .eq('invitation_id', invitation.invitation_id)
          .select();

        // Check if any rows were updated
        if (updateError || !data || data.length === 0) {
          state.rollbackNeeded = true;
          throw new InvitationError(
            InvitationErrorType.SUPABASE_ERROR,
            'Failed to update invitation status - No permission to update this invitation',
            403,
            updateError || new Error('No rows updated due to RLS policy'),
          );
        }

        state.steps.invitationUpdate = { success: true };

        return {
          user: {
            id: userData.user.id,
            email: userData.user.email,
            first_name: dto.firstName,
            last_name: dto.lastName,
            role: invitation.user_type,
          },
          session: {
            access_token: userData.session.access_token,
            refresh_token: userData.session.refresh_token,
          },
          registrar,
          acceptanceState: state,
        };
      } else {
        state.rollbackNeeded = true;
        throw new InvitationError(
          InvitationErrorType.INVALID_PROFILE_DATA,
          `Unsupported user type: ${invitation.user_type}`,
          400,
        );
      }
    } catch (error) {
      this.logger.error(
        `Invitation acceptance failed at step ${state.currentStep}:`,
        error,
      );

      if (state.rollbackNeeded) {
        await this.handleRollback(state);
      }

      if (error instanceof InvitationError) {
        throw error;
      }

      throw new InvitationError(
        InvitationErrorType.SUPABASE_ERROR,
        `Unexpected error during invitation acceptance: ${error.message}`,
        500,
        error,
      );
    }
  }

  /**
   * Resend an invitation with a new token and expiration date
   */
  async resendInvitation(accessToken: string, invitation_id: number) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      // Attempt to find the invitation
      let invitation;
      try {
        invitation = await this.findOne(accessToken, invitation_id);
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
        const { data, error } = await this.supabaseService
          .getClientWithAuth(accessToken)
          .from('invitations')
          .update({
            token,
            expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq('invitation_id', invitation_id)
          .select()
          .single();

        if (error) throw error;
        updatedInvitation = data;
      } catch (updateError) {
        // Log detailed error information
        this.logger.error(
          `Failed to update invitation: ${updateError.message}`,
          updateError.stack,
        );

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
  async cancelInvitation(accessToken: string, invitation_id: number) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      // Attempt to find the invitation
      let invitation;
      try {
        invitation = await this.findOne(accessToken, invitation_id);
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
        const { data, error } = await this.supabaseService
          .getClientWithAuth(accessToken)
          .from('invitations')
          .update({
            status: InvitationStatus.CANCELLED,
            updated_at: new Date().toISOString(),
          })
          .eq('invitation_id', invitation_id)
          .select()
          .single();

        if (error) throw error;
        updatedInvitation = data;
      } catch (updateError) {
        // Log detailed error information
        this.logger.error(
          `Failed to update invitation status: ${updateError.message}`,
          updateError.stack,
        );

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
        `Failed to cancel invitation: ${error.message}`,
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
  async remove(accessToken: string, invitation_id: number) {
    try {
      // Validate input
      if (!invitation_id) {
        throw new BadRequestException('Invitation ID is required');
      }

      // Attempt to find the invitation first
      try {
        await this.findOne(accessToken, invitation_id);
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
        const { error } = await this.supabaseService
          .getClientWithAuth(accessToken)
          .from('invitations')
          .delete()
          .eq('invitation_id', invitation_id);

        if (error) throw error;
      } catch (deleteError) {
        // Log detailed error information
        this.logger.error(
          `Failed to remove invitation: ${deleteError.message}`,
          deleteError.stack,
        );

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
      throw new InternalServerErrorException(error);
    }
  }
}

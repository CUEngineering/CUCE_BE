import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { InvitationsService } from '../services/invitations.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { AuthGuard } from '../../../supabase/auth.guard';
import { Invitation as InvitationModel } from '../types/invitation.types';
import type { AcceptanceResult } from '../types/invitation.types';
import { InvitationError } from '../types/errors';

// Define success response type
interface SuccessResponse {
  success: boolean;
  message: string;
  [key: string]: any;
}

// Define token validation response
interface TokenValidationResponse {
  valid: boolean;
  message: string;
  invitation?: InvitationModel;
}

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  @UseGuards(AuthGuard)
  async findAll(
    @Query('status') status?: string,
    @Request() req?: any,
  ): Promise<any[]> {
    try {
      const result = await this.invitationsService.findAll(
        req.accessToken,
        status,
      );
      if (!result || result.length === 0) {
        throw new HttpException('No invitations found', HttpStatus.NOT_FOUND);
      }
      return result;
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to retrieve invitations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: number, @Request() req?: any): Promise<any> {
    try {
      return await this.invitationsService.findOne(req.accessToken, id);
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to retrieve invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('accept/:token')
  async accept(
    @Param('token') token: string,
    @Body() acceptInvitationDto: AcceptInvitationDto,
  ): Promise<AcceptanceResult> {
    try {
      return await this.invitationsService.acceptInvitation(
        token,
        acceptInvitationDto,
      );
    } catch (error) {
      if (error instanceof InvitationError) {
        throw new HttpException(error.message, error.statusCode);
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to accept invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/resend')
  @UseGuards(AuthGuard)
  async resend(
    @Param('id') id: number,
    @Request() req?: any,
  ): Promise<SuccessResponse> {
    try {
      return await this.invitationsService.resendInvitation(
        req.accessToken,
        id,
      );
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to resend invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/cancel')
  @UseGuards(AuthGuard)
  async cancel(
    @Param('id') id: number,
    @Request() req?: any,
  ): Promise<SuccessResponse> {
    try {
      return await this.invitationsService.cancelInvitation(
        req.accessToken,
        id,
      );
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to cancel invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(
    @Param('id') id: number,
    @Request() req?: any,
  ): Promise<SuccessResponse> {
    try {
      return await this.invitationsService.remove(req.accessToken, id);
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to remove invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('validate/:token')
  async validateToken(
    @Param('token') token: string,
  ): Promise<TokenValidationResponse> {
    try {
      return await this.invitationsService.validateToken(token);
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to validate token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

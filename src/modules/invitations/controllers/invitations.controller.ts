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
} from '@nestjs/common';
import { InvitationsService } from '../services/invitations.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { ResendInvitationDto } from '../dto/resend-invitation.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    try {
      const result = await this.invitationsService.findAll(status);
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
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.invitationsService.findOne(id);
      return result;
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to retrieve invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/accept')
  async accept(
    @Param('id') id: string,
    @Body() acceptInvitationDto: AcceptInvitationDto,
  ) {
    try {
      const result = await this.invitationsService.acceptInvitation(
        id,
        acceptInvitationDto,
      );
      return result;
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to accept invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/resend')
  resend(
    @Param('id') id: string,
    @Body() resendInvitationDto: ResendInvitationDto,
  ) {
    return this.invitationsService.resendInvitation(id, resendInvitationDto);
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string) {
    try {
      const result = await this.invitationsService.cancelInvitation(id);
      return result;
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to cancel invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const result = await this.invitationsService.remove(id);
      return result;
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to remove invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('validate/:token')
  async validateToken(@Param('token') token: string) {
    try {
      const result = await this.invitationsService.validateToken(token);
      return result;
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to validate token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

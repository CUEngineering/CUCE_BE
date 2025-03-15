import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { InvitationsService } from '../services/invitations.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { ResendInvitationDto } from '../dto/resend-invitation.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.invitationsService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invitationsService.findOne(id);
  }

  @Post(':id/accept')
  accept(
    @Param('id') id: string,
    @Body() acceptInvitationDto: AcceptInvitationDto,
  ) {
    return this.invitationsService.acceptInvitation(id, acceptInvitationDto);
  }

  @Post(':id/resend')
  resend(
    @Param('id') id: string,
    @Body() resendInvitationDto: ResendInvitationDto,
  ) {
    return this.invitationsService.resendInvitation(id, resendInvitationDto);
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.invitationsService.cancelInvitation(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invitationsService.remove(id);
  }

  @Get('validate/:token')
  validateToken(@Param('token') token: string) {
    return this.invitationsService.validateToken(token);
  }
}

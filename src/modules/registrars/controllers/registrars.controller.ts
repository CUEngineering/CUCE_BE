import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../../../supabase/auth.guard';
import { RegistrarsService } from '../services/registrars.service';
import { InviteRegistrarsDto } from '../dto/invite-registrar.dto';
import { UpdateRegistrarDto } from '../dto/update-registrar.dto';
import { InvitationResponse } from '../interfaces/invitation.interface';
import { Request } from 'express';

interface InvitationResult {
  email: string;
  success: boolean;
  invitation?: InvitationResponse;
  error?: string;
}

@Controller('registrars')
@UseGuards(AuthGuard)
export class RegistrarsController {
  constructor(private readonly registrarsService: RegistrarsService) {}

  @Get()
  async findAll(@Req() req: Request & { accessToken: string }) {
    return this.registrarsService.findAll(req.accessToken);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.findOne(id, req.accessToken);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateRegistrarDto: UpdateRegistrarDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.update(
      id,
      updateRegistrarDto,
      req.accessToken,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.remove(id, req.accessToken);
  }

  @Post('invite')
  async invite(
    @Body() inviteDto: InviteRegistrarsDto,
    @Req() req: Request & { accessToken: string },
  ) {
    const results: InvitationResult[] = [];

    for (const email of inviteDto.emails) {
      try {
        const invitation = await this.registrarsService.inviteRegistrar(
          { email },
          req.accessToken,
        );
        results.push({
          email,
          success: true,
          invitation,
        });
      } catch (error) {
        results.push({
          email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      totalInvited: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      results,
    };
  }

  @Post(':id/suspend')
  async suspendRegistrar(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.suspend(id, req.accessToken);
  }

  @Post(':id/unsuspend')
  async unsuspendRegistrar(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.liftSuspension(id, req.accessToken);
  }

  @Get(':id/stats')
  async getRegistrarStats(
    @Param('id') id: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.getRegistrarStats(id, req.accessToken);
  }
}

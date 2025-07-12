import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import type { File as MulterFile } from 'multer';
import { AuthGuard } from '../../../supabase/auth.guard';
import { AcceptInviteDto } from '../dto/accept-registrar.dto';
import { InviteRegistrarsDto } from '../dto/invite-registrar.dto';
import { UpdateRegistrarDto } from '../dto/update-registrar.dto';
import { InvitationResponse } from '../interfaces/invitation.interface';
import { RegistrarsService } from '../services/registrars.service';

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
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.findOne(id, req.accessToken);
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() updateRegistrarDto: UpdateRegistrarDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.update(
      id,
      updateRegistrarDto,
      req.accessToken,
    );
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id') id: number,
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

    setImmediate(async () => {
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
    });

    return {
      totalInvited: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      results,
    };
  }

  @Post('delete-invite')
  async deleteInvite(
    @Body('email') email: string,
    @Req() req: Request & { accessToken: string },
  ) {
    return await this.registrarsService.deleteInvitation(
      email,
      req.accessToken,
    );
  }
  @Post('resend-invite')
  async resendInvite(
    @Body('email') email: string,
    @Req() req: Request & { accessToken: string },
  ) {
    const result = await this.registrarsService.resendInvitation(
      email,
      req.accessToken,
    );
    return result;
  }

  @Patch(':id/suspend')
  async suspendRegistrar(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.suspend(id, req.accessToken);
  }

  @Patch(':id/unsuspend')
  async unsuspendRegistrar(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.liftSuspension(id, req.accessToken);
  }

  @Get(':id/stats')
  async getRegistrarStats(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.registrarsService.getRegistrarStats(id, req.accessToken);
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @UploadedFile() file?: MulterFile,
  ) {
    return this.registrarsService.acceptInvite(dto, file);
  }
}

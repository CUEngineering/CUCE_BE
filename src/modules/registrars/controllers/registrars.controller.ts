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
} from '@nestjs/common';
import { AuthGuard } from '../../../supabase/auth.guard';
import { RegistrarsService } from '../services/registrars.service';
import {
  InviteRegistrarDto,
  InviteMultipleRegistrarsDto,
} from '../dto/invite-registrar.dto';
import { UpdateRegistrarDto } from '../dto/update-registrar.dto';

interface InvitationResult {
  email: string;
  success: boolean;
  invitation?: any;
  error?: string;
}

@Controller('registrars')
@UseGuards(AuthGuard)
export class RegistrarsController {
  constructor(private readonly registrarsService: RegistrarsService) {}

  @Get()
  async findAll() {
    return this.registrarsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.registrarsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateRegistrarDto: UpdateRegistrarDto,
  ) {
    return this.registrarsService.update(id, updateRegistrarDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.registrarsService.remove(id);
  }

  @Post('invite')
  async invite(@Body() inviteRegistrarDto: InviteRegistrarDto) {
    return this.registrarsService.inviteRegistrar(inviteRegistrarDto);
  }

  @Post('invite/multiple')
  async inviteMultiple(@Body() inviteMultipleDto: InviteMultipleRegistrarsDto) {
    const results: InvitationResult[] = [];

    for (const emailDto of inviteMultipleDto.emails) {
      try {
        const invitation =
          await this.registrarsService.inviteRegistrar(emailDto);
        results.push({
          email: emailDto.email,
          success: true,
          invitation,
        });
      } catch (error) {
        results.push({
          email: emailDto.email,
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

  @Delete('invitations/:id')
  async cancelInvitation(@Param('id') id: string) {
    return this.registrarsService.cancelInvitation(id);
  }

  @Post(':id/suspend')
  async suspendRegistrar(@Param('id') id: string) {
    return this.registrarsService.suspend(id);
  }

  @Post(':id/unsuspend')
  async unsuspendRegistrar(@Param('id') id: string) {
    return this.registrarsService.liftSuspension(id);
  }

  @Get(':id/stats')
  async getRegistrarStats(@Param('id') id: string) {
    return this.registrarsService.getRegistrarStats(id);
  }
}

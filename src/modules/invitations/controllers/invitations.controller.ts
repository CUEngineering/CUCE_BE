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
  Injectable,
} from '@nestjs/common';
import { InvitationsService } from '../services/invitations.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { AuthGuard } from '../../../supabase/auth.guard';
import { Invitation as InvitationModel } from '../services/invitations.service';

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

/**
 * A wrapper for InvitationsService that provides type-safe access to service methods
 */
@Injectable()
class TypedInvitationsService {
  constructor(private readonly service: InvitationsService) {}

  async findAll(status?: string): Promise<InvitationModel[]> {
    return this.service.findAll(status);
  }

  async findOne(id: string): Promise<InvitationModel> {
    return this.service.findOne(id);
  }

  async acceptInvitation(
    id: string,
    dto: AcceptInvitationDto,
  ): Promise<SuccessResponse> {
    return this.service.acceptInvitation(id, dto);
  }

  async resendInvitation(id: string): Promise<SuccessResponse> {
    return this.service.resendInvitation(id);
  }

  async cancelInvitation(id: string): Promise<SuccessResponse> {
    return this.service.cancelInvitation(id);
  }

  async remove(id: string): Promise<SuccessResponse> {
    return this.service.remove(id);
  }

  async validateToken(token: string): Promise<TokenValidationResponse> {
    return this.service.validateToken(token);
  }
}

@Controller('invitations')
export class InvitationsController {
  private typedService: TypedInvitationsService;

  constructor(private readonly invitationsService: InvitationsService) {
    // Create a typed wrapper for the service
    this.typedService = new TypedInvitationsService(invitationsService);
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAll(@Query('status') status?: string): Promise<InvitationModel[]> {
    try {
      const result = await this.typedService.findAll(status);
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
  async findOne(@Param('id') id: string): Promise<InvitationModel> {
    try {
      return await this.typedService.findOne(id);
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
  ): Promise<SuccessResponse> {
    try {
      return await this.typedService.acceptInvitation(id, acceptInvitationDto);
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to accept invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/resend')
  @UseGuards(AuthGuard)
  async resend(@Param('id') id: string): Promise<SuccessResponse> {
    try {
      return await this.typedService.resendInvitation(id);
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to resend invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id/cancel')
  @UseGuards(AuthGuard)
  async cancel(@Param('id') id: string): Promise<SuccessResponse> {
    try {
      return await this.typedService.cancelInvitation(id);
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to cancel invitation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string): Promise<SuccessResponse> {
    try {
      return await this.typedService.remove(id);
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
      return await this.typedService.validateToken(token);
    } catch (error: unknown) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to validate token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

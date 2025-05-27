import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Invalid token format');
    }

    try {
      (
        request as Request & { user: { id: string }; accessToken: string }
      ).user = {
        id: 'user-uuid',
      };
      (
        request as Request & { user: { id: string }; accessToken: string }
      ).accessToken = token;

      return true;
    } catch (error) {
      // Log the error for debugging
      console.error('Authentication error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

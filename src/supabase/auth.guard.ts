// import {
//   Injectable,
//   CanActivate,
//   ExecutionContext,
//   UnauthorizedException,
//   Inject,
//   Optional,
// } from '@nestjs/common';
// import { SupabaseClient } from '@supabase/supabase-js';
// import { Request } from 'express';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class AuthGuard implements CanActivate {
//   constructor(
//     @Inject('SUPABASE_CLIENT')
//     private readonly supabase: SupabaseClient,
//     @Optional() private readonly configService?: ConfigService,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest<Request>();
//     const authHeader = request.headers.authorization;

//     if (!authHeader) {
//       throw new UnauthorizedException('No token provided');
//     }

//     const token = authHeader.split(' ')[1];

//     if (!token) {
//       throw new UnauthorizedException('Invalid token format');
//     }

//     try {
//       (
//         request as Request & { user: { id: string }; accessToken: string }
//       ).user = {
//         id: 'user-uuid',
//       };
//       (
//         request as Request & { user: { id: string }; accessToken: string }
//       ).accessToken = token;

//       return true;
//     } catch (error) {
//       // Log the error for debugging
//       console.error('Authentication error:', error);
//       throw new UnauthorizedException('Authentication failed');
//     }
//   }
// }

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  private adminClient: SupabaseClient;
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL and Service Role Key must be provided');
    }

    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

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
      const { data: userData, error } = await this.supabase.auth.getUser(token);

      if (error || !userData?.user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      const userId = userData.user.id;

      // Fetch role
      const { data: roleData, error: roleError } = await this.adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError || !roleData?.role) {
        throw new UnauthorizedException('User role not found');
      }

      const role = roleData.role.toUpperCase();

      // Fetch role-specific id
      let roleIdField = '';
      let roleIdValue = null;

      switch (role) {
        case 'STUDENT': {
          const { data: studentData, error: studentError } =
            await this.adminClient
              .from('students')
              .select('student_id')
              .eq('user_id', userId)
              .single();

          if (studentError || !studentData?.student_id) {
            throw new UnauthorizedException('Student profile not found');
          }

          roleIdField = 'student_id';
          roleIdValue = studentData.student_id;
          break;
        }

        case 'REGISTRAR': {
          const { data: registrarData, error: registrarError } =
            await this.adminClient
              .from('registrars')
              .select('registrar_id')
              .eq('user_id', userId)
              .single();

          if (registrarError || !registrarData?.registrar_id) {
            throw new UnauthorizedException('Registrar profile not found');
          }

          roleIdField = 'registrar_id';
          roleIdValue = registrarData.registrar_id;
          break;
        }

        case 'ADMIN': {
          const { data: adminData, error: adminError } = await this.adminClient
            .from('admins')
            .select('admin_id')
            .eq('user_id', userId)
            .single();

          if (adminError || !adminData?.admin_id) {
            throw new UnauthorizedException('Admin profile not found');
          }

          roleIdField = 'admin_id';
          roleIdValue = adminData.admin_id;
          break;
        }

        default:
          throw new UnauthorizedException('Unknown user role');
      }

      // Attach user info to request
      (
        request as Request & {
          user: {
            id: string;
            role: string;
            [key: string]: any;
          };
          accessToken: string;
        }
      ).user = {
        id: userId,
        role,
        [roleIdField]: roleIdValue,
      };

      (
        request as Request & {
          user: {
            id: string;
            role: string;
            [key: string]: any;
          };
          accessToken: string;
        }
      ).accessToken = token;

      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
  ) {}

  async signUp(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        // Handle specific Supabase signup errors
        if (error.message.includes('already in use')) {
          throw new ConflictException('Email is already registered');
        }
        throw new InternalServerErrorException(error.message);
      }

      // If signup is successful but no user is created (rare case)
      if (!data.user) {
        throw new InternalServerErrorException('User creation failed');
      }

      return {
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      // Rethrow known exceptions
      if (
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // Catch any unexpected errors
      throw new InternalServerErrorException('Signup failed');
    }
  }

  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Handle specific Supabase login errors
        if (error.message.includes('Invalid login credentials')) {
          throw new UnauthorizedException('Invalid email or password');
        }
        throw new InternalServerErrorException(error.message);
      }

      // If login is successful but no user is created (rare case)
      if (!data.user) {
        throw new UnauthorizedException('Authentication failed');
      }

      return {
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      // Rethrow known exceptions
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // Catch any unexpected errors
      throw new InternalServerErrorException('Login failed');
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw new InternalServerErrorException('Logout failed');
      }

      return { message: 'Successfully logged out' };
    } catch (error) {
      throw new InternalServerErrorException('Logout failed');
    }
  }

  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();

      if (error) {
        throw new UnauthorizedException('Unable to retrieve current user');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Unable to retrieve current user');
    }
  }
}

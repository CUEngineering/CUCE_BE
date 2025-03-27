import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  private adminClient: SupabaseClient;

  constructor(
    @Inject('SUPABASE_CLIENT')
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    // Initialize admin client with service role key
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

  /**
   * Get a Supabase client instance authenticated with the user's access token
   * This ensures RLS policies are enforced for the authenticated user
   */
  getClientWithAuth(accessToken: string): SupabaseClient {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Anon Key must be provided');
    }

    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  /**
   * Select data from a table with RLS enforcement
   */
  async select(
    accessToken: string,
    table: string,
    query: {
      columns?: string;
      filter?: Record<string, any>;
      limit?: number;
      offset?: number;
      orderBy?: { column: string; ascending?: boolean };
    },
  ) {
    const client = this.getClientWithAuth(accessToken);
    let queryBuilder = client.from(table).select(query.columns || '*');

    if (query.filter) {
      // Iterate through filter conditions to apply appropriate Supabase filtering
      Object.entries(query.filter).forEach(([column, condition]) => {
        if (Array.isArray(condition)) {
          // Handle array-based filtering (e.g., student_id: [1, 2, 3])
          queryBuilder = queryBuilder.in(column, condition);
        } else if (condition && typeof condition === 'object') {
          // Handle complex filter conditions
          if ('in' in condition) {
            // Use .in() for array-based filtering
            queryBuilder = queryBuilder.in(column, condition.in);
          } else if ('gt' in condition) {
            // Greater than
            queryBuilder = queryBuilder.gt(column, condition.gt);
          } else if ('lt' in condition) {
            // Less than
            queryBuilder = queryBuilder.lt(column, condition.lt);
          } else if ('gte' in condition) {
            // Greater than or equal
            queryBuilder = queryBuilder.gte(column, condition.gte);
          } else if ('lte' in condition) {
            // Less than or equal
            queryBuilder = queryBuilder.lte(column, condition.lte);
          } else if ('eq' in condition) {
            // Exact equality
            queryBuilder = queryBuilder.eq(column, condition.eq);
          } else if ('neq' in condition) {
            // Not equal
            queryBuilder = queryBuilder.neq(column, condition.neq);
          } else {
            // Fallback to .match() for other object conditions
            queryBuilder = queryBuilder.match({ [column]: condition });
          }
        } else {
          // Fallback to .eq() for simple equality filters
          queryBuilder = queryBuilder.eq(column, condition);
        }
      });
    }

    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit);
    }

    if (query.offset) {
      queryBuilder = queryBuilder.range(
        query.offset,
        query.offset + (query.limit || 10) - 1,
      );
    }

    if (query.orderBy) {
      queryBuilder = queryBuilder.order(query.orderBy.column, {
        ascending: query.orderBy.ascending ?? true,
      });
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data;
  }

  /**
   * Insert data into a table with RLS enforcement
   */
  async insert(accessToken: string, table: string, data: Record<string, any>) {
    const client = this.getClientWithAuth(accessToken);
    const { data: result, error } = await client
      .from(table)
      .insert(data)
      .select();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return result;
  }

  /**
   * Update data in a table with RLS enforcement
   */
  async update(
    accessToken: string,
    table: string,
    filter: Record<string, any>,
    data: Record<string, any>,
  ) {
    const client = this.getClientWithAuth(accessToken);
    const { data: result, error } = await client
      .from(table)
      .update(data)
      .match(filter)
      .select();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return result;
  }

  /**
   * Delete data from a table with RLS enforcement
   */
  async delete(
    accessToken: string,
    table: string,
    filter: Record<string, any>,
  ) {
    const client = this.getClientWithAuth(accessToken);
    const { data: result, error } = await client
      .from(table)
      .delete()
      .match(filter)
      .select();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return result;
  }

  async signUp(
    email: string,
    password: string,
    options?: { email_confirm?: boolean },
  ) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            email_confirmed: options?.email_confirm,
          },
        },
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

      // Get user's role
      const { data: userRole } = await this.adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .single();

      // Check if user is a registrar and their status
      if (userRole?.role === 'REGISTRAR') {
        const { data: registrar } = await this.adminClient
          .from('registrars')
          .select('is_deactivated, is_suspended')
          .eq('user_id', data.user.id)
          .single();

        if (registrar?.is_deactivated) {
          throw new UnauthorizedException(
            'Your account has been deactivated. Please contact support.',
          );
        }

        if (registrar?.is_suspended) {
          throw new UnauthorizedException(
            'Your account is currently suspended. Please contact support.',
          );
        }
      }

      return {
        user: data.user,
        session: data.session,
        role: userRole?.role || 'NULL', // Include role in response, default to 'USER' if not found
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
      throw new InternalServerErrorException('Sign in failed');
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw new InternalServerErrorException('Logout failed');
      }

      return { message: 'Successfully logged out' };
    } catch {
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
    } catch {
      throw new UnauthorizedException('Unable to retrieve current user');
    }
  }

  async deleteUser(userId: string) {
    try {
      const { error } = await this.adminClient.auth.admin.deleteUser(userId);

      if (error) {
        throw new InternalServerErrorException(
          `Failed to delete user: ${error.message}`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  /**
   * Insert a record using admin privileges (bypassing RLS)
   */
  async adminInsert(table: string, data: Record<string, any>) {
    try {
      const { data: result, error } = await this.adminClient
        .from(table)
        .insert(data)
        .select();

      if (error) {
        throw new InternalServerErrorException(
          `Admin insert failed: ${error.message}`,
        );
      }

      return { data: result, error: null };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      return {
        data: null,
        error: {
          message:
            error instanceof Error ? error.message : 'Admin insert failed',
        },
      };
    }
  }

  /**
   * Insert a single record and return it using admin privileges (bypassing RLS)
   */
  async adminInsertSingle(table: string, data: Record<string, any>) {
    try {
      const { data: result, error } = await this.adminClient
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new InternalServerErrorException(
          `Admin insert failed: ${error.message}`,
        );
      }

      return { data: result, error: null };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      return {
        data: null,
        error: {
          message:
            error instanceof Error ? error.message : 'Admin insert failed',
        },
      };
    }
  }
}

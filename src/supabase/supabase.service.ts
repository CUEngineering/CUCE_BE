import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { sendResetTokenEmail } from 'src/utils/email.helper';

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
        if (error.message.includes('Invalid login credentials')) {
          throw new UnauthorizedException('Invalid email or password');
        }
        throw new InternalServerErrorException(error.message);
      }

      if (!data.user) {
        throw new UnauthorizedException('Authentication failed');
      }

      const userId = data.user.id;

      const { data: userRoleData, error: roleError } = await this.adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError || !userRoleData?.role) {
        throw new UnauthorizedException('User role not found');
      }

      const role = userRoleData.role.toUpperCase();
      let profileData: any = {};

      switch (role) {
        case 'REGISTRAR': {
          const { data: registrar, error: regError } = await this.adminClient
            .from('registrars')
            .select(
              'first_name, last_name, email, profile_picture, reg_number, program_id, is_deactivated, is_suspended',
            )
            .eq('user_id', userId)
            .single();

          if (regError || !registrar) {
            throw new UnauthorizedException('Registrar profile not found');
          }

          if (registrar.is_deactivated) {
            throw new UnauthorizedException(
              'Your account has been deactivated. Please contact support.',
            );
          }

          if (registrar.is_suspended) {
            throw new UnauthorizedException(
              'Your account is currently suspended. Please contact support.',
            );
          }

          profileData = registrar;
          break;
        }

        case 'ADMIN': {
          const { data: admin, error: adminError } = await this.adminClient
            .from('admins')
            .select('first_name, last_name, email, profile_picture')
            .eq('user_id', userId)
            .single();

          if (adminError || !admin) {
            throw new UnauthorizedException('Admin profile not found');
          }

          profileData = admin;
          break;
        }

        case 'STUDENT': {
          const { data: student, error: studentError } = await this.adminClient
            .from('students')
            .select(
              'first_name, last_name, email, profile_picture, reg_number, program_id',
            )
            .eq('user_id', userId)
            .single();

          if (studentError || !student) {
            throw new UnauthorizedException('Student profile not found');
          }

          profileData = student;
          break;
        }

        default:
          throw new UnauthorizedException('Unknown user role');
      }

      return {
        user: profileData,
        session: data.session,
        role,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

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

  async forgotPassword(email: string) {
    const { data: usersData, error: listError } =
      await this.adminClient.auth.admin.listUsers();

    if (listError) {
      throw new InternalServerErrorException('Failed to fetch user list');
    }

    const user = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      throw new UnauthorizedException('No user found with that email');
    }

    await this.adminClient.from('password_resets').delete().eq('email', email);

    const token = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: insertError } = await this.adminClient
      .from('password_resets')
      .insert({
        email,
        token,
        createdAt: new Date().toISOString(),
      });

    if (insertError) {
      throw new InternalServerErrorException('Could not generate reset token');
    }

    await sendResetTokenEmail(email, token);

    return { message: 'Reset token sent to email' };
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const { data: resetData, error } = await this.adminClient
      .from('password_resets')
      .select('*')
      .eq('email', email)
      .eq('token', token)
      .order('createdAt', { ascending: false })
      .limit(1)
      .single();

    if (error || !resetData) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // const now = new Date();
    // const createdAt = new Date(resetData.createdAt);
    // const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    // if (diffInMinutes > 10) {
    //   throw new UnauthorizedException('Token expired');
    // }

    const { data: users, error: listError } =
      await this.adminClient.auth.admin.listUsers();
    if (listError) {
      throw new InternalServerErrorException('Failed to fetch users');
    }

    const user = users.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!user) {
      throw new InternalServerErrorException('User not found');
    }

    const { error: updateError } =
      await this.adminClient.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    await this.adminClient.from('password_resets').delete().eq('email', email);

    return { message: 'Password reset successful' };
  }
}

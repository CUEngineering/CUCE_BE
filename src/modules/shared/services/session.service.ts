import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SharedSessionService {
  private _adminSupabaseClient: SupabaseClient;
  private _prismaClient: PrismaClient | undefined = undefined;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') as string;
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') as string;
    this._adminSupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
    });
  }

  public get adminSupabaseClient() {
    return this._adminSupabaseClient;
  }

  public get prismaClient() {
    if (this._prismaClient) {
      return this._prismaClient;
    }

    this._prismaClient = new PrismaClient();
    return this._prismaClient;
  }

  public async getActiveSessionIds(supabase?: SupabaseClient) {
    supabase = supabase ?? this.adminSupabaseClient;
    const { data: activeSessions, error: sessionError } = await supabase
      .from('sessions')
      .select(
        `
          session_id, 
          session_status
        `,
      )
      .eq('session_status', 'ACTIVE');

    const activeSessionIds = (activeSessions ?? []).map((s) => String(s.session_id));

    if (sessionError) {
      throw new Error(`Failed to fetch active sessions: ${sessionError?.message ?? 'No active session'}`);
    }

    return activeSessionIds.length ? activeSessionIds : [`0`];
  }
}

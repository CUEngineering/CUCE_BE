import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class BaseSupabaseService {
  constructor(protected readonly supabaseService: SupabaseService) {}

  /**
   * Get an authenticated Supabase client for the current user
   * @param accessToken The user's access token
   */
  protected getAuthenticatedClient(accessToken: string): SupabaseClient {
    return this.supabaseService.getClientWithAuth(accessToken);
  }
}

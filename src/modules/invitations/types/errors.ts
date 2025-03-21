export enum InvitationErrorType {
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  ALREADY_ACCEPTED = 'ALREADY_ACCEPTED',
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  AUTH_SERVICE_ERROR = 'AUTH_SERVICE_ERROR',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  INVALID_PROFILE_DATA = 'INVALID_PROFILE_DATA',
}

export class InvitationError extends Error {
  constructor(
    public type: InvitationErrorType,
    message: string,
    public statusCode: number,
    public originalError?: any,
  ) {
    super(message);
    this.name = 'InvitationError';
  }
}

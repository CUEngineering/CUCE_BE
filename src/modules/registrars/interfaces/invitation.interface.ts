export interface Invitation {
  invitation_id: string;
  email: string;
  token: string;
  user_type: string;
  status: string;
  expires_at: Date;
}

export interface InvitationResponse {
  success: boolean;
  message: string;
  invitation: Invitation;
}

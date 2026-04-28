export interface SaveLetterResponse {
  id: string;
  access_token: string;
  expires_at: string;
  restoreUrl: string;
}

export interface LoadLetterResponse {
  content: string;
  expires_at: string;
}

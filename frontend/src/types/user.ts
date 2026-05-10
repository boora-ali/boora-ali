export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  nickname: string;
  profile_photo_url: string;
  is_google_account: boolean;
  terms_accepted_at: string | null;
}

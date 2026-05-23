import { api } from "./api";
import { ACCESS_KEY } from "../utils/constants";
import type { User } from "../types/user";
import { hasFile, toFormData } from "./form-data";
import { clearClientState, notifyAuthStateChanged } from "../utils/client-state";

export type AccountUpdatePayload = {
  username: string;
  email: string;
  display_name: string;
  nickname: string;
  profile_photo?: File | null;
};

export const authService = {
  async register(data: {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
    website?: string;
    cf_turnstile_response?: string;
    terms_accepted: boolean;
  }) {
    return api.post("/auth/register/", data);
  },
  async login(username: string, password: string, cfTurnstileResponse?: string) {
    const { data } = await api.post("/auth/login/", {
      username,
      password,
      ...(cfTurnstileResponse && { cf_turnstile_response: cfTurnstileResponse }),
    });
    localStorage.setItem(ACCESS_KEY, data.access);
    notifyAuthStateChanged();
    return data;
  },
  async googleLogin(idToken: string) {
    const { data } = await api.post("/auth/google/", { id_token: idToken });
    localStorage.setItem(ACCESS_KEY, data.access);
    notifyAuthStateChanged();
    return data;
  },
  async logout() {
    try {
      await api.post("/auth/logout/");
    } catch {
      // Local logout should still complete if the server rejects the refresh token.
    }
    await clearClientState();
    notifyAuthStateChanged();
  },
  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me/");
    return data;
  },
  async updateMe(payload: AccountUpdatePayload): Promise<User> {
    const body = hasFile(payload) ? toFormData(payload) : payload;
    const { data } = await api.patch<User>("/auth/me/", body);
    return data;
  },
  async changePassword(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) {
    await api.post("/auth/password/", data);
  },
  async acceptTerms() {
    await api.post("/auth/terms/accept/");
  },
  async deleteAccount(data?: { password?: string }) {
    await api.post("/auth/me/delete/", data ?? {});
  },
  async verifyEmail(token: string) {
    await api.post("/auth/verify-email/", { token });
  },
  async resendVerification() {
    await api.post("/auth/resend-verification/");
  },
};

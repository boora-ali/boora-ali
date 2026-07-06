import { api } from "./api";

export type FeedbackKind = "suggestion" | "bug";

export type FeedbackPayload = {
  kind: FeedbackKind;
  message: string;
  page_url?: string;
};

export type FeedbackResponse = {
  kind: FeedbackKind;
  message: string;
  page_url: string;
};

export async function submitFeedback(payload: FeedbackPayload) {
  const response = await api.post<FeedbackResponse>("/feedback/", payload);
  return response.data;
}

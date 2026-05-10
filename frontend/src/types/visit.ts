import type { VisitItem } from "./visit-item";

export interface Visit {
  public_id: string;
  place: number;
  visited_at: string;
  environment_rating: number;
  service_rating: number;
  overall_rating: number;
  would_return: boolean;
  general_notes?: string;
  photo?: string;
  items?: VisitItem[];
  created_at: string;
  updated_at: string;
}

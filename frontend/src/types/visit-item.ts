export type VisitItemType = "sweet" | "savory" | "drink" | "coffee" | "juice" | "dessert" | "other";

export interface VisitItem {
  public_id: string;
  visit: number;
  name: string;
  type: VisitItemType;
  rating: number;
  price: string;
  would_order_again: boolean;
  notes?: string;
  photo?: string;
  created_at: string;
  updated_at: string;
}

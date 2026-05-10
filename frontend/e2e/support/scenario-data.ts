import type { PlaceStatus } from "../../src/types/place";
import type { VisitItemType } from "../../src/types/visit-item";

export type PlaceSeed = {
  name: string;
  category: string;
  address: string;
  notes: string;
  status: PlaceStatus;
};

export type VisitSeed = {
  general_notes: string;
  overall_rating: number;
  environment_rating: number;
  service_rating: number;
  would_return: boolean;
};

export type VisitItemSeed = {
  name: string;
  type: VisitItemType;
  rating: number;
  price: string;
  notes: string;
  would_order_again: boolean;
};

export const placeSeed: PlaceSeed = {
  name: "Churrasquinho da tia",
  category: "Churrasco",
  address: "Ali",
  notes: "Lugar pequeno, mas com comida muito boa.",
  status: "visited",
};

export const visitSeed: VisitSeed = {
  general_notes: "Voltei no lugar para conferir o cardápio.",
  overall_rating: 8,
  environment_rating: 7,
  service_rating: 8,
  would_return: true,
};

export const visitItemSeed: VisitItemSeed = {
  name: "Agua mineral",
  type: "drink",
  rating: 7,
  price: "5.00",
  notes: "Gelada e sem gosto de cloro.",
  would_order_again: true,
};

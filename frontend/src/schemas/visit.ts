import { z } from "zod";

const VISIT_ITEM_TYPES = ["sweet", "savory", "drink", "coffee", "juice", "dessert", "other"] as const;

export const visitItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(VISIT_ITEM_TYPES),
  rating: z.number().min(0).max(10),
  price: z.number().nullable().optional(),
  notes: z.string().max(5000).optional(),
  would_order_again: z.boolean(),
});

export const visitSchema = z.object({
  visited_at: z.string().min(1),
  environment_rating: z.number().min(0).max(10),
  service_rating: z.number().min(0).max(10),
  overall_rating: z.number().min(0).max(10),
  would_return: z.boolean(),
  general_notes: z.string().max(5000).optional(),
});

export type VisitItemFormValues = z.infer<typeof visitItemSchema>;
export type VisitFormValues = z.infer<typeof visitSchema>;

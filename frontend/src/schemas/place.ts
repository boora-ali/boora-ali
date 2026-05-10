import { z } from "zod";

const PLACE_STATUSES = ["want_to_visit", "visited", "favorite", "would_not_return"] as const;

export const placeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  instagram_url: z.string().max(200).optional(),
  maps_url: z.string().max(2000).optional(),
  status: z.enum(PLACE_STATUSES),
  notes: z.string().max(5000).optional(),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
});

export type PlaceFormValues = z.infer<typeof placeSchema>;

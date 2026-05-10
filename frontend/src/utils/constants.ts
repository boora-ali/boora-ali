export const PLACE_STATUSES = [
  { value: "want_to_visit" },
  { value: "visited" },
  { value: "favorite" },
  { value: "would_not_return" },
] as const;

export const VISIT_ITEM_TYPES = [
  { value: "sweet" },
  { value: "savory" },
  { value: "drink" },
  { value: "coffee" },
  { value: "juice" },
  { value: "dessert" },
  { value: "other" },
] as const;

export const ACCESS_KEY = "boraali_access";
export const REFRESH_KEY = "boraali_refresh";
export const SESSION_INVALIDATED_KEY = "boraali_session_invalidated";

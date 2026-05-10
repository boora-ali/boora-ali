import type { APIRequestContext } from "@playwright/test";
import type { PlaceSeed, VisitItemSeed, VisitSeed } from "./scenario-data";

function authHeaders(accessToken?: string) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

export async function seedPlace(
  request: APIRequestContext,
  payload: PlaceSeed,
  accessToken?: string,
) {
  const response = await request.post("http://localhost:8000/api/places/", {
    data: payload,
    headers: authHeaders(accessToken),
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed place: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

export async function seedVisit(
  request: APIRequestContext,
  placePublicId: string,
  payload: VisitSeed,
  accessToken?: string,
) {
  const response = await request.post(`http://localhost:8000/api/places/${placePublicId}/visits/`, {
    data: payload,
    headers: authHeaders(accessToken),
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed visit: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

export async function seedVisitItem(
  request: APIRequestContext,
  visitPublicId: string,
  payload: VisitItemSeed,
  accessToken?: string,
) {
  const response = await request.post(`http://localhost:8000/api/visits/${visitPublicId}/items/`, {
    data: payload,
    headers: authHeaders(accessToken),
  });
  if (!response.ok()) {
    throw new Error(`Failed to seed visit item: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

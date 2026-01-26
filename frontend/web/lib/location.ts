import type { ApiProjectLocation } from "@/lib/api";

export type Coordinates = [number, number]; // [lng, lat]

const COORDINATE_CACHE = new Map<string, string>();
const COORDINATE_IN_FLIGHT = new Map<string, Promise<string | null>>();

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const resolveCoordinates = (
  location?: ApiProjectLocation | Record<string, unknown> | null,
): Coordinates | null => {
  if (!location || typeof location !== "object") {
    return null;
  }

  const typed = location as Record<string, unknown>;
  const lat = normalizeNumber(
    typed.lat ?? typed.latitude ?? typed.y ?? typed.latDeg,
  );
  const lng = normalizeNumber(
    typed.lng ?? typed.lon ?? typed.longitude ?? typed.x,
  );
  if (lat != null && lng != null) {
    return [lng, lat];
  }

  const coords = typed.coordinates ?? typed.coord ?? typed.location;
  if (Array.isArray(coords) && coords.length >= 2) {
    const first = normalizeNumber(coords[0]);
    const second = normalizeNumber(coords[1]);
    if (first != null && second != null) {
      const isLatFirst = Math.abs(first) <= 90 && Math.abs(second) <= 180;
      const isLngFirst = Math.abs(first) <= 180 && Math.abs(second) <= 90;
      if (isLngFirst) {
        return [first, second];
      }
      if (isLatFirst) {
        return [second, first];
      }
    }
  }

  return null;
};

export const formatCoordinates = (coords: Coordinates) =>
  `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;

export const build2GisLink = (coords: Coordinates, zoom = 16) => {
  const encoded = encodeURIComponent(`${coords[0]},${coords[1]}/${zoom}`);
  return `https://2gis.ru/?m=${encoded}`;
};

const makeCacheKey = (coords: Coordinates) =>
  `${coords[1].toFixed(5)},${coords[0].toFixed(5)}`;

type ReverseGeocodeResponse = {
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    state?: string;
    country?: string;
  };
};

const buildCompactLabel = (payload: ReverseGeocodeResponse) => {
  const address = payload.address;
  if (!address) {
    return "";
  }
  const road = address.road?.trim();
  const house = address.house_number?.trim();
  const city =
    address.city?.trim() ||
    address.town?.trim() ||
    address.village?.trim() ||
    address.suburb?.trim();
  const region = address.state?.trim();
  const country = address.country?.trim();
  const line1 = [road, house].filter(Boolean).join(" ");
  const line2 = [city, region, country].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(", ");
};

export async function reverseGeocode(
  coords: Coordinates,
  options?: { signal?: AbortSignal | null; timeoutMs?: number },
): Promise<string | null> {
  const key = makeCacheKey(coords);
  if (COORDINATE_CACHE.has(key)) {
    return COORDINATE_CACHE.get(key) ?? null;
  }
  if (COORDINATE_IN_FLIGHT.has(key)) {
    return COORDINATE_IN_FLIGHT.get(key) ?? null;
  }

  const controller = options?.timeoutMs
    ? new AbortController()
    : undefined;
  const timeoutId = options?.timeoutMs
    ? setTimeout(() => controller?.abort(), options.timeoutMs)
    : null;
  const signal = controller?.signal ?? options?.signal ?? undefined;

  const task = (async () => {
    try {
      const url = new URL("https://geocode.maps.co/reverse");
      url.searchParams.set("lat", String(coords[1]));
      url.searchParams.set("lon", String(coords[0]));
      url.searchParams.set("format", "json");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal,
      });
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json()) as ReverseGeocodeResponse;
      const compact = buildCompactLabel(payload);
      const display =
        compact || (payload.display_name ? payload.display_name.trim() : "");
      if (!display) {
        return null;
      }
      COORDINATE_CACHE.set(key, display);
      return display;
    } catch {
      return null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  })();

  COORDINATE_IN_FLIGHT.set(key, task);
  try {
    return await task;
  } finally {
    COORDINATE_IN_FLIGHT.delete(key);
  }
}

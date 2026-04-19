import { LocationProfile } from "@/lib/types/domain";
import { slugify } from "@/lib/utils";

const MANUAL_PROPERTY_ID_PREFIX = "manual-address";

export function buildManualPropertyId(address: string) {
  return `${MANUAL_PROPERTY_ID_PREFIX}-${slugify(address)}`;
}

export function isManualPropertyId(id: string) {
  return id.startsWith(`${MANUAL_PROPERTY_ID_PREFIX}-`);
}

export function looksLikeSpecificAddress(query?: string) {
  return Boolean(query?.trim() && /\d/.test(query));
}

export function buildManualPropertyHref(location: LocationProfile) {
  return buildManualAddressHref(location.canonicalAddress, {
    price: location.price,
    beds: location.beds,
    baths: location.baths,
    squareFeet: location.squareFeet
  });
}

export function buildManualAddressHref(
  address: string,
  overrides?: {
    price?: number;
    beds?: number;
    baths?: number;
    squareFeet?: number;
  }
) {
  const params = new URLSearchParams();
  params.set("address", address);
  if (overrides?.price != null) params.set("price", String(overrides.price));
  if (overrides?.beds != null) params.set("beds", String(overrides.beds));
  if (overrides?.baths != null) params.set("baths", String(overrides.baths));
  if (overrides?.squareFeet != null) params.set("squareFeet", String(overrides.squareFeet));
  return `/evaluate?${params.toString()}`;
}

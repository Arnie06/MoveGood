import { Property } from "@/lib/types/domain";

export function getPrimaryPropertyImage(property: Property) {
  const candidate = property.images.find((image) => typeof image === "string" && image.trim());
  return candidate?.trim() || null;
}

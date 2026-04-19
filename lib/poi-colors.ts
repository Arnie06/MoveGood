import { AmenityCategory } from "@/lib/types/domain";

type PoiPalette = {
  bg: string;
  border: string;
  text: string;
};

export const amenityColorMap: Record<AmenityCategory, PoiPalette> = {
  grocery: { bg: "#eef6eb", border: "#5f8f52", text: "#355227" },
  gym: { bg: "#e8f4fb", border: "#2c7fb8", text: "#174a6b" },
  park: { bg: "#edf5e6", border: "#4a8b45", text: "#2d5b2a" },
  restaurant: { bg: "#fff1e7", border: "#d26d3d", text: "#8b3f1d" },
  coffee: { bg: "#f7efe4", border: "#8b5e3c", text: "#593821" },
  bar: { bg: "#f3ebfb", border: "#7d56c2", text: "#4d2f84" },
  transit: { bg: "#e8f0ff", border: "#4a6fd1", text: "#28428a" },
  school: { bg: "#fff7da", border: "#c59a1d", text: "#7a5d10" },
  doctor: { bg: "#e7f7f2", border: "#2b9d7f", text: "#176653" },
  "major-poi": { bg: "#f1f3f7", border: "#667085", text: "#364152" },
  custom: { bg: "#f4f4f5", border: "#71717a", text: "#3f3f46" }
};

"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { GeoJSONSource, LngLatBounds } from "maplibre-gl";

import { getMapStyleUrl } from "@/lib/env";
import { buildFallbackMapStyle } from "@/lib/map-style";
import {
  getAverageSavedPlacePeak,
  getNearestRouteByType,
  getSavedPlaceRoutes
} from "@/lib/route-metrics";
import { Card } from "@/components/ui/card";
import {
  AmenityCategory,
  AmenityPOI,
  AnalyzedLocation,
  CrimeIncidentCategory,
  CrimeIncident,
  SearchLocationContext
} from "@/lib/types/domain";
import { amenityColorMap } from "@/lib/poi-colors";
import { buildManualAddressHref } from "@/lib/manual-property";
import { cn, formatCompactNumber, formatMinutes } from "@/lib/utils";

type OverlayKey =
  | "crime"
  | "grocery"
  | "gym"
  | "park"
  | "restaurant"
  | "coffee"
  | "bar";

const overlayConfig: Array<{
  key: OverlayKey;
  label: string;
  defaultOn: boolean;
}> = [
  { key: "crime", label: "Crime", defaultOn: false },
  { key: "grocery", label: "Grocery", defaultOn: true },
  { key: "gym", label: "Gyms", defaultOn: false },
  { key: "park", label: "Parks", defaultOn: true },
  { key: "restaurant", label: "Restaurants", defaultOn: false },
  { key: "coffee", label: "Coffee", defaultOn: false },
  { key: "bar", label: "Bars", defaultOn: false }
];

const CRIME_SOURCE_ID = "crime-incidents";
const CRIME_HEATMAP_LAYER_ID = "crime-heatmap";
const CRIME_CIRCLE_LAYER_ID = "crime-points";
const LOS_ANGELES_MAP_BOUNDS = {
  west: -119.20,
  south: 33.25,
  east: -117.40,
  north: 34.95
} as const;

type ViewBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type CrimeDateFilter = "30d" | "90d" | "1y" | "2y" | "all";

type BrowseViewportContext = {
  amenities: AmenityPOI[];
  crimeIncidents: CrimeIncident[];
  isLoading: boolean;
  showCrimeOverlay: boolean;
};

type BrowseHighlight = {
  lat: number;
  lng: number;
  label?: string;
};

const crimeDateFilterConfig: Array<{ key: CrimeDateFilter; label: string; days?: number }> = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "2y", label: "2Y", days: 730 },
  { key: "all", label: "All" }
];

const crimeCategoryConfig: Array<{ key: CrimeIncidentCategory; label: string }> = [
  { key: "violent", label: "Violent" },
  { key: "property", label: "Property" },
  { key: "theft", label: "Theft" },
  { key: "vehicle", label: "Vehicle" },
  { key: "other", label: "Other" }
];

function buildAmenityKey(amenity: AmenityPOI) {
  return `${amenity.category}:${amenity.lat.toFixed(4)}:${amenity.lng.toFixed(4)}:${amenity.name}`;
}

function buildCrimeKey(incident: CrimeIncident) {
  return `${incident.id}:${incident.lat.toFixed(4)}:${incident.lng.toFixed(4)}`;
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function intersectsLosAngelesBounds(bounds?: ViewBounds | null) {
  if (!bounds) return false;

  return !(
    bounds.east < LOS_ANGELES_MAP_BOUNDS.west ||
    bounds.west > LOS_ANGELES_MAP_BOUNDS.east ||
    bounds.north < LOS_ANGELES_MAP_BOUNDS.south ||
    bounds.south > LOS_ANGELES_MAP_BOUNDS.north
  );
}

function createPopupNode(title: string, lines: string[]) {
  const wrapper = document.createElement("div");
  wrapper.className = "space-y-1";

  const heading = document.createElement("div");
  heading.className = "text-sm font-semibold text-[#1f2937]";
  heading.textContent = title;
  wrapper.appendChild(heading);

  lines.filter(Boolean).forEach((line) => {
    const paragraph = document.createElement("div");
    paragraph.className = "text-xs text-[#4b5563]";
    paragraph.textContent = line;
    wrapper.appendChild(paragraph);
  });

  return wrapper;
}

function makeMarkerElement(input: {
  label: string;
  bg: string;
  border: string;
  text: string;
  shape?: "circle" | "pill";
  compact?: boolean;
}) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "flex items-center justify-center shadow-md transition-[box-shadow,filter] duration-150";
  element.style.background = input.bg;
  element.style.border = `2px solid ${input.border}`;
  element.style.color = input.text;
  element.style.width = input.compact ? "16px" : input.shape === "pill" ? "auto" : "22px";
  element.style.height = input.compact ? "16px" : input.shape === "pill" ? "22px" : "22px";
  element.style.minWidth = input.compact ? "16px" : input.shape === "pill" ? "22px" : "22px";
  element.style.borderRadius = input.shape === "pill" ? "999px" : "999px";
  element.style.padding = input.shape === "pill" ? "0 8px" : "0";
  element.style.fontSize = input.compact ? "9px" : "10px";
  element.style.fontWeight = "700";
  element.textContent = input.label;
  return element;
}

function getCrimeSeverityWeight(incident: CrimeIncident) {
  switch (incident.category) {
    case "violent":
      return 1;
    case "property":
      return 0.72;
    case "theft":
      return 0.55;
    case "vehicle":
      return 0.63;
    default:
      return 0.4;
  }
}

function buildCrimeGeoJson(incidents: CrimeIncident[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: incidents.map((incident) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [incident.lng, incident.lat]
      },
      properties: {
        id: incident.id,
        category: incident.category,
        weight: getCrimeSeverityWeight(incident)
      }
    }))
  };
}

function ensureCrimeLayers(map: maplibregl.Map) {
  if (!map.getSource(CRIME_SOURCE_ID)) {
    map.addSource(CRIME_SOURCE_ID, {
      type: "geojson",
      data: buildCrimeGeoJson([])
    });
  }

  if (!map.getLayer(CRIME_HEATMAP_LAYER_ID)) {
    map.addLayer({
      id: CRIME_HEATMAP_LAYER_ID,
      type: "heatmap",
      source: CRIME_SOURCE_ID,
      maxzoom: 15,
      paint: {
        "heatmap-weight": ["coalesce", ["get", "weight"], 0.4],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.65, 14, 1.25],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 34],
        "heatmap-opacity": 0.72,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(255,245,240,0)",
          0.2,
          "#f8d9cd",
          0.45,
          "#efad8d",
          0.7,
          "#d46a4e",
          1,
          "#8f2419"
        ]
      }
    });
  }

  if (!map.getLayer(CRIME_CIRCLE_LAYER_ID)) {
    map.addLayer({
      id: CRIME_CIRCLE_LAYER_ID,
      type: "circle",
      source: CRIME_SOURCE_ID,
      minzoom: 13,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3, 16, 6],
        "circle-color": [
          "match",
          ["get", "category"],
          "violent",
          "#9f2f24",
          "property",
          "#bf623e",
          "theft",
          "#c7854d",
          "vehicle",
          "#ad6d48",
          "#8d6f60"
        ],
        "circle-stroke-color": "#fff7f3",
        "circle-stroke-width": 1.25,
        "circle-opacity": 0.78
      }
    });
  }
}

export function DemoMap({
  items,
  searchedLocation,
  selectedId,
  isolateOnSelect = false,
  browseMode = false,
  onLocationSelect,
  onSelectedIdChange,
  onClearFocus,
  onBrowseViewportChange,
  highlightedBrowseTarget,
  topContent,
  showSummaryPanel = true
}: {
  items: AnalyzedLocation[];
  searchedLocation?: SearchLocationContext;
  selectedId?: string;
  isolateOnSelect?: boolean;
  browseMode?: boolean;
  onLocationSelect?: (input: {
    label: string;
    address: string;
    lat: number;
    lng: number;
  }) => void;
  onSelectedIdChange?: (next?: string) => void;
  onClearFocus?: () => void;
  onBrowseViewportChange?: (context: BrowseViewportContext) => void;
  highlightedBrowseTarget?: BrowseHighlight | null;
  topContent?: ReactNode;
  showSummaryPanel?: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const viewportRequestRef = useRef(0);
  const didInitViewportRef = useRef(false);
  const didInitCameraRef = useRef(false);
  const propertyMarkerRefs = useRef<maplibregl.Marker[]>([]);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const overlayMarkerRefs = useRef<maplibregl.Marker[]>([]);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>(selectedId ?? items[0]?.property.id);
  const [isolatedId, setIsolatedId] = useState<string | undefined>(
    isolateOnSelect ? selectedId ?? (items.length === 1 ? items[0]?.property.id : undefined) : undefined
  );
  const [visibleOverlays, setVisibleOverlays] = useState<Record<OverlayKey, boolean>>(() =>
    Object.fromEntries(overlayConfig.map((item) => [item.key, item.defaultOn])) as Record<
      OverlayKey,
      boolean
    >
  );
  const [viewBounds, setViewBounds] = useState<ViewBounds | null>(null);
  const [viewportAmenities, setViewportAmenities] = useState<AmenityPOI[]>([]);
  const [viewportCrimeIncidents, setViewportCrimeIncidents] = useState<CrimeIncident[]>([]);
  const [nowTimestamp, setNowTimestamp] = useState<number | null>(null);
  const [showPoiOverlays, setShowPoiOverlays] = useState(true);
  const [showCrimeOverlay, setShowCrimeOverlay] = useState(false);
  const [isViewportLoading, setIsViewportLoading] = useState(false);
  const [activeCrimeIncident, setActiveCrimeIncident] = useState<CrimeIncident | null>(null);
  const [crimeDateFilter, setCrimeDateFilter] = useState<CrimeDateFilter>("2y");
  const [crimeCategoryFilter, setCrimeCategoryFilter] = useState<Record<CrimeIncidentCategory, boolean>>({
    violent: true,
    property: true,
    theft: true,
    vehicle: true,
    other: true
  });
  const browseViewportChangeRef = useRef<typeof onBrowseViewportChange>(onBrowseViewportChange);

  const style = useMemo(() => getMapStyleUrl() || buildFallbackMapStyle(), []);
  const activeItem =
    items.find((item) => item.property.id === activeId) ??
    items.find((item) => item.property.id === selectedId) ??
    items[0];
  const effectiveIsolatedId = selectedId ?? isolatedId;
  const hasExplicitSelection = selectedId !== undefined || effectiveIsolatedId !== undefined;
  const visibleItems = useMemo(
    () =>
      effectiveIsolatedId
        ? items.filter((item) => item.property.id === effectiveIsolatedId)
        : items,
    [effectiveIsolatedId, items]
  );
  const hasMapFocus = browseMode || items.length > 0 || Boolean(searchedLocation);
  const summaryItem = hasExplicitSelection
    ? activeItem
    : searchedLocation
      ? undefined
      : activeItem;
  const summarySavedPlaceRoutes = summaryItem ? getSavedPlaceRoutes(summaryItem.routeMetrics) : [];
  const summaryNearestGroceryRoute = summaryItem
    ? getNearestRouteByType(summaryItem.routeMetrics, "grocery")
    : undefined;
  const summaryAverageSavedPlacePeak = summaryItem
    ? getAverageSavedPlacePeak(summaryItem.routeMetrics)
    : undefined;

  useEffect(() => {
    setHasMounted(true);
    setNowTimestamp(Date.now());
  }, []);

  useEffect(() => {
    if (selectedId !== undefined) {
      setActiveId(selectedId);
      return;
    }

    if (items.length === 1) {
      setActiveId(items[0]?.property.id);
      return;
    }

    if (!items.some((item) => item.property.id === activeId)) {
      setActiveId(items[0]?.property.id);
    }
  }, [activeId, items, selectedId]);

  useEffect(() => {
    if (selectedId !== undefined) return;

    if (items.length === 1) {
      setIsolatedId(items[0]?.property.id);
      return;
    }

    if (isolatedId && !items.some((item) => item.property.id === isolatedId)) {
      setIsolatedId(undefined);
    }
  }, [isolatedId, items, selectedId]);

  const mapAmenities = useMemo(() => {
    const deduped = new Map<string, AmenityPOI>();
    [...items.flatMap((item) => item.nearbyAmenities), ...(searchedLocation?.nearbyAmenities ?? [])].forEach(
      (amenity) => {
        deduped.set(buildAmenityKey(amenity), amenity);
      }
    );
    return Array.from(deduped.values());
  }, [items, searchedLocation]);

  const mapCrimeIncidents = useMemo(() => {
    const deduped = new Map<string, CrimeIncident>();
    [...items.flatMap((item) => item.crimeIncidents), ...(searchedLocation?.crimeIncidents ?? [])].forEach(
      (incident) => {
        deduped.set(buildCrimeKey(incident), incident);
      }
    );
    return Array.from(deduped.values())
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 120);
  }, [items, searchedLocation]);

  const shouldUseViewportAmenities =
    (browseMode || !effectiveIsolatedId) &&
    (browseMode || intersectsLosAngelesBounds(viewBounds));
  const shouldUseViewportCrime =
    (browseMode || !effectiveIsolatedId) &&
    (browseMode || intersectsLosAngelesBounds(viewBounds));
  const visibleMapAmenities = shouldUseViewportAmenities ? viewportAmenities : mapAmenities;
  const baseVisibleMapCrimeIncidents = shouldUseViewportCrime
    ? viewportCrimeIncidents
    : mapCrimeIncidents;
  const visibleMapCrimeIncidents = useMemo(() => {
    const activeDateFilter = crimeDateFilterConfig.find((filter) => filter.key === crimeDateFilter);
    const cutoff =
      activeDateFilter?.days != null && nowTimestamp != null
        ? nowTimestamp - activeDateFilter.days * 24 * 60 * 60 * 1000
        : null;

    return baseVisibleMapCrimeIncidents.filter((incident) => {
      if (!crimeCategoryFilter[incident.category]) return false;
      if (cutoff == null) return true;

      const occurredAt = new Date(incident.occurredAt).getTime();
      return Number.isFinite(occurredAt) && occurredAt >= cutoff;
    });
  }, [
    baseVisibleMapCrimeIncidents,
    crimeCategoryFilter,
    crimeDateFilter,
    nowTimestamp
  ]);

  const overlayCounts = useMemo(() => {
    return {
      crime: visibleMapCrimeIncidents.length,
      grocery: visibleMapAmenities.filter((amenity) => amenity.category === "grocery").length,
      gym: visibleMapAmenities.filter((amenity) => amenity.category === "gym").length,
      park: visibleMapAmenities.filter((amenity) => amenity.category === "park").length,
      restaurant: visibleMapAmenities.filter((amenity) => amenity.category === "restaurant").length,
      coffee: visibleMapAmenities.filter((amenity) => amenity.category === "coffee").length,
      bar: visibleMapAmenities.filter((amenity) => amenity.category === "bar").length
    } satisfies Record<OverlayKey, number>;
  }, [visibleMapCrimeIncidents.length, visibleMapAmenities]);

  const browseVisibleAmenities = useMemo(
    () =>
      showPoiOverlays
        ? visibleMapAmenities.filter((amenity) => visibleOverlays[amenity.category as OverlayKey] ?? false)
        : [],
    [showPoiOverlays, visibleMapAmenities, visibleOverlays]
  );

  useEffect(() => {
    browseViewportChangeRef.current = onBrowseViewportChange;
  }, [onBrowseViewportChange]);

  useEffect(() => {
    browseViewportChangeRef.current?.({
      amenities: browseVisibleAmenities,
      crimeIncidents: showCrimeOverlay ? visibleMapCrimeIncidents : [],
      isLoading: isViewportLoading
      ,
      showCrimeOverlay
    });
  }, [
    browseVisibleAmenities,
    isViewportLoading,
    showCrimeOverlay,
    visibleMapCrimeIncidents
  ]);

  useEffect(() => {
    if (!hasMounted || !mapContainerRef.current || !hasMapFocus || mapRef.current) return;

    const initialCenter =
      searchedLocation
        ? ([searchedLocation.lng, searchedLocation.lat] as [number, number])
        : items[0]
          ? ([items[0].property.lng, items[0].property.lat] as [number, number])
          : ([-118.2437, 34.0522] as [number, number]);

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style,
      center: initialCenter,
      zoom: 11
    });

    mapRef.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    return () => {
      propertyMarkerRefs.current.forEach((marker) => marker.remove());
      searchMarkerRef.current?.remove();
      overlayMarkerRefs.current.forEach((marker) => marker.remove());
      propertyMarkerRefs.current = [];
      searchMarkerRef.current = null;
      overlayMarkerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasMapFocus, hasMounted, items, searchedLocation, style]);

  useEffect(() => {
    if (!mapRef.current || !hasMapFocus) return;

    propertyMarkerRefs.current.forEach((marker) => marker.remove());
    propertyMarkerRefs.current = [];
    searchMarkerRef.current?.remove();
    searchMarkerRef.current = null;

    const bounds = new LngLatBounds();
    let boundsPointCount = 0;

    visibleItems.forEach((item) => {
      bounds.extend([item.property.lng, item.property.lat]);
      boundsPointCount += 1;

      const element = document.createElement("button");
      element.type = "button";
      element.className = cn(
        "flex min-h-11 min-w-11 items-center justify-center rounded-full border-4 border-white px-3 text-sm font-bold text-white shadow-lg transition-transform",
        item.property.id === activeItem?.property.id ? "bg-clay scale-110" : "bg-ocean"
      );
      element.textContent = String(item.score.overallScore);
      element.onclick = () => {
        const nextSelection =
          (selectedId ?? isolatedId) === item.property.id ? undefined : item.property.id;
        setActiveId(item.property.id);
        if (selectedId !== undefined || onSelectedIdChange) {
          onSelectedIdChange?.(nextSelection);
        } else if (items.length > 1) {
          setIsolatedId(nextSelection);
        }
        mapRef.current?.flyTo({
          center: [item.property.lng, item.property.lat],
          zoom: Math.max(mapRef.current.getZoom(), 12.5)
        });
      };

      const marker = new maplibregl.Marker({ element })
        .setLngLat([item.property.lng, item.property.lat])
        .addTo(mapRef.current as maplibregl.Map);

      propertyMarkerRefs.current.push(marker);
    });

    if (searchedLocation) {
      bounds.extend([searchedLocation.lng, searchedLocation.lat]);
      boundsPointCount += 1;

      const element = makeMarkerElement({
        label: "S",
        bg: "#102542",
        border: "#f8fafc",
        text: "#f8fafc",
        shape: "pill"
      });
      element.style.height = "28px";
      element.style.minWidth = "28px";

      const popup = new maplibregl.Popup({ offset: 12 }).setDOMContent(
        createPopupNode(searchedLocation.canonicalAddress, [
          "Searched address",
          [searchedLocation.city, searchedLocation.state, searchedLocation.zipCode]
            .filter(Boolean)
            .join(", ")
        ])
      );

      searchMarkerRef.current = new maplibregl.Marker({ element })
        .setLngLat([searchedLocation.lng, searchedLocation.lat])
        .setPopup(popup)
        .addTo(mapRef.current as maplibregl.Map);
    }

    if (!didInitCameraRef.current) {
      didInitCameraRef.current = true;

      if (visibleItems.length === 0 && searchedLocation) {
        mapRef.current.flyTo({
          center: [searchedLocation.lng, searchedLocation.lat],
          zoom: 13
        });
      } else if (visibleItems.length === 1 && !searchedLocation) {
        mapRef.current.flyTo({
          center: [visibleItems[0].property.lng, visibleItems[0].property.lat],
          zoom: 13
        });
      } else if (boundsPointCount > 1) {
        mapRef.current.fitBounds(bounds, {
          padding: 60,
          maxZoom: 13,
          duration: 0
        });
      } else {
        mapRef.current.flyTo({
          center:
            searchedLocation != null
              ? [searchedLocation.lng, searchedLocation.lat]
              : visibleItems[0] != null
                ? [visibleItems[0].property.lng, visibleItems[0].property.lat]
                : [-118.2437, 34.0522],
          zoom: searchedLocation || visibleItems[0] ? 13 : 10.5,
          duration: 0
        });
      }
    }
  }, [
    activeItem,
    hasMapFocus,
    isolatedId,
    items,
    onSelectedIdChange,
    searchedLocation,
    selectedId,
    visibleItems
  ]);

  useEffect(() => {
    if (!mapRef.current || !hasMounted) return;

    const activeMap = mapRef.current;
    let isCancelled = false;

    const syncBounds = async () => {
      const requestId = viewportRequestRef.current + 1;
      viewportRequestRef.current = requestId;
      const bounds = activeMap.getBounds();
      const nextBounds = {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth()
      } satisfies ViewBounds;
      setViewBounds(nextBounds);

      if ((!browseMode && effectiveIsolatedId) || (!browseMode && !intersectsLosAngelesBounds(nextBounds))) {
        if (!isCancelled) {
          setIsViewportLoading(false);
          setViewportAmenities([]);
          setViewportCrimeIncidents([]);
        }
        return;
      }

      setIsViewportLoading(true);

      const params = new URLSearchParams({
        west: String(nextBounds.west),
        south: String(nextBounds.south),
        east: String(nextBounds.east),
        north: String(nextBounds.north),
        categories: "grocery,gym,park,restaurant,coffee,bar"
      });
      const [poiResponse, crimeResponse] = await Promise.all([
        fetch(`/api/map-pois?${params.toString()}`),
        fetch(`/api/map-crime?${params.toString()}`)
      ]);
      if (!poiResponse.ok || !crimeResponse.ok) {
        if (!isCancelled && requestId === viewportRequestRef.current) {
          setIsViewportLoading(false);
        }
        return;
      }

      const [poiPayload, crimePayload] = await Promise.all([
        poiResponse.json() as Promise<{ amenities?: AmenityPOI[] }>,
        crimeResponse.json() as Promise<{ incidents?: CrimeIncident[] }>
      ]);
      if (!isCancelled && requestId === viewportRequestRef.current) {
        setViewportAmenities(poiPayload.amenities ?? []);
        setViewportCrimeIncidents(crimePayload.incidents ?? []);
        setIsViewportLoading(false);
      }
    };

    if (!didInitViewportRef.current) {
      didInitViewportRef.current = true;
      if (activeMap.loaded()) {
        void syncBounds();
      } else {
        activeMap.once("load", () => {
          void syncBounds();
        });
      }
    }

    activeMap.on("moveend", syncBounds);
    activeMap.on("zoomend", syncBounds);

    return () => {
      isCancelled = true;
      activeMap.off("moveend", syncBounds);
      activeMap.off("zoomend", syncBounds);
    };
  }, [
    browseMode,
    effectiveIsolatedId,
    hasMapFocus,
    hasMounted,
    items.length,
    searchedLocation?.canonicalAddress
  ]);

  useEffect(() => {
    if (!mapRef.current) return;

    const activeMap = mapRef.current;
    const syncCrimeHeatmap = () => {
      ensureCrimeLayers(activeMap);

      const source = activeMap.getSource(CRIME_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(buildCrimeGeoJson(visibleMapCrimeIncidents));

      const visibility =
        showCrimeOverlay && visibleMapCrimeIncidents.length > 0 ? "visible" : "none";
      activeMap.setLayoutProperty(CRIME_HEATMAP_LAYER_ID, "visibility", visibility);
      activeMap.setLayoutProperty(CRIME_CIRCLE_LAYER_ID, "visibility", visibility);
    };

    if (activeMap.isStyleLoaded()) {
      syncCrimeHeatmap();
      return;
    }

    activeMap.once("load", syncCrimeHeatmap);
  }, [showCrimeOverlay, visibleMapCrimeIncidents]);

  useEffect(() => {
    if (!mapRef.current || !browseMode || !onLocationSelect) return;

    const activeMap = mapRef.current;
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest("[data-map-marker='true']")) {
        return;
      }
      onLocationSelect({
        label: "Dropped Pin",
        address: `${event.lngLat.lat.toFixed(5)}, ${event.lngLat.lng.toFixed(5)}`,
        lat: event.lngLat.lat,
        lng: event.lngLat.lng
      });
    };

    activeMap.on("click", handleMapClick);
    return () => {
      activeMap.off("click", handleMapClick);
    };
  }, [browseMode, onLocationSelect]);

  useEffect(() => {
    if (!mapRef.current) return;

    overlayMarkerRefs.current.forEach((marker) => marker.remove());
    overlayMarkerRefs.current = [];
    hoverPopupRef.current?.remove();
    hoverPopupRef.current = null;

    const activeMap = mapRef.current;
    const showHoverPopup = (lng: number, lat: number, title: string, lines: string[]) => {
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        closeOnClick: false,
        className: "pointer-events-none"
      })
        .setLngLat([lng, lat])
        .setDOMContent(createPopupNode(title, lines))
        .addTo(activeMap);
    };
    const hideHoverPopup = () => {
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
    };

    const addAmenityMarkers = (category: AmenityCategory, overlay: Exclude<OverlayKey, "crime">) => {
      if (!showPoiOverlays || !visibleOverlays[overlay]) return;

      visibleMapAmenities
        .filter((amenity) => amenity.category === category)
        .forEach((amenity) => {
          const palette = amenityColorMap[overlay];
          const isHighlighted =
            highlightedBrowseTarget != null &&
            Math.abs(highlightedBrowseTarget.lat - amenity.lat) < 0.0001 &&
            Math.abs(highlightedBrowseTarget.lng - amenity.lng) < 0.0001;
          const element = makeMarkerElement({
            label: amenity.name.slice(0, 1).toUpperCase(),
            bg: isHighlighted ? "#102542" : palette.bg,
            border: isHighlighted ? "#f97316" : palette.border,
            text: isHighlighted ? "#f8fafc" : palette.text,
            compact: true
          });
          element.dataset.mapMarker = "true";
          element.dataset.markerKind = "amenity";
          if (isHighlighted) {
            element.style.width = "20px";
            element.style.height = "20px";
            element.style.minWidth = "20px";
            element.style.boxShadow = "0 0 0 3px rgba(249, 115, 22, 0.2)";
          }

          element.onmouseenter = () => {
            element.style.filter = "brightness(0.96)";
            element.style.boxShadow = isHighlighted
              ? "0 0 0 4px rgba(249, 115, 22, 0.24)"
              : "0 0 0 3px rgba(15, 23, 42, 0.12)";
            showHoverPopup(amenity.lng, amenity.lat, amenity.name, [amenity.address]);
          };

          element.onmouseleave = () => {
            element.style.filter = "";
            element.style.boxShadow = isHighlighted ? "0 0 0 3px rgba(249, 115, 22, 0.2)" : "";
            hideHoverPopup();
          };

          if (browseMode && onLocationSelect) {
            element.onclick = (event) => {
              event.preventDefault();
              event.stopPropagation();
              onLocationSelect({
                label: amenity.name,
                address: amenity.address,
                lat: amenity.lat,
                lng: amenity.lng
              });
            };
          }

          const marker = new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([amenity.lng, amenity.lat])
            .addTo(activeMap);

          overlayMarkerRefs.current.push(marker);
        });
    };

    if (showCrimeOverlay) {
      visibleMapCrimeIncidents.forEach((incident) => {
        const palette =
          incident.category === "violent"
            ? { bg: "#fff0ef", border: "#ba3e2f", text: "#8b271c" }
            : incident.category === "theft"
              ? { bg: "#fff5ec", border: "#c27b39", text: "#8d571f" }
              : { bg: "#fff7f1", border: "#9b6b54", text: "#734430" };
        const element = makeMarkerElement({
          label: "",
          bg: palette.bg,
          border: palette.border,
          text: palette.text,
          compact: true
        });
        element.dataset.mapMarker = "true";
        element.dataset.markerKind = "crime";
        element.style.width = "12px";
        element.style.height = "12px";
        element.style.minWidth = "12px";

        element.onmouseenter = () => {
          element.style.filter = "brightness(0.95)";
          element.style.boxShadow = "0 0 0 3px rgba(186, 62, 47, 0.14)";
          showHoverPopup(incident.lng, incident.lat, incident.label, [
            incident.blockAddress ?? "Approximate nearby block"
          ]);
        };

        element.onmouseleave = () => {
          element.style.filter = "";
          element.style.boxShadow = "";
          hideHoverPopup();
        };

        element.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          setActiveCrimeIncident(incident);
        };

        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([incident.lng, incident.lat])
          .addTo(activeMap);

        overlayMarkerRefs.current.push(marker);
      });
    }

    addAmenityMarkers("grocery", "grocery");
    addAmenityMarkers("gym", "gym");
    addAmenityMarkers("park", "park");
    addAmenityMarkers("restaurant", "restaurant");
    addAmenityMarkers("coffee", "coffee");
    addAmenityMarkers("bar", "bar");

    return () => {
      hoverPopupRef.current?.remove();
      hoverPopupRef.current = null;
    };
  }, [
    activeItem,
    browseMode,
    highlightedBrowseTarget,
    onLocationSelect,
    searchedLocation,
    showCrimeOverlay,
    showPoiOverlays,
    visibleMapAmenities,
    visibleMapCrimeIncidents,
    visibleOverlays
  ]);

  if (!hasMapFocus) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-[32px] border border-dashed border-black/15 bg-white/60 p-8 text-center text-sm text-gray-500">
        No properties match the current filters. Try relaxing a must-have or showing partial matches.
      </div>
    );
  }

  if (!hasMounted) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-[32px] border border-black/10 bg-[#dce8df] p-8 text-center text-sm text-gray-500 shadow-soft">
        Loading map and nearby context…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[32px] border border-black/10 bg-[#dce8df] shadow-soft">
      {topContent ? (
        <div className="border-b border-black/5 bg-white/88 p-4">{topContent}</div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-b border-black/5 bg-white/80 p-4">
        <button
          type="button"
          onClick={() => setShowPoiOverlays((current) => !current)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            showPoiOverlays
              ? "border-moss/20 bg-moss/10 text-moss"
              : "border-black/10 bg-white text-gray-600"
          )}
        >
          <span>POIs</span>
          <span className="rounded-full bg-current/10 px-2 py-0.5 text-[11px]">
            {showPoiOverlays ? "On" : "Off"}
          </span>
        </button>
        <button
          type="button"
          onClick={() =>
            setShowCrimeOverlay((current) => {
              const next = !current;
              if (next) {
                setCrimeDateFilter("30d");
              }
              return next;
            })
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            showCrimeOverlay
              ? "border-clay/20 bg-clay/10 text-clay"
              : "border-black/10 bg-white text-gray-600"
          )}
        >
          <span>Crime</span>
          <span className="rounded-full bg-current/10 px-2 py-0.5 text-[11px]">
            {showCrimeOverlay ? "On" : "Off"}
          </span>
        </button>
        {overlayConfig
          .filter(
            (
              overlay
            ): overlay is (typeof overlayConfig)[number] & { key: Exclude<OverlayKey, "crime"> } =>
              overlay.key !== "crime"
          )
          .map((overlay) => {
            const palette = amenityColorMap[overlay.key];

            return (
              <button
                key={overlay.key}
                type="button"
                onClick={() =>
                  setVisibleOverlays((current) => ({
                    ...current,
                    [overlay.key]: !current[overlay.key]
                  }))
                }
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                style={
                  showPoiOverlays && visibleOverlays[overlay.key]
                    ? {
                        borderColor: palette.border,
                        backgroundColor: palette.bg,
                        color: palette.text
                      }
                    : undefined
                }
              >
                <span>{overlay.label}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={
                    showPoiOverlays && visibleOverlays[overlay.key]
                      ? {
                          backgroundColor: palette.border,
                          color: "#ffffff"
                        }
                      : undefined
                  }
                >
                  {overlayCounts[overlay.key]}
                </span>
              </button>
            );
          })}
      </div>
      {showCrimeOverlay ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-black/5 bg-white/70 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Crime Date
          </span>
          {crimeDateFilterConfig.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setCrimeDateFilter(filter.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                crimeDateFilter === filter.key
                  ? "border-ocean/20 bg-ocean/10 text-ocean"
                  : "border-black/10 bg-white text-gray-600"
              )}
            >
              {filter.label}
            </button>
          ))}
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Type
          </span>
          {crimeCategoryConfig.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() =>
                setCrimeCategoryFilter((current) => ({
                  ...current,
                  [filter.key]: !current[filter.key]
                }))
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                crimeCategoryFilter[filter.key]
                  ? "border-clay/20 bg-clay/10 text-clay"
                  : "border-black/10 bg-white text-gray-600"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative h-[480px]">
        <div ref={mapContainerRef} className="h-full w-full" />
        <div className="absolute bottom-4 left-4 max-w-[300px] rounded-2xl bg-white/92 px-4 py-3 text-xs text-gray-600 shadow">
          <div>
            {getMapStyleUrl()
              ? "Live map tiles are active."
              : "Fallback OpenStreetMap tiles are active. Add NEXT_PUBLIC_GEOAPIFY_KEY for a richer hosted style."}
          </div>
          <div className="mt-1">
            Pan or zoom the map to browse the current area. POIs and crime update automatically for the visible bounds.
          </div>
          {isViewportLoading ? (
            <div className="mt-2 text-[11px] font-semibold text-ocean">
              Refreshing nearby POIs and crime for this view…
            </div>
          ) : null}
          {effectiveIsolatedId ? (
            <button
              type="button"
              onClick={() => {
                if (selectedId !== undefined || onSelectedIdChange) {
                  onSelectedIdChange?.(undefined);
                } else {
                  setIsolatedId(undefined);
                }
              }}
              className="mt-3 inline-flex rounded-full bg-ocean px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Show all listings again
            </button>
          ) : null}
        </div>
      </div>
      {showSummaryPanel ? (
      <div className="border-t border-black/5 bg-white/88 p-4">
        {summaryItem || searchedLocation ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
                {browseMode ? "Selected Location" : summaryItem ? "Selected Home" : "Searched Address"}
              </div>
              <h3 className="mt-1 font-display text-2xl text-ink">
                {summaryItem
                  ? summaryItem.property.neighborhood ?? summaryItem.property.city
                  : searchedLocation?.city || searchedLocation?.canonicalAddress}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {summaryItem?.property.canonicalAddress ?? searchedLocation?.canonicalAddress}
              </p>
            </div>
            {summaryItem ? (
              <div className="grid gap-3 rounded-2xl bg-black/[0.03] p-4 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-gray-500">Overall score</div>
                  <div className="font-semibold text-ink">{summaryItem.score.overallScore}</div>
                </div>
                <div>
                  <div className="text-gray-500">Safety</div>
                  <div className="font-semibold text-ink">{summaryItem.score.safetyScore}</div>
                </div>
                <div>
                  <div className="text-gray-500">Grocery walk</div>
                  <div className="font-semibold text-ink">
                    {formatMinutes(summaryNearestGroceryRoute?.walkingMinutes)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Saved places</div>
                  <div className="font-semibold text-ink">
                    {summarySavedPlaceRoutes.length === 0
                      ? "Unavailable"
                      : summarySavedPlaceRoutes.length === 1
                        ? formatMinutes(summarySavedPlaceRoutes[0]?.driveMinutesPeak)
                        : `${summarySavedPlaceRoutes.length} places • ${formatMinutes(summaryAverageSavedPlacePeak)} avg`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 rounded-2xl bg-black/[0.03] p-4 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-gray-500">Crime incidents</div>
                  <div className="font-semibold text-ink">
                    {formatCompactNumber(visibleMapCrimeIncidents.length)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Nearby POIs</div>
                  <div className="font-semibold text-ink">{visibleMapAmenities.length}</div>
                </div>
                <div>
                  <div className="text-gray-500">Crime overlay</div>
                  <div className="font-semibold text-ink">{showCrimeOverlay ? "On" : "Off"}</div>
                </div>
                <div>
                  <div className="text-gray-500">POI overlay</div>
                  <div className="font-semibold text-ink">{showPoiOverlays ? "On" : "Off"}</div>
                </div>
              </div>
            )}
            <div className="rounded-2xl bg-black/[0.03] p-4 text-sm text-gray-600">
              {summaryItem
                ? `${visibleMapAmenities.length} POIs and ${formatCompactNumber(visibleMapCrimeIncidents.length)} crime incidents are visible in the current map area around this ${browseMode ? "location" : "home"}.`
                : searchedLocation
                  ? `${visibleMapAmenities.length} POIs and ${formatCompactNumber(visibleMapCrimeIncidents.length)} crime incidents are visible in the current map area around this searched address.`
                  : "Map overlays reflect the current visible area."}
            </div>
            {onClearFocus ? (
              <button
                type="button"
                onClick={onClearFocus}
                className="inline-flex w-fit rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink"
              >
                Clear current focus
              </button>
            ) : null}
            {summaryItem && !browseMode ? (
              <Link
                href={buildManualAddressHref(summaryItem.property.canonicalAddress)}
                className="inline-flex rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white"
              >
                Open full analysis
              </Link>
            ) : searchedLocation && !browseMode ? (
              <Link
                href={buildManualAddressHref(searchedLocation.canonicalAddress)}
                className="inline-flex rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white"
              >
                Open full analysis
              </Link>
            ) : browseMode ? (
              <div className="text-xs text-gray-500">
                Click anywhere on the map to analyze that spot, or click a POI marker to score it directly.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      ) : null}
      {activeCrimeIncident ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
                  Crime Detail
                </div>
                <h3 className="mt-1 font-display text-2xl text-ink">{activeCrimeIncident.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveCrimeIncident(null)}
                className="rounded-full border border-black/10 px-3 py-1 text-sm font-semibold text-ink"
              >
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
              <div>
                <div className="text-gray-500">Category</div>
                <div className="font-semibold capitalize text-ink">{activeCrimeIncident.category}</div>
              </div>
              <div>
                <div className="text-gray-500">Reported date</div>
                <div className="font-semibold text-ink">
                  {new Date(activeCrimeIncident.occurredAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-gray-500">Approximate location</div>
                <div className="font-semibold text-ink">
                  {activeCrimeIncident.blockAddress ?? "Reported location is rounded to nearby block"}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-gray-500">Source</div>
                <div className="font-semibold text-ink">{activeCrimeIncident.sourceName}</div>
              </div>
              {activeCrimeIncident.metadata ? (
                <div className="sm:col-span-2">
                  <div className="text-gray-500">Metadata</div>
                  <pre className="mt-2 overflow-x-auto rounded-2xl bg-black/[0.03] p-3 text-xs text-gray-600">
                    {JSON.stringify(activeCrimeIncident.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

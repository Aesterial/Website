"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat, toLonLat } from "ol/proj";
import { Fill, Stroke, Style, Text, RegularShape } from "ol/style";
import { defaults as defaultControls } from "ol/control";
import "ol/ol.css";

export type MapMarker = {
  id: string;
  coordinates: [number, number]; // [lng, lat]
  title: string;
  description?: string;
};

type MapLibreMapProps = {
  center?: [number, number];
  zoom?: number;
  className?: string;
  markers?: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (coordinates: [number, number]) => void;
};

const DEFAULT_CENTER: [number, number] = [86.0877, 55.3541];

const markerStyleCache = new Map<string, Style>();

const formatMarkerTitle = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 28) {
    return trimmed;
  }
  return `${trimmed.slice(0, 26).trimEnd()}…`;
};

const getMarkerStyle = (title: string) => {
  const label = formatMarkerTitle(title);
  const cacheKey = label || "__default";
  const cached = markerStyleCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const style = new Style({
    image: new RegularShape({
      points: 3,
      radius: 10,
      rotation: Math.PI / 2,
      fill: new Fill({ color: "#111827" }),
      stroke: new Stroke({ color: "#ffffff", width: 2 }),
    }),
    text: label
      ? new Text({
          text: label,
          font: "600 12px system-ui, -apple-system, 'Segoe UI', sans-serif",
          offsetY: -18,
          textAlign: "center",
          textBaseline: "bottom",
          fill: new Fill({ color: "#111827" }),
          backgroundFill: new Fill({ color: "rgba(255, 255, 255, 0.92)" }),
          padding: [2, 6, 2, 6],
        })
      : undefined,
  });
  markerStyleCache.set(cacheKey, style);
  return style;
};

export function MapLibreMap({
  center = DEFAULT_CENTER,
  zoom = 12,
  className = "",
  markers = [],
  onMarkerClick,
  onMapClick,
}: MapLibreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerSourceRef = useRef<VectorSource | null>(null);

  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
  }, [onMarkerClick, onMapClick]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const tileSource = new OSM();
    tileSource.on("tileloaderror", () => {
      setLoadError("Map tiles failed to load. Check your connection.");
    });

    const markerSource = new VectorSource();
    const markerLayer = new VectorLayer({
      source: markerSource,
    });

    const map = new Map({
      target: mapContainerRef.current,
      layers: [new TileLayer({ source: tileSource }), markerLayer],
      view: new View({
        center: fromLonLat(center),
        zoom,
      }),
      controls: defaultControls({
        attribution: false,
        rotate: false,
        zoom: true,
      }),
    });

    map.once("rendercomplete", () => {
      setIsLoaded(true);
      setLoadError(null);
    });

    map.on("pointermove", (event) => {
      const element = map.getTargetElement();
      if (!element) return;
      const hit = map.hasFeatureAtPixel(event.pixel);
      element.style.cursor = hit ? "pointer" : "";
    });

    map.on("singleclick", (event) => {
      let clickedMarker: MapMarker | null = null;
      map.forEachFeatureAtPixel(event.pixel, (feature) => {
        const marker = feature.get("marker") as MapMarker | undefined;
        if (marker) {
          clickedMarker = marker;
          return true;
        }
        return false;
      });

      if (clickedMarker) {
        onMarkerClickRef.current?.(clickedMarker);
        return;
      }

      if (onMapClickRef.current) {
        const [lng, lat] = toLonLat(event.coordinate);
        onMapClickRef.current([lng, lat]);
      }
    });

    mapRef.current = map;
    markerSourceRef.current = markerSource;

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
      mapRef.current = null;
      markerSourceRef.current = null;
      setIsLoaded(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const view = map.getView();
    view.animate({
      center: fromLonLat(center),
      zoom,
      duration: 800,
    });
  }, [center, zoom]);

  useEffect(() => {
    const source = markerSourceRef.current;
    if (!source) return;

    source.clear(true);

    markers.forEach((markerData) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat(markerData.coordinates)),
      });
      feature.set("marker", markerData);
      feature.setStyle(getMarkerStyle(markerData.title));
      source.addFeature(feature);
    });
  }, [markers]);

  return (
    <motion.div
      className={`relative flex flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
        <span className="ml-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
          Interactive Map
        </span>
      </div>

      <div className="relative flex-1 min-h-[300px] sm:min-h-[400px]">
        <AnimatePresence>
          {!isLoaded && (
            <motion.div
              key="loader"
              className="absolute inset-0 z-10 flex items-center justify-center bg-muted"
              exit={{ opacity: 0 }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs font-medium text-muted-foreground animate-pulse">
                  Loading map...
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loadError ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/90 px-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              {loadError}
            </p>
          </div>
        ) : null}

        <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
      </div>
    </motion.div>
  );
}

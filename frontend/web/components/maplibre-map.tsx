"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type OlMap from "ol/Map";
import type VectorSource from "ol/source/Vector";
import type { Style as OlStyle } from "ol/style";
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

type OlModules = {
  Map: typeof import("ol/Map").default;
  View: typeof import("ol/View").default;
  TileLayer: typeof import("ol/layer/Tile").default;
  VectorLayer: typeof import("ol/layer/Vector").default;
  VectorSource: typeof import("ol/source/Vector").default;
  OSM: typeof import("ol/source/OSM").default;
  Feature: typeof import("ol/Feature").default;
  Point: typeof import("ol/geom/Point").default;
  fromLonLat: typeof import("ol/proj").fromLonLat;
  toLonLat: typeof import("ol/proj").toLonLat;
  Fill: typeof import("ol/style").Fill;
  Stroke: typeof import("ol/style").Stroke;
  Style: typeof import("ol/style").Style;
  Text: typeof import("ol/style").Text;
  RegularShape: typeof import("ol/style").RegularShape;
  defaultControls: typeof import("ol/control").defaults;
};

const markerStyleCache = new Map<string, OlStyle>();

const loadOlModules = async (): Promise<OlModules> => {
  const [
    mapModule,
    viewModule,
    tileLayerModule,
    vectorLayerModule,
    vectorSourceModule,
    osmModule,
    featureModule,
    pointModule,
    projModule,
    styleModule,
    controlModule,
  ] = await Promise.all([
    import("ol/Map"),
    import("ol/View"),
    import("ol/layer/Tile"),
    import("ol/layer/Vector"),
    import("ol/source/Vector"),
    import("ol/source/OSM"),
    import("ol/Feature"),
    import("ol/geom/Point"),
    import("ol/proj"),
    import("ol/style"),
    import("ol/control"),
  ]);

  return {
    Map: mapModule.default,
    View: viewModule.default,
    TileLayer: tileLayerModule.default,
    VectorLayer: vectorLayerModule.default,
    VectorSource: vectorSourceModule.default,
    OSM: osmModule.default,
    Feature: featureModule.default,
    Point: pointModule.default,
    fromLonLat: projModule.fromLonLat,
    toLonLat: projModule.toLonLat,
    Fill: styleModule.Fill,
    Stroke: styleModule.Stroke,
    Style: styleModule.Style,
    Text: styleModule.Text,
    RegularShape: styleModule.RegularShape,
    defaultControls: controlModule.defaults,
  };
};

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

const getMarkerStyle = (ol: OlModules, title: string) => {
  const label = formatMarkerTitle(title);
  const cacheKey = label || "__default";
  const cached = markerStyleCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const style = new ol.Style({
    image: new ol.RegularShape({
      points: 3,
      radius: 10,
      rotation: Math.PI / 2,
      fill: new ol.Fill({ color: "#111827" }),
      stroke: new ol.Stroke({ color: "#ffffff", width: 2 }),
    }),
    text: label
      ? new ol.Text({
          text: label,
          font: "600 12px system-ui, -apple-system, 'Segoe UI', sans-serif",
          offsetY: -18,
          textAlign: "center",
          textBaseline: "bottom",
          fill: new ol.Fill({ color: "#111827" }),
          backgroundFill: new ol.Fill({ color: "rgba(255, 255, 255, 0.92)" }),
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
  const mapRef = useRef<OlMap | null>(null);
  const markerSourceRef = useRef<VectorSource | null>(null);
  const [ol, setOl] = useState<OlModules | null>(null);

  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (typeof window === "undefined") {
      return () => {
        active = false;
      };
    }

    loadOlModules()
      .then((modules) => {
        if (active) {
          setOl(modules);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError("Map failed to load. Please try again.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
  }, [onMarkerClick, onMapClick]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !ol) return;

    const tileSource = new ol.OSM();
    tileSource.on("tileloaderror", () => {
      setLoadError("Map tiles failed to load. Check your connection.");
    });

    const markerSource = new ol.VectorSource();
    const markerLayer = new ol.VectorLayer({
      source: markerSource,
    });

    const map = new ol.Map({
      target: mapContainerRef.current,
      layers: [new ol.TileLayer({ source: tileSource }), markerLayer],
      view: new ol.View({
        center: ol.fromLonLat(center),
        zoom,
      }),
      controls: ol.defaultControls({
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
        const [lng, lat] = ol.toLonLat(event.coordinate);
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
  }, [center, zoom, ol]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ol) return;

    const view = map.getView();
    view.animate({
      center: ol.fromLonLat(center),
      zoom,
      duration: 800,
    });
  }, [center, zoom, ol]);

  useEffect(() => {
    const source = markerSourceRef.current;
    if (!source || !ol) return;

    source.clear(true);

    markers.forEach((markerData) => {
      const feature = new ol.Feature({
        geometry: new ol.Point(ol.fromLonLat(markerData.coordinates)),
      });
      feature.set("marker", markerData);
      feature.setStyle(getMarkerStyle(ol, markerData.title));
      source.addFeature(feature);
    });
  }, [markers, ol]);

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

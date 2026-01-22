"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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

export function MapLibreMap({
  center = DEFAULT_CENTER,
  zoom = 12,
  className = "",
  markers = [],
  onMarkerClick,
  onMapClick,
}: MapLibreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapClickRef = useRef(onMapClick);

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onMapClickRef.current = onMapClick;
  }, [onMarkerClick, onMapClick]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,

      style: "https://api.maptiler.com/maps/toner-v2/style.json?key=wjV3hWuYtgJbK3Nmy76Z",
      center: center,
      zoom: zoom,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      setIsLoaded(true);
      map.resize();
    });

    map.on("click", (event) => {
      onMapClickRef.current?.([event.lngLat.lng, event.lngLat.lat]);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && isLoaded) {
      mapRef.current.easeTo({
        center,
        zoom,
        duration: 800,
        essential: true,
      });
    }
  }, [center, zoom, isLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    markers.forEach((markerData) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "map-custom-marker";

      Object.assign(el.style, {
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        backgroundColor: "#111827",
        border: "2px solid #ffffff",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        cursor: "pointer",
        transition: "transform 0.2s ease",
      });

      el.addEventListener(
        "mouseenter",
        () => (el.style.transform = "scale(1.2)"),
      );
      el.addEventListener(
        "mouseleave",
        () => (el.style.transform = "scale(1)"),
      );

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onMarkerClickRef.current?.(markerData);
      });

      const m = new maplibregl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat(markerData.coordinates)
        .addTo(map);

      markersRef.current.push(m);
    });
  }, [markers, isLoaded]);

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
                  Инициализация карты...
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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
 
    const hasSetter = "setWorkerUrl" in maplibregl;
  
    if (hasSetter) {
 
      if (!maplibregl.getWorkerUrl?.()) {
        maplibregl.setWorkerUrl(
          new URL(
            "maplibre-gl/dist/maplibre-gl-csp-worker.js",
            import.meta.url,
          ).toString(),
        );
      }
    } else {
      
      (maplibregl as any).workerUrl ??= new URL(
        "maplibre-gl/dist/maplibre-gl-csp-worker.js",
        import.meta.url,
      ).toString();
    }
    
    
  }, []);



  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center,
      zoom,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => setIsLoaded(true));
    map.on("click", (event) => {
      onMapClickRef.current?.([event.lngLat.lng, event.lngLat.lat]);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    map.easeTo({ center, zoom, duration: 600 });
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    markers.forEach((marker) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", marker.title);
      button.title = marker.title;
      button.style.width = "14px";
      button.style.height = "14px";
      button.style.borderRadius = "9999px";
      button.style.background = "#111827";
      button.style.border = "2px solid #ffffff";
      button.style.boxShadow = "0 8px 18px rgba(0,0,0,0.28)";
      button.style.cursor = "pointer";

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onMarkerClickRef.current?.(marker);
      });

      const mapMarker = new maplibregl.Marker({
        element: button,
        anchor: "bottom",
      })
        .setLngLat(marker.coordinates)
        .addTo(map);

      markersRef.current.push(mapMarker);
    });
  }, [markers]);

  return (
    <motion.div
      className={`relative flex flex-col overflow-hidden rounded-3xl ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <div className="bg-card border-b border-border px-3 py-2 flex items-center gap-2 sm:px-4 sm:py-3">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
      </div>

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <motion.div
            className="text-muted-foreground"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
          >
            Loading map...
          </motion.div>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="w-full flex-1 min-h-[260px] bg-muted sm:min-h-[320px] lg:min-h-[360px]"
      />
    </motion.div>
  );
}

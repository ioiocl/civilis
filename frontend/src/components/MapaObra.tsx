"use client";

import { useEffect, useRef } from "react";

export default function MapaObra({ lat, lng, nombre }: { lat: number; lng: number; nombre: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css" as any);

      const map = L.map(containerRef.current!).setView([lat, lng], 17);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const redIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#ef4444;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([lat, lng], { icon: redIcon }).addTo(map).bindPopup(nombre).openPopup();

      mapRef.current = map;
    }

    void init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, nombre]);

  return <div ref={containerRef} style={{ height: "300px", width: "100%" }} className="rounded-xl overflow-hidden" />;
}

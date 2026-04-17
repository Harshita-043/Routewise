import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteMapProps {
  geometry: [number, number][];
  source: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  mode?: "train" | "bus" | "carpool" | "taxi";
  nearbyStations?: Array<{
    code: string;
    name: string;
    mode: "railway" | "bus";
    location: { coordinates: [number, number] };
  }>;
  liveTrainLocation?: { lat: number; lng: number } | null;
}

const routeColorMap = {
  train: "#2563EB",
  bus: "#EAB308",
  carpool: "#16A34A",
  taxi: "#DC2626",
};

export default function RouteMap({
  geometry,
  source,
  destination,
  mode = "train",
  nearbyStations = [],
  liveTrainLocation = null,
}: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const routeColor = routeColorMap[mode];

    // Clear existing layers using a cleaner approach if needed, but simple clear is fine
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.LayerGroup) {
        // Don't remove tile layers
        if (!(layer instanceof L.TileLayer)) {
          map.removeLayer(layer);
        }
      }
    });

    const markers: L.Marker[] = [];

    // Create custom icons
    const sourceIcon = L.divIcon({
      className: "custom-marker",
      html: `<div class="marker-pulse" style="width: 32px; height: 32px; background: linear-gradient(135deg, #4F46E5, #6366F1); border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 10px rgba(79, 70, 229, 0.4); display: flex; align-items: center; justify-content: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const destIcon = L.divIcon({
      className: "custom-marker",
      html: `<div style="width: 32px; height: 32px; background: linear-gradient(135deg, #14B8A6, #2DD4BF); border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 10px rgba(20, 184, 166, 0.4); display: flex; align-items: center; justify-content: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    // Add markers
    const sMarker = L.marker([source.lat, source.lng], { icon: sourceIcon })
      .bindPopup(`<strong>Start:</strong> ${source.name}`)
      .addTo(map);
    markers.push(sMarker);

    const dMarker = L.marker([destination.lat, destination.lng], { icon: destIcon })
      .bindPopup(`<strong>End:</strong> ${destination.name}`)
      .addTo(map);
    markers.push(dMarker);

    nearbyStations.forEach((station) => {
      const isRail = station.mode === "railway";
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width: 24px; height: 24px; background: ${isRail ? "#2563EB" : "#EAB308"}; border-radius: 8px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px;">${isRail ? "T" : "B"}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const stMarker = L.marker([station.location.coordinates[1], station.location.coordinates[0]], { icon })
        .bindPopup(`<strong>${station.name}</strong><br/>${station.code}`)
        .addTo(map);
      markers.push(stMarker);
    });

    if (liveTrainLocation) {
      const liveIcon = L.divIcon({
        className: "custom-marker",
        html: `<div class="live-marker" style="width: 36px; height: 36px; background: #0F172A; border-radius: 50%; border: 3px solid #38BDF8; box-shadow: 0 0 15px rgba(56, 189, 248, 0.6); display: flex; align-items: center; justify-content: center; color: #38BDF8; font-weight: bold; font-size: 14px;">T</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const lMarker = L.marker([liveTrainLocation.lat, liveTrainLocation.lng], { icon: liveIcon })
        .bindPopup("<strong>Live train position</strong>")
        .addTo(map);
      markers.push(lMarker);
    }

    // Add route line with animation
    if (geometry.length > 0) {
      // Glow/Shadow line
      L.polyline(geometry, {
        color: routeColor,
        weight: 10,
        opacity: 0.15,
        lineCap: "round",
      }).addTo(map);

      // Main line
      const routeLine = L.polyline(geometry, {
        color: routeColor,
        weight: 5,
        opacity: 0.8,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      // Animated "Marching Ants" overlay
      L.polyline(geometry, {
        color: "#ffffff",
        weight: 2,
        opacity: 0.5,
        dashArray: "10, 20",
        lineCap: "round",
        className: "route-line-animation"
      }).addTo(map);

      // Fit bounds to everything
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().extend(routeLine.getBounds()), { padding: [50, 50] });
    } else if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }, [geometry, source, destination, mode, nearbyStations, liveTrainLocation]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-lg">
      <div ref={mapRef} className="w-full h-[350px] md:h-[400px]" />
      <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground border border-border/50">
        © OpenStreetMap contributors
      </div>
    </div>
  );
}

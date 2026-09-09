'use client';

import { dt } from '@/i18n/auto';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import type { NearbyFreelancer } from '@/hooks/use-nearby';
/**
 * Leaflet + OSM map. No API key needed. Tiles served from OpenStreetMap
 * (please respect their Nominatim usage policy — we cache aggressively
 * on the API side and only refetch when the user moves the map).
 */

// Rebuild the default marker icon so Leaflet's asset URLs work through Vercel.
const AVATAR_ICON = L.divIcon({
  className: 'apex-marker',
  html: `<div style="
    width: 28px; height: 28px; border-radius: 999px;
    background: linear-gradient(135deg, #7c3aed, #10b981);
    border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,.3);
    display: grid; place-items: center; color: white; font-weight: 800;
    font-size: 11px;
  ">•</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const YOU_ICON = L.divIcon({
  className: 'apex-you-marker',
  html: `<div style="
    width: 18px; height: 18px; border-radius: 999px;
    background: #3b82f6; border: 3px solid white;
    box-shadow: 0 0 0 4px rgba(59,130,246,.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface Props {
  center: [number, number];
  radiusKm: number;
  items: NearbyFreelancer[];
  onMove: (next: [number, number]) => void;
}

function MoveListener({ onMove }: { onMove: (c: [number, number]) => void }) {
  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      onMove([c.lat, c.lng]);
    },
  });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export function NearbyMap({ center, radiusKm, items, onMove }: Props) {
  return (
    <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MoveListener onMove={onMove} />
      <Recenter center={center} />
      <Marker position={center} icon={YOU_ICON}>
        <Popup>{dt('You are here')}</Popup>
      </Marker>
      <Circle
        center={center}
        radius={radiusKm * 1000}
        pathOptions={{ color: '#7c3aed', fillOpacity: 0.06 }}
      />
      {items.map((f) => (
        <Marker key={f.id} position={[f.latitude, f.longitude]} icon={AVATAR_ICON}>
          <Popup>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{f.fullName}</div>
            <div style={{ fontSize: 11, color: '#666', margin: '2px 0 4px' }}>
              {f.title ?? '@' + f.username}
            </div>
            <div style={{ fontSize: 11 }}>
              {f.distanceKm.toFixed(1)} km · ⭐ {f.rating.toFixed(1)}
            </div>
            <a
              href={`/u/${f.username}`}
              style={{
                display: 'inline-block',
                marginTop: 6,
                fontSize: 12,
                color: '#7c3aed',
                fontWeight: 700,
              }}
            >
              View profile →
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface NearbyFreelancer {
  id: string; username: string; fullName: string; avatarUrl: string | null;
  title: string | null; city: string | null;
  rating: number; ratingCount: number; hourlyRateEtb: number | null;
  latitude: number; longitude: number; distanceKm: number;
}

export function useNearbyFreelancers(lat: number | null, lon: number | null, radiusKm: number) {
  const enabled = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon);
  // Round the lat/lon so we don't invalidate the cache on every 1cm map pan.
  const rlat = enabled ? Number(lat!.toFixed(3)) : null;
  const rlon = enabled ? Number(lon!.toFixed(3)) : null;
  return useQuery<{ items: NearbyFreelancer[] }>({
    queryKey: ['nearby', rlat, rlon, radiusKm],
    queryFn: () => apiFetch(`/geo/nearby-freelancers?lat=${rlat}&lon=${rlon}&radiusKm=${radiusKm}&limit=100`),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

'use client';

import { dt } from '@/i18n/auto';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Locate, Loader2, MapPin, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNearbyFreelancers } from '@/hooks/use-nearby';
import { useMe } from '@/hooks/use-me';
import { useI18n } from '@/i18n';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { formatEtb } from '@/lib/utils';
// Leaflet is browser-only; SSR it out.
const NearbyMap = dynamic(() => import('@/components/nearby-map').then((m) => m.NearbyMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-muted">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

// Addis Ababa default center for anyone who hasn't shared their location.
const DEFAULT_CENTER: [number, number] = [9.005401, 38.763611];

export default function NearbyPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me } = useMe();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [radius, setRadius] = useState(15);
  const [locating, setLocating] = useState(false);
  const { data, isLoading } = useNearbyFreelancers(center[0], center[1], radius);

  useEffect(() => {
    // Try to auto-locate the user on first mount — silent failure.
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
        () => undefined,
        { enableHighAccuracy: false, timeout: 4000 },
      );
    }
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const items = data?.items ?? [];

  return (
    <MobileShell>
      <div className="min-h-dvh bg-background pb-24">
        <header className="safe-top sticky top-0 z-10 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label={t('common.back')}
              className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-extrabold tracking-tight">{dt('Nearby freelancers')}</h1>
              <div className="text-[11px] text-muted-foreground">
                {isLoading ? 'Searching…' : `${items.length} within ${radius} km`}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={locateMe} disabled={locating}>
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Locate className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {[5, 10, 15, 25, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${
                  radius === r
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </header>

        {/* Map */}
        <div className="relative h-[45dvh] w-full overflow-hidden">
          <NearbyMap center={center} radiusKm={radius} items={items} onMove={setCenter} />
        </div>

        {/* List */}
        <div className="mx-3 mt-4 space-y-2">
          {items.length === 0 && !isLoading && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <Users className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">{dt('No freelancers here yet')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Widen the radius or move the map. Freelancers must opt in to appear on the map.
              </p>
              {me?.role === 'FREELANCER' && (
                <Button asChild size="sm" variant="brand" className="mt-3">
                  <Link href="/settings/profile">{dt('Add my location')}</Link>
                </Button>
              )}
            </div>
          )}
          {items.map((f) => (
            <Link
              key={f.id}
              href={`/u/${f.username}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              {f.avatarUrl ? (
                <Image
                  src={f.avatarUrl}
                  alt={f.fullName}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="grad-hero grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white">
                  {(f.fullName[0] ?? '?').toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{f.fullName}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {f.title ?? '@' + f.username}
                  {f.hourlyRateEtb ? ` · ${formatEtb(f.hourlyRateEtb)}/hr` : ''}
                </div>
              </div>
              <div className="text-right text-[11px]">
                <div className="inline-flex items-center gap-1 font-bold text-primary">
                  <MapPin className="h-3 w-3" /> {f.distanceKm.toFixed(1)} km
                </div>
                {f.ratingCount > 0 && (
                  <div className="text-muted-foreground">
                    <Star className="mr-0.5 inline h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {f.rating.toFixed(1)}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}

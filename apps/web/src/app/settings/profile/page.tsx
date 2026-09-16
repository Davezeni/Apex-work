'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useUpload } from '@/hooks/use-upload';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { contentTypeForFile } from '@/lib/file-types';
import { safeBack } from '@/lib/safe-back';
export default function EditProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading, isAuthed } = useMe();
  const upload = useUpload();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [rate, setRate] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !isAuthed) router.replace('/login?next=/settings/profile');
  }, [isLoading, isAuthed, router]);

  useEffect(() => {
    if (!me) return;
    setFullName(me.fullName);
    setBio(me.bio ?? '');
    setTitle(me.title ?? '');
    setCity(me.city ?? '');
    setRate(me.hourlyRateEtb != null ? String(me.hourlyRateEtb) : '');
    setEmail(me.email ?? '');
    setAvatarUrl(me.avatarUrl);
    // Optional lat/lon from the API — the /me endpoint doesn't return
    // them yet, so we default to null. When it does, wire them here.
    const anyMe = me as unknown as { latitude?: number | null; longitude?: number | null };
    setLatitude(anyMe.latitude ?? null);
    setLongitude(anyMe.longitude ?? null);
  }, [me]);

  const captureLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error(dt('Geolocation not available'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
        toast.success(dt('Location captured — save to publish'));
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || 'Could not get location');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const clearLocation = () => {
    setLatitude(null);
    setLongitude(null);
  };

  const onPickPhoto = () => fileRef.current?.click();

  const onPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error(t('editProfile.photoTooLarge'));
    if (!/^(image\/(jpeg|png|webp))$/.test(contentTypeForFile(file)))
      return toast.error(t('editProfile.photoBadType'));
    try {
      const res = await upload.mutateAsync({ file, bucket: 'avatars' });
      setAvatarUrl(res.publicUrl);
      toast.success(t('editProfile.photoUpdated'));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('editProfile.saveFailed'));
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: {
          fullName: fullName.trim(),
          bio: bio.trim() || null,
          title: title.trim() || null,
          city: city.trim() || null,
          hourlyRateEtb: rate.trim() ? Number(rate) : null,
          email: email.trim() || null,
          avatarUrl: avatarUrl ?? null,
          latitude,
          longitude,
        },
      });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast.success(t('editProfile.saved'));
      safeBack(router, '/profile');
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? t('editProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials =
    me.fullName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="min-h-dvh bg-background pb-32">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{t('editProfile.title')}</h1>
      </header>

      {/* Avatar */}
      <div className="mt-6 flex flex-col items-center">
        <div className="relative">
          <div className="grad-hero grid h-24 w-24 place-items-center overflow-hidden rounded-full text-3xl font-extrabold text-white ring-4 ring-background">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={me.fullName}
                width={96}
                height={96}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <button
            onClick={onPickPhoto}
            disabled={upload.isPending}
            aria-label={t('editProfile.changePhoto')}
            className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-background bg-primary text-white shadow-md active:scale-90"
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPhotoFile}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('editProfile.changePhoto')}</p>
      </div>

      {/* Fields */}
      <div className="mx-4 mt-6 space-y-4">
        <Field label={t('editProfile.fullName')}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </Field>

        <Field label={t('editProfile.title2')}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={dt('Full-stack developer')}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </Field>

        <Field label={t('editProfile.bio')} hint={t('editProfile.bioHint')}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('editProfile.city')}>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={60}
              placeholder={dt('Addis Ababa')}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
          </Field>

          {me.role === 'FREELANCER' && (
            <Field label={t('editProfile.rate')}>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder={dt('500')}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              />
            </Field>
          )}
        </div>

        <Field label={t('editProfile.email')}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder={dt('you@example.com')}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </Field>

        {me.role === 'FREELANCER' && (
          <Field label={dt('Show me on the nearby map')}>
            <div className="rounded-2xl border border-border bg-card p-3">
              {latitude != null && longitude != null ? (
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                    📍
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="font-bold">{dt('Location captured')}</div>
                    <div className="text-muted-foreground">
                      {latitude.toFixed(4)}, {longitude.toFixed(4)}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={clearLocation}>
                    {dt('Clear')}
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    Opt in so clients looking for local talent can find you on the map.
                  </p>
                  <Button
                    size="sm"
                    variant="brand"
                    className="mt-2"
                    onClick={captureLocation}
                    disabled={locating}
                  >
                    {locating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '📍 Use my current location'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </Field>
        )}
      </div>

      {/* Sticky save */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={saving || fullName.trim().length < 2}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('editProfile.save')}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

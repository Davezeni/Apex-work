'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Search as SearchIcon, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useCreateGroup } from '@/hooks/use-groups';
import { useGlobalSearch } from '@/hooks/use-search';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
interface Picked {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
}

export default function NewGroupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data: me, isLoading, isAuthed } = useMe();
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const search = useGlobalSearch(q, 12);
  const create = useCreateGroup();

  useEffect(() => {
    if (!isLoading && !isAuthed) router.replace('/login?next=/messages/new-group');
  }, [isLoading, isAuthed, router]);

  const toggle = (u: Picked) => {
    setPicked((p) =>
      p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u].slice(0, 50),
    );
  };

  const submit = async () => {
    if (title.trim().length < 2) return toast.error(dt('Group needs a name'));
    if (picked.length === 0) return toast.error(dt('Add at least one member'));
    try {
      const conv = await create.mutateAsync({
        title: title.trim(),
        memberIds: picked.map((p) => p.id),
      });
      toast.success(dt('Group created 🎉'));
      router.replace(`/messages/${conv.id}`);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Could not create group');
    }
  };

  const results = (search.data?.users ?? []).filter((u) => u.id !== me?.id);

  return (
    <div className="min-h-dvh bg-background pb-32">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">{dt('New group')}</h1>
      </header>

      <div className="mx-3 mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {dt('Group name')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={dt('Project · Team · Anything')}
            className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>

        {picked.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {picked.length} member{picked.length === 1 ? '' : 's'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(p)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-1 pr-2 text-xs"
                >
                  {p.avatarUrl ? (
                    <Image
                      src={p.avatarUrl}
                      alt={p.fullName}
                      width={20}
                      height={20}
                      unoptimized
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grad-hero grid h-5 w-5 place-items-center rounded-full text-[8px] font-bold text-white">
                      {(p.fullName[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                  <span>{p.fullName}</span>
                  <span className="opacity-60">×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dt('Add people…')}
            className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-1">
          {results.map((u) => {
            const on = picked.some((p) => p.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                  on ? 'border-primary bg-primary/10' : 'border-border bg-card',
                )}
              >
                {u.avatarUrl ? (
                  <Image
                    src={u.avatarUrl}
                    alt={u.fullName}
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="grad-hero grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white">
                    {(u.fullName[0] ?? '?').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{u.fullName}</div>
                  <div className="text-[11px] text-muted-foreground">@{u.username}</div>
                </div>
                {on && <Check className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
          {q.trim().length < 2 && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Type a name or @username to find people.
            </p>
          )}
        </div>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur-xl">
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={create.isPending || picked.length === 0 || title.trim().length < 2}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `Create group (${picked.length})`
          )}
        </Button>
      </div>
    </div>
  );
}

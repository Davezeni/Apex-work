'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2, Star, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import { useMySkills, useAddSkill, useSetLevel, useRemoveSkill } from '@/hooks/use-user-skills';
import { useSuggest } from '@/hooks/use-search';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
const LEVELS = [
  { n: 1, label: 'Beginner' },
  { n: 2, label: 'Practiced' },
  { n: 3, label: 'Confident' },
  { n: 4, label: 'Advanced' },
  { n: 5, label: 'Expert' },
] as const;

export function SkillsBody() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const { data, isLoading } = useMySkills();
  const add = useAddSkill();
  const setLevel = useSetLevel();
  const remove = useRemoveSkill();
  const [input, setInput] = useState('');
  const [level, setLevelState] = useState(3);
  const { data: sug } = useSuggest(input);

  if (isLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const addByName = async (name: string) => {
    if (!name.trim() || name.length > 40) return;
    try {
      await add.mutateAsync({ name, level });
      setInput('');
      toast.success(dt('Skill added'));
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Could not add skill');
    }
  };

  const skillSuggestions = (sug?.items ?? []).filter((i) => i.type === 'skill').slice(0, 6);

  return (
    <div className="bg-background">
      {/* Add */}
      <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {dt('Add a skill')}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dt('React, Amharic copywriting, Figma…')}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                e.preventDefault();
                addByName(input.trim());
              }
            }}
          />
          <Button
            variant="brand"
            size="default"
            disabled={!input.trim() || add.isPending}
            onClick={() => addByName(input.trim())}
          >
            {add.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
        {skillSuggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {skillSuggestions.map((s) => (
              <button
                key={s.ref ?? s.text}
                onClick={() => addByName(s.text)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] hover:border-primary/40"
              >
                <Sparkles className="h-2.5 w-2.5 text-primary" /> {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Level picker */}
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">
            {dt('Your level')}
          </div>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {LEVELS.map((l) => (
              <button
                key={l.n}
                onClick={() => setLevelState(l.n)}
                className={cn(
                  'rounded-lg border py-1.5 text-[11px] font-semibold',
                  level === l.n
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* My skills */}
      <section className="mx-3 mt-4">
        <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Your skills ({data?.items.length ?? 0})
        </h2>
        <div className="space-y-2">
          {(data?.items ?? []).map((row) => (
            <div key={row.skillId} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{row.skill.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {LEVELS.find((l) => l.n === row.level)?.label ?? 'Unrated'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Remove this skill?')) remove.mutate(row.skillId);
                  }}
                  aria-label={dt('Remove')}
                  className="grid h-8 w-8 place-items-center rounded-full text-red-500 active:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Star-rating strip */}
              <div className="mt-2 flex gap-1">
                {LEVELS.map((l) => (
                  <button
                    key={l.n}
                    onClick={() => setLevel.mutate({ skillId: row.skillId, level: l.n })}
                    aria-label={`Level ${l.n}`}
                    className="p-0.5"
                  >
                    <Star
                      className={cn(
                        'h-4 w-4',
                        row.level >= l.n
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-muted-foreground/30',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {(data?.items.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-semibold">{dt('No skills yet')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your first skill above — clients search by these.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

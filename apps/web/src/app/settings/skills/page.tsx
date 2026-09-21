'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { safeBack } from '@/lib/safe-back';
import { useI18n } from '@/i18n';
import { SkillsBody } from '@/components/settings/skills-body';

export default function SkillsManagerPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { isLoading: meLoading, isAuthed } = useMe();

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/settings/skills');
  }, [meLoading, isAuthed, router]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Skills</h1>
          <div className="text-[10px] text-muted-foreground">
            Rank yourself · Show clients what you do
          </div>
        </div>
      </header>
      <SkillsBody />
    </div>
  );
}

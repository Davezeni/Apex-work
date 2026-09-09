'use client';

import { dt } from '@/i18n/auto';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Users, Check } from 'lucide-react';
import { useJoinGroup } from '@/hooks/use-chat';
import { useMe } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { useI18n } from '@/i18n';
export default function JoinGroupPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthed } = useMe();
  const join = useJoinGroup();
  const { t } = useI18n();
  const [joined, setJoined] = useState(false);

  const doJoin = () => {
    join.mutate(token, {
      onSuccess: (r) => {
        setJoined(true);
        toast.success(dt('You joined the group'));
        setTimeout(() => router.push(`/messages/${r.conversationId}`), 800);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <MobileShell activeTab="chat">
      <div className="flex min-h-[85dvh] flex-col items-center justify-center px-6 text-center">
        <div className="grad-hero grid h-20 w-20 place-items-center rounded-3xl text-white shadow-xl shadow-primary/30">
          <Users className="h-9 w-9" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold">{t('chat.groupInvite')}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {joined ? t('chat.joined') : t('chat.joinGroupBody')}
        </p>
        {!isAuthed ? (
          <div className="mt-6 flex gap-3">
            <Button asChild variant="brand" size="lg">
              <a href="/login">{t('chat.signInToJoin')}</a>
            </Button>
          </div>
        ) : joined ? (
          <div className="mt-6 grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
            <Check className="h-6 w-6" />
          </div>
        ) : (
          <Button
            onClick={doJoin}
            disabled={join.isPending}
            variant="brand"
            size="lg"
            className="mt-6"
          >
            {join.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : t('chat.joinGroup')}
          </Button>
        )}
      </div>
    </MobileShell>
  );
}

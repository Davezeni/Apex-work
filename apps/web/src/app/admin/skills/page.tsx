'use client';

import { dt } from '@/i18n/auto';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useMe } from '@/hooks/use-me';
import { safeBack } from '@/lib/safe-back';
interface ModeratedSkill {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  isApproved: boolean;
  createdBy: { id: string; username: string; fullName: string } | null;
}

export default function AdminSkillsPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.accessToken);
  const { data: me, isLoading: meLoading } = useMe();
  const queryClient = useQueryClient();
  const skills = useQuery<{ items: ModeratedSkill[] }>({
    queryKey: ['admin', 'skills'],
    queryFn: () => apiFetch('/admin/skills?pending=1', { token }),
    enabled: !!token && me?.role === 'ADMIN',
  });
  const moderate = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      apiFetch(`/admin/skills/${id}/moderate`, { method: 'POST', token, body: { approved } }),
    onSuccess: (_data, variables) => {
      toast.success(variables.approved ? 'Skill approved' : 'Skill hidden');
      queryClient.invalidateQueries({ queryKey: ['admin', 'skills'] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not moderate skill'),
  });

  useEffect(() => {
    if (!meLoading && (!me || me.role !== 'ADMIN')) router.replace('/admin');
  }, [me, meLoading, router]);

  if (meLoading || !me || me.role !== 'ADMIN')
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  const pending = skills.data?.items ?? [];

  return (
    <div className="min-h-dvh bg-background pb-12">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => safeBack(router)}
          aria-label={dt('Back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold">{dt('Skill moderation')}</h1>
          <p className="text-[10px] text-muted-foreground">
            Review freelancer-created catalog skills before public discovery.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/templates">{dt('Templates')}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin">{dt('Admin')}</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-3 py-5 sm:px-6">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-extrabold">Pending skills · {pending.length}</h2>
              <p className="text-[11px] text-muted-foreground">
                Approved skills appear in search and onboarding suggestions.
              </p>
            </div>
          </div>
        </section>
        <div className="mt-4 space-y-3">
          {skills.isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No pending skills. The catalog is clean.
            </div>
          ) : (
            pending.map((skill) => (
              <article key={skill.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold">{skill.name}</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {skill.slug} · {skill.category ?? 'general'}
                    </p>
                    {skill.createdBy && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Added by {skill.createdBy.fullName} · @{skill.createdBy.username}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="brand"
                      onClick={() => moderate.mutate({ id: skill.id, approved: true })}
                      disabled={moderate.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moderate.mutate({ id: skill.id, approved: false })}
                      disabled={moderate.isPending}
                    >
                      <XCircle className="h-4 w-4" /> Hide
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

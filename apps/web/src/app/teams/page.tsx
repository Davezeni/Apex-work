'use client';

import { dt } from '@/i18n/auto';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/use-me';
import {
  useAgencies,
  useCreateAgency,
  useInviteAgencyMember,
  useRemoveAgencyMember,
} from '@/hooks/use-agencies';
import { safeBack } from '@/lib/safe-back';

export default function TeamsPage() {
  const router = useRouter();
  const { data: me, isLoading: meLoading, isAuthed } = useMe();
  const teams = useAgencies();
  const create = useCreateAgency();
  const invite = useInviteAgencyMember();
  const remove = useRemoveAgencyMember();
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (!meLoading && !isAuthed) router.replace('/login?next=/teams');
  }, [isAuthed, meLoading, router]);
  if (meLoading || !me)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const createTeam = () => {
    if (newName.trim().length < 2) return toast.error(dt('Give your team a name'));
    create.mutate(
      { name: newName, bio: newBio || undefined },
      {
        onSuccess: () => {
          setNewName('');
          setNewBio('');
          toast.success(dt('Team created'));
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };
  const inviteMember = (agencyId: string) => {
    // Strip a leading @ (users copy it from the member list) before sending.
    const handle = username.trim().replace(/^@+/, '');
    if (handle.length < 2) return toast.error(dt('Enter a username'));
    invite.mutate(
      { agencyId, username: handle, role: 'MEMBER' },
      {
        onSuccess: () => {
          setUsername('');
          setInviteFor(null);
          toast.success(dt('Member added'));
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

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
          <h1 className="text-lg font-extrabold">{dt('Teams & agencies')}</h1>
          <p className="text-[10px] text-muted-foreground">
            Work together, share proof and manage client projects.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/pro">
            <ShieldCheck className="h-4 w-4" /> Pro
          </Link>
        </Button>
      </header>
      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6">
        <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">{dt('Build with a team')}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Create an agency profile, invite collaborators and present a stronger service
                operation.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={dt('Team name')}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={newBio}
              onChange={(event) => setNewBio(event.target.value)}
              placeholder={dt('What does your team do?')}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <Button type="button" variant="brand" onClick={createTeam} disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}{' '}
              Create
            </Button>
          </div>
        </section>
        <div className="mt-6 space-y-4">
          {teams.isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : teams.data?.items.length ? (
            teams.data.items.map((team) => (
              <article key={team.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-extrabold">{team.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      /{team.slug} · {team.members.length} members
                    </p>
                    {team.bio && <p className="mt-2 text-sm text-muted-foreground">{team.bio}</p>}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setInviteFor(inviteFor === team.id ? null : team.id)}
                  >
                    <UserPlus className="h-4 w-4" /> Invite
                  </Button>
                </div>
                {inviteFor === team.id && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder={dt('@username — e.g. dawittamiru')}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="brand"
                      className="shrink-0"
                      onClick={() => inviteMember(team.id)}
                      disabled={invite.isPending}
                    >
                      {invite.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Add member'
                      )}
                    </Button>
                  </div>
                )}
                <div className="mt-4 divide-y divide-border rounded-xl border border-border">
                  {team.members.map((member) => (
                    <div key={member.user.id} className="flex items-center gap-3 p-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-bold">
                        {member.user.fullName
                          .split(' ')
                          .map((word) => word[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">{member.user.fullName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          @{member.user.username} · {member.role}
                        </div>
                      </div>
                      {member.role !== 'OWNER' && team.ownerId === me.id && (
                        <button
                          type="button"
                          onClick={() =>
                            remove.mutate(
                              { agencyId: team.id, memberId: member.user.id },
                              {
                                onSuccess: () => toast.success(dt('Member removed')),
                                onError: (error) => toast.error(error.message),
                              },
                            )
                          }
                          className="p-2 text-muted-foreground hover:text-destructive"
                          aria-label={dt('Remove member')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">{dt('No teams yet')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create an agency or team to collaborate on larger projects.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

'use client';

/**
 * Agency power console — rendered on /teams for every team the user owns or
 * manages: Team Score dashboard, public-profile settings, member roles,
 * portfolio manager and client job invites.
 */
import { useEffect, useState } from 'react';
import { dt } from '@/i18n/auto';
import Link from 'next/link';
import { toast } from 'sonner';
import Image from 'next/image';
import { Briefcase, Loader2, Mail, Settings2, Trash2, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpload } from '@/hooks/use-upload';
import { apiFetch } from '@/lib/api';
import {
  useAddAgencyProject,
  useAgencyDashboard,
  useAgencyInvites,
  useRemoveAgencyProject,
  useSetMemberRole,
  useUpdateTeam,
} from '@/hooks/use-agencies';

interface ConsoleProps {
  team: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    website: string | null;
    logoUrl: string | null;
    verifiedAt: string | null;
    ownerId: string;
    members: {
      userId: string;
      role: string;
      user: { id: string; fullName: string; username: string };
    }[];
  };
  myRole: 'OWNER' | 'MANAGER' | 'MEMBER';
}

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
}

export function AgencyConsole({ team, myRole }: ConsoleProps) {
  const canManage = myRole === 'OWNER' || myRole === 'MANAGER';
  const dash = useAgencyDashboard(team.id, canManage);
  const invites = useAgencyInvites(team.id, canManage);

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {canManage && dash.data && <ScoreRow dash={dash.data} />}
      {canManage && <InvitesCard invites={invites.data?.items ?? []} loading={invites.isLoading} />}
      {canManage && <SettingsCard team={team} />}
      {canManage && <PortfolioCard team={team} />}
      {myRole === 'OWNER' && <RolesCard team={team} />}
    </div>
  );
}

function ScoreRow({
  dash,
}: {
  dash: {
    openBids: number;
    activeOrders: number;
    completedOrders: number;
    avgRating: number;
    onTimePct: number;
    repeatClientPct: number;
    badge: 'NONE' | 'RISING' | 'TOP';
  };
}) {
  const cell = (v: string, l: string) => (
    <div key={l} className="rounded-xl bg-background px-2 py-2 text-center">
      <div className="text-sm font-extrabold">{v}</div>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {l}
      </div>
    </div>
  );
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> {dt('Team dashboard')}
        </span>
        {dash.badge !== 'NONE' && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
            {dash.badge === 'TOP' ? dt('Top Team') : dt('Rising Team')}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {cell(String(dash.openBids), dt('Open bids'))}
        {cell(String(dash.activeOrders), dt('Active'))}
        {cell(String(dash.completedOrders), dt('Done'))}
        {cell(dash.avgRating > 0 ? dash.avgRating.toFixed(1) : '—', dt('Rating'))}
        {cell(dash.completedOrders > 0 ? `${dash.onTimePct}%` : '—', dt('On time'))}
        {cell(dash.completedOrders > 0 ? `${dash.repeatClientPct}%` : '—', dt('Repeat'))}
      </div>
    </div>
  );
}

function InvitesCard({
  invites,
  loading,
}: {
  invites: {
    id: string;
    job: { id: string; title: string; isOpen: boolean };
    invitedBy: { fullName: string };
    message: string | null;
  }[];
  loading: boolean;
}) {
  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (invites.length === 0) return null;
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
        <Mail className="h-3 w-3" /> {dt('Invited to bid')}
      </div>
      <div className="mt-2 space-y-1.5">
        {invites.slice(0, 5).map((invite) => (
          <div key={invite.id} className="flex items-center gap-2 rounded-xl bg-background p-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold">{invite.job.title}</div>
              <div className="text-[10px] text-muted-foreground">
                {invite.invitedBy.fullName}
                {!invite.job.isOpen && ` · ${dt('job closed')}`}
              </div>
            </div>
            {invite.job.isOpen && (
              <Button asChild size="sm" variant="brand" className="shrink-0">
                <Link href={`/jobs/${invite.job.id}`}>{dt('Bid now')}</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsCard({ team }: { team: ConsoleProps['team'] }) {
  const update = useUpdateTeam();
  const upload = useUpload();
  const [open, setOpen] = useState(false);
  const [bio, setBio] = useState(team.bio ?? '');
  const [website, setWebsite] = useState(team.website ?? '');
  const [logo, setLogo] = useState(team.logoUrl ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await update.mutateAsync({
        agencyId: team.id,
        bio: bio.trim() || null,
        website: website.trim() || null,
        logoUrl: logo.trim() || null,
      });
      toast.success(dt('Team profile updated'));
      setOpen(false);
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
      >
        <Settings2 className="h-3 w-3" /> {dt('Public profile settings')}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            {logo ? (
              <Image
                src={logo}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
                {team.name[0]?.toUpperCase()}
              </div>
            )}
            <label className="cursor-pointer rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-bold">
              {upload.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : dt('Upload logo')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const res = await upload.mutateAsync({ file, bucket: 'avatars' });
                    setLogo(res.publicUrl);
                    toast.success(dt('Logo ready — press save'));
                  } catch {
                    toast.error(dt('Upload failed'));
                  }
                }}
              />
            </label>
            {logo && (
              <button
                type="button"
                className="text-[11px] font-semibold text-muted-foreground"
                onClick={() => setLogo('')}
              >
                {dt('Remove')}
              </button>
            )}
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={1600}
            placeholder={dt('What does your team do?')}
            className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <Button type="button" size="sm" variant="brand" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {dt('Save')}
          </Button>
        </div>
      )}
    </div>
  );
}

function PortfolioCard({ team }: { team: ConsoleProps['team'] }) {
  const add = useAddAgencyProject();
  const remove = useRemoveAgencyProject();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [url, setUrl] = useState('');
  const upload = useUpload();
  const [image, setImage] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ portfolio: ProjectRow[] }>(`/agencies/${team.slug}`)
      .then((d) => active && setProjects(d.portfolio))
      .catch(() => active && setProjects([]));
    return () => {
      active = false;
    };
  }, [team.slug, add, remove]);

  const submit = async () => {
    if (title.trim().length < 2) {
      toast.error(dt('Title required'));
      return;
    }
    try {
      const created = await add.mutateAsync({
        agencyId: team.id,
        title: title.trim(),
        description: desc.trim() || undefined,
        url: url.trim() || undefined,
        imageUrl: image.trim() || undefined,
      });
      setProjects((cur) => [
        {
          id: created.id,
          title: created.title,
          description: desc.trim() || null,
          url: url.trim() || null,
          imageUrl: image.trim() || null,
        },
        ...(cur ?? []),
      ]);
      setTitle('');
      setDesc('');
      setUrl('');
      setImage('');
      toast.success(dt('Added to your team portfolio'));
    } catch (err) {
      toast.error((err as { message?: string }).message ?? 'Failed');
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Briefcase className="h-3 w-3" /> {dt('Team portfolio')} ({projects?.length ?? '…'})
      </div>
      {projects && projects.length > 0 && (
        <div className="mt-2 space-y-1">
          {projects.slice(0, 6).map((project) => (
            <div key={project.id} className="flex items-center gap-2 rounded-xl bg-background p-2">
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{project.title}</span>
              <button
                type="button"
                aria-label={dt('Remove')}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-red-500 active:bg-red-500/10"
                onClick={() =>
                  remove.mutate(
                    { agencyId: team.id, projectId: project.id },
                    {
                      onSuccess: () =>
                        setProjects((cur) => (cur ?? []).filter((p) => p.id !== project.id)),
                      onError: (error) => toast.error(error.message),
                    },
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={dt('Project title')}
          maxLength={120}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… (link)"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-bold">
            {upload.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : dt('Add image')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const res = await upload.mutateAsync({ file, bucket: 'portfolio' });
                  setImage(res.publicUrl);
                } catch {
                  toast.error(dt('Upload failed'));
                }
              }}
            />
          </label>
          {image && (
            <span className="text-[10px] font-semibold text-primary">{dt('Image ready ✓')}</span>
          )}
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          maxLength={1200}
          placeholder={dt('What was delivered?')}
          className="w-full rounded-xl border border-border bg-background p-2 text-sm outline-none focus:border-primary"
        />
        <Button type="button" size="sm" variant="outline" onClick={submit} disabled={add.isPending}>
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {dt('Add')}
        </Button>
      </div>
    </div>
  );
}

function RolesCard({ team }: { team: ConsoleProps['team'] }) {
  const setRole = useSetMemberRole();
  const others = team.members.filter((m) => m.userId !== team.ownerId);
  if (others.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Users className="h-3 w-3" /> {dt('Member roles')}
      </div>
      <div className="mt-2 space-y-1">
        {others.map((m) => (
          <div key={m.userId} className="flex items-center gap-2 rounded-xl bg-background p-2">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{m.user.fullName}</span>
            <select
              value={m.role === 'MANAGER' ? 'MANAGER' : 'MEMBER'}
              onChange={(e) =>
                setRole.mutate(
                  {
                    agencyId: team.id,
                    userId: m.userId,
                    role: e.target.value as 'MEMBER' | 'MANAGER',
                  },
                  {
                    onSuccess: () => toast.success(dt('Role updated')),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
              className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold outline-none focus:border-primary"
            >
              <option value="MEMBER">MEMBER</option>
              <option value="MANAGER">MANAGER</option>
            </select>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {dt('Managers can invite, remove and manage the portfolio.')}
      </p>
    </div>
  );
}

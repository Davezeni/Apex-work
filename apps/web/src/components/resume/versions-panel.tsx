'use client';

import { useState } from 'react';
import { History, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useCreateResumeVersion,
  useDeleteResumeVersion,
  useRestoreResumeVersion,
  useResumeVersions,
} from '@/hooks/use-resume-versions';

export function ResumeVersionsPanel({ targetRole }: { targetRole: string }) {
  const versions = useResumeVersions();
  const create = useCreateResumeVersion();
  const restore = useRestoreResumeVersion();
  const remove = useDeleteResumeVersion();
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState(false);

  const saveVersion = () => {
    const label =
      name.trim() || `${targetRole.trim() || 'General CV'} · ${new Date().toLocaleDateString()}`;
    create.mutate(
      { name: label },
      {
        onSuccess: () => {
          setName('');
          setExpanded(true);
          toast.success('Resume version saved');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const items = versions.data?.items ?? [];
  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-primary">
          <History className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">Resume versions</h2>
          <p className="text-[11px] text-muted-foreground">
            Save a safe snapshot before tailoring this CV for a new opportunity.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-xs font-bold text-primary"
        >
          {expanded ? 'Hide' : `${items.length} saved`}
        </button>
      </div>
      {expanded && (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`${targetRole || 'General CV'} · e.g. September application`}
              className="input flex-1"
              maxLength={80}
            />
            <Button
              type="button"
              variant="outline"
              onClick={saveVersion}
              disabled={create.isPending}
            >
              <Save className="h-4 w-4" /> Save snapshot
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {versions.isLoading ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No snapshots yet. Save one before making big changes.
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.targetRole || 'General CV'} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Restore ${item.name}? Current unsaved changes will be replaced.`,
                        )
                      )
                        return;
                      restore.mutate(item.id, {
                        onSuccess: () => toast.success('Resume version restored'),
                        onError: (error) => toast.error(error.message),
                      });
                    }}
                    disabled={restore.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete ${item.name}?`))
                        remove.mutate(item.id, { onError: (error) => toast.error(error.message) });
                    }}
                    disabled={remove.isPending}
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--background));
          padding: 10px 12px;
          font-size: 13px;
          outline: none;
        }
        .input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.15);
        }
      `}</style>
    </section>
  );
}

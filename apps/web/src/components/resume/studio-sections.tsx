'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import {
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAIResumeSkills } from '@/hooks/use-ai';
import type { ResumeContent, ResumeProjectInput } from '@apex-work/shared';
type Props = {
  content: ResumeContent;
  onChange: (content: ResumeContent) => void;
  targetRole: string;
  summary: string;
};

export function ResumeStudioSections({ content, onChange, targetRole, summary }: Props) {
  return (
    <>
      <SkillsSection
        content={content}
        onChange={onChange}
        targetRole={targetRole}
        summary={summary}
      />
      <ProjectsSection content={content} onChange={onChange} />
      <AchievementsSection content={content} onChange={onChange} />
      <AdditionalSections content={content} onChange={onChange} />
    </>
  );
}

function SkillsSection({ content, onChange, targetRole, summary }: Props) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState(3);
  const suggest = useAIResumeSkills();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const add = (skillName = name) => {
    const normalized = skillName.trim();
    if (!normalized) return;
    if (content.skills.some((skill) => skill.name.toLowerCase() === normalized.toLowerCase())) {
      setName('');
      return;
    }
    if (content.skills.length >= 40) return toast.error(dt('You can add up to 40 skills'));
    onChange({ ...content, skills: [...content.skills, { name: normalized, level }] });
    setName('');
    setSuggestions((items) =>
      items.filter((item) => item.toLowerCase() !== normalized.toLowerCase()),
    );
  };

  const runSuggest = () => {
    if (targetRole.trim().length < 2) return toast.error(dt('Add a target role first'));
    suggest.mutate(
      {
        targetRole,
        existingSkills: content.skills.map((skill) => skill.name),
        summary: summary || undefined,
      },
      {
        onSuccess: (result) => {
          setSuggestions(result.skills);
          toast.success(
            result.source === 'ai' ? 'Skill ideas ready ✨' : 'Starter skill ideas ready',
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <StudioSection
      icon={<Sparkles className="h-4 w-4" />}
      title={dt('Skills & strengths')}
      subtitle={dt('Show recruiters what you can actually deliver')}
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={dt('e.g. React, Figma, Copywriting')}
          className="input flex-1"
        />
        <select
          value={level}
          onChange={(event) => setLevel(Number(event.target.value))}
          className="input w-24"
        >
          <option value={5}>{dt('Expert')}</option>
          <option value={4}>{dt('Advanced')}</option>
          <option value={3}>{dt('Strong')}</option>
          <option value={2}>{dt('Working')}</option>
          <option value={1}>{dt('Learning')}</option>
        </select>
        <Button type="button" variant="outline" onClick={() => add()} aria-label={dt('Add skill')}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {content.skills.map((skill) => (
          <span
            key={skill.name}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 text-xs"
          >
            <span className="font-semibold">{skill.name}</span>
            <span className="flex gap-0.5" aria-label={`${skill.level} out of 5`}>
              {[1, 2, 3, 4, 5].map((dot) => (
                <i
                  key={dot}
                  className={`h-1.5 w-1.5 rounded-full ${dot <= skill.level ? 'bg-primary' : 'bg-muted'}`}
                />
              ))}
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...content,
                  skills: content.skills.filter((item) => item.name !== skill.name),
                })
              }
              aria-label={`Remove ${skill.name}`}
              className="text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
        {content.skills.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No skills yet. Add your strongest skills or ask Apex Coach for ideas.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={runSuggest}
          disabled={suggest.isPending}
        >
          {suggest.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <WandSparkles className="h-3.5 w-3.5" />
          )}
          Suggest skills with AI
        </Button>
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => add(item)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
          >
            <Plus className="h-3 w-3" /> {item}
          </button>
        ))}
      </div>
    </StudioSection>
  );
}

function ProjectsSection({
  content,
  onChange,
}: {
  content: ResumeContent;
  onChange: (content: ResumeContent) => void;
}) {
  const empty: ResumeProjectInput = {
    title: '',
    role: null,
    description: null,
    url: null,
    technologies: [],
    highlights: [],
    startYear: null,
    endYear: null,
  };
  const [draft, setDraft] = useState<ResumeProjectInput>(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [technology, setTechnology] = useState('');
  const [highlight, setHighlight] = useState('');

  const startNew = () => {
    setDraft(empty);
    setTechnology('');
    setHighlight('');
    setEditing(null);
    setOpen(true);
  };

  const edit = (index: number) => {
    const project = content.projects[index];
    if (!project) return;
    setDraft({
      ...project,
      technologies: project.technologies ?? [],
      highlights: project.highlights ?? [],
    });
    setTechnology('');
    setHighlight('');
    setEditing(index);
    setOpen(true);
  };

  const save = () => {
    if (draft.title.trim().length < 2) return toast.error(dt('Project title is required'));
    const next = [...content.projects];
    const value = {
      ...draft,
      title: draft.title.trim(),
      role: draft.role?.trim() || null,
      description: draft.description?.trim() || null,
    };
    if (editing === null) next.push(value);
    else next[editing] = value;
    onChange({ ...content, projects: next });
    setOpen(false);
  };

  const addTechnology = () => {
    if (!technology.trim() || draft.technologies.includes(technology.trim())) return;
    setDraft({ ...draft, technologies: [...draft.technologies, technology.trim()].slice(0, 15) });
    setTechnology('');
  };

  const addHighlight = () => {
    if (!highlight.trim()) return;
    setDraft({ ...draft, highlights: [...draft.highlights, highlight.trim()].slice(0, 8) });
    setHighlight('');
  };

  return (
    <StudioSection
      icon={<ExternalLink className="h-4 w-4" />}
      title={dt('Projects & case studies')}
      subtitle={dt('Evidence beats a list of responsibilities')}
      action={
        <Button type="button" size="sm" variant="outline" onClick={startNew}>
          <Plus className="h-3 w-3" /> Add project
        </Button>
      }
    >
      <div className="space-y-2">
        {content.projects.map((project, index) => (
          <div
            key={project.id ?? `${project.title}-${index}`}
            className="rounded-xl border border-border bg-background p-3"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold">{project.title}</h3>
                {project.role && <p className="text-xs text-muted-foreground">{project.role}</p>}
                {project.description && (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                    {project.description}
                  </p>
                )}
                {project.technologies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {project.technologies.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => edit(index)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-primary"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...content,
                      projects: content.projects.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                  aria-label={dt('Delete project')}
                  className="rounded-lg p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {content.projects.length === 0 && !open && (
          <p className="text-xs text-muted-foreground">
            Add client work, products, volunteer work or a personal project.
          </p>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2 rounded-xl border-2 border-primary/20 bg-primary/5 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder={dt('Project name *')}
              className="input"
            />
            <input
              value={draft.role ?? ''}
              onChange={(event) => setDraft({ ...draft, role: event.target.value })}
              placeholder={dt('Your role')}
              className="input"
            />
          </div>
          <textarea
            value={draft.description ?? ''}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder={dt('What did you build or solve?')}
            rows={3}
            className="input"
          />
          <div className="flex gap-2">
            <input
              value={draft.url ?? ''}
              onChange={(event) => setDraft({ ...draft, url: event.target.value || null })}
              placeholder={dt('Project URL (optional)')}
              className="input flex-1"
            />
            <input
              value={technology}
              onChange={(event) => setTechnology(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTechnology();
                }
              }}
              placeholder={dt('Tool / tech')}
              className="input w-32"
            />
            <Button type="button" variant="outline" onClick={addTechnology}>
              Add
            </Button>
          </div>
          {draft.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {draft.technologies.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      technologies: draft.technologies.filter((value) => value !== item),
                    })
                  }
                  className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold"
                >
                  {item} ×
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={highlight}
              onChange={(event) => setHighlight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addHighlight();
                }
              }}
              placeholder={dt('Achievement / result')}
              className="input flex-1"
            />
            <Button type="button" variant="outline" onClick={addHighlight}>
              Add highlight
            </Button>
          </div>
          {draft.highlights.length > 0 && (
            <ul className="ml-4 list-disc text-xs text-muted-foreground">
              {draft.highlights.map((item) => (
                <li key={item}>
                  {item}{' '}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        highlights: draft.highlights.filter((value) => value !== item),
                      })
                    }
                    className="text-destructive"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="brand" className="flex-1" onClick={save}>
              <Check className="h-4 w-4" /> Save project
            </Button>
          </div>
        </div>
      )}
    </StudioSection>
  );
}

function AchievementsSection({
  content,
  onChange,
}: {
  content: ResumeContent;
  onChange: (content: ResumeContent) => void;
}) {
  const [value, setValue] = useState('');
  const add = () => {
    if (value.trim().length < 2) return;
    if (content.achievements.length >= 20)
      return toast.error(dt('You can add up to 20 achievements'));
    onChange({ ...content, achievements: [...content.achievements, value.trim()] });
    setValue('');
  };
  return (
    <StudioSection
      icon={<Award className="h-4 w-4" />}
      title={dt('Achievements')}
      subtitle={dt('Awards, measurable wins and proof of impact')}
    >
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={dt('e.g. Won 1st place in a national design challenge')}
          className="input flex-1"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {content.achievements.length > 0 && (
        <ul className="mt-3 space-y-2">
          {content.achievements.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-start gap-2 rounded-lg bg-background px-3 py-2 text-xs"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...content,
                    achievements: content.achievements.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
                className="text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </StudioSection>
  );
}

function AdditionalSections({
  content,
  onChange,
}: {
  content: ResumeContent;
  onChange: (content: ResumeContent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [publication, setPublication] = useState('');
  const [volunteer, setVolunteer] = useState({ organization: '', role: '', description: '' });
  const addPublication = () => {
    if (!publication.trim()) return;
    onChange({ ...content, publications: [...content.publications, publication.trim()] });
    setPublication('');
  };
  const addVolunteer = () => {
    if (!volunteer.organization.trim()) return toast.error(dt('Organization is required'));
    onChange({
      ...content,
      volunteer: [
        ...content.volunteer,
        {
          organization: volunteer.organization.trim(),
          role: volunteer.role.trim() || null,
          description: volunteer.description.trim() || null,
        },
      ],
    });
    setVolunteer({ organization: '', role: '', description: '' });
  };
  return (
    <StudioSection
      icon={<ChevronDown className="h-4 w-4" />}
      title={dt('Additional sections')}
      subtitle={dt('Publications, volunteer work and references')}
      action={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-xs font-bold text-primary"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : 'Expand'}
        </button>
      }
    >
      {open && (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-bold">{dt('Publications / speaking')}</h3>
            <div className="flex gap-2">
              <input
                value={publication}
                onChange={(event) => setPublication(event.target.value)}
                placeholder={dt('Title, publication or talk')}
                className="input flex-1"
              />
              <Button type="button" variant="outline" onClick={addPublication}>
                Add
              </Button>
            </div>
            {content.publications.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {content.publications.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...content,
                          publications: content.publications.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold">{dt('Volunteer work')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={volunteer.organization}
                onChange={(event) =>
                  setVolunteer({ ...volunteer, organization: event.target.value })
                }
                placeholder={dt('Organization')}
                className="input"
              />
              <input
                value={volunteer.role}
                onChange={(event) => setVolunteer({ ...volunteer, role: event.target.value })}
                placeholder={dt('Role')}
                className="input"
              />
            </div>
            <textarea
              value={volunteer.description}
              onChange={(event) => setVolunteer({ ...volunteer, description: event.target.value })}
              placeholder={dt('What did you contribute?')}
              rows={2}
              className="input mt-2"
            />
            <Button type="button" variant="outline" className="mt-2" onClick={addVolunteer}>
              Add volunteer work
            </Button>
            {content.volunteer.length > 0 && (
              <div className="mt-2 space-y-1 text-xs">
                {content.volunteer.map((item, index) => (
                  <div key={`${item.organization}-${index}`} className="flex gap-2">
                    <span className="flex-1">
                      <b>{item.organization}</b>
                      {item.role ? ` · ${item.role}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...content,
                          volunteer: content.volunteer.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </StudioSection>
  );
}

function StudioSection({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-3 mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
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
        textarea.input {
          resize: vertical;
        }
      `}</style>
    </section>
  );
}

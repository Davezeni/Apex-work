-- Content refresh v2 (user review): new tagline + the blue card gradients
-- are kept after all. Conditional on exact prior values so admin edits and
-- already-updated rows are never touched.

UPDATE "AppSetting"
SET value = jsonb_set(jsonb_set(
      value,
      '{heroTitle}',       to_jsonb('Skip the Overhead.'::text), false),
      '{heroTitleAccent}', to_jsonb('Hire the Expert.'::text), false)
WHERE key = 'content.home'
  AND value->>'heroTitle' = 'The apex of'
  AND value->>'heroTitleAccent' = 'Ethiopia''s freelance talent.';

UPDATE "AppSetting"
SET value = jsonb_set(value, '{featured,0,gradient}',
      to_jsonb('from-violet-600 to-indigo-600'::text), false)
WHERE key = 'content.home'
  AND value->'featured'->0->>'gradient' = 'from-primary to-primary/50';

UPDATE "AppSetting"
SET value = jsonb_set(value, '{featured,1,gradient}',
      to_jsonb('from-indigo-600 to-slate-600'::text), false)
WHERE key = 'content.home'
  AND value->'featured'->1->>'gradient' = 'from-amber-500 to-orange-500';

UPDATE "AppSetting"
SET value = jsonb_set(value, '{featured,2,gradient}',
      to_jsonb('from-purple-600 to-violet-600'::text), false)
WHERE key = 'content.home'
  AND value->'featured'->2->>'gradient' = 'from-teal-600 to-emerald-600';

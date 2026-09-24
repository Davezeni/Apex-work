-- One-time content refresh: new hero tagline + brand-consistent featured
-- gradients. Every change is conditional on the exact old default value, so
-- admin-customized copy is never touched.

UPDATE "AppSetting"
SET value = jsonb_set(jsonb_set(
      value,
      '{heroTitle}',        to_jsonb('The apex of'::text), false),
      '{heroTitleAccent}',  to_jsonb('Ethiopia''s freelance talent.'::text), false)
WHERE key = 'content.home'
  AND value->>'heroTitle' = 'Ethiopia''s most powerful'
  AND value->>'heroTitleAccent' = 'freelance marketplace.';

-- Featured card gradients: violet/indigo/slate/purple -> brand teal & amber.
UPDATE "AppSetting"
SET value = jsonb_set(
      value,
      '{featured,0,gradient}',
      to_jsonb('from-primary to-primary/50'::text), false)
WHERE key = 'content.home'
  AND value->'featured'->0->>'gradient' = 'from-violet-600 to-indigo-600';

UPDATE "AppSetting"
SET value = jsonb_set(
      value,
      '{featured,1,gradient}',
      to_jsonb('from-amber-500 to-orange-500'::text), false)
WHERE key = 'content.home'
  AND value->'featured'->1->>'gradient' = 'from-indigo-600 to-slate-600';

UPDATE "AppSetting"
SET value = jsonb_set(
      value,
      '{featured,2,gradient}',
      to_jsonb('from-teal-600 to-emerald-600'::text), false)
WHERE key = 'content.home'
  AND value->'featured'->2->>'gradient' = 'from-purple-600 to-violet-600';

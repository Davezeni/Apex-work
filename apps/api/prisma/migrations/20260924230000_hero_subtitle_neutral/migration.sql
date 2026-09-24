-- The hero subtitle block was removed from the landing entirely (user
-- decision). The row value must stay schema-valid (min(1)), so it becomes a
-- neutral one-liner that nothing renders. Conditional on the old default.
UPDATE "AppSetting"
SET value = jsonb_set(value, '{heroSubtitle}',
      to_jsonb('Vetted Ethiopian talent, escrow-protected.'::text), false)
WHERE key = 'content.home'
  AND value->>'heroSubtitle' = 'Hire vetted digital talent or land your next gig — powered by AI, paid in Telebirr, built for አማርኛ speakers.';

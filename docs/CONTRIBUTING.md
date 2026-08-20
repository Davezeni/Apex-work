# Contributing

## Branch strategy

- `main` — production. Always deployable.
- `develop` — integration branch (optional; you can PR directly to main for small teams).
- Feature branches: `feat/<short-name>` (e.g. `feat/chat-voice-notes`).
- Fixes: `fix/<short-name>`.
- Chores: `chore/<short-name>`.

## Commits

Follow **Conventional Commits**:

```
feat(auth): add OTP-based signup flow
fix(api): correct rate limit reset window
docs(architecture): explain refresh-token rotation
chore(deps): bump next to 14.2.14
refactor(gigs): extract package validation
test(auth): cover OTP replay attack
```

## PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] Added/updated tests where meaningful
- [ ] Updated `docs/` if the change is user-visible or architectural
- [ ] No secrets in the diff (check `.env` isn't staged)

## Coding standards

- **TypeScript strict mode** — no `any` without a written reason.
- **Zod for all inputs** — API + forms. One schema, both sides.
- **Errors are typed** — throw `AppError` subclasses; the global handler serializes them.
- **Services own business logic** — routes stay thin.
- **Prisma over raw SQL** — unless you need something Prisma can't do.
- **Pure functions** where possible; async I/O at the edges.
- **Naming**: `camelCase` for values, `PascalCase` for types & React components,
  `SCREAMING_SNAKE_CASE` for constants.

## UI standards

- Prefer **shadcn/ui** primitives; only build custom when a primitive doesn't fit.
- **Mobile-first** — design at 375px width, then add desktop.
- All interactive elements must have accessible names.
- Animations should be **fast (< 400 ms)** and use `cubic-bezier(.16,1,.3,1)` for
  natural motion; use spring for scale-based effects.
- Respect `prefers-reduced-motion`.

## Database

- Never modify `schema.prisma` without creating a migration.
- Migrations are named descriptively: `20260820_add_dispute_center`.
- Backfills go in `apps/api/prisma/scripts/*.ts` (not in migrations).

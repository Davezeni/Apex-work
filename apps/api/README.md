# @apex-work/api

Express + TypeScript + Prisma REST API for Apex-Work.

## Structure

```
src/
├── config/         # env, logger
├── lib/            # prisma, redis, jwt, hash, errors, response, asyncHandler
├── middleware/     # auth, validate, rateLimit, errorHandler
├── services/       # business logic (auth, sms, ...)
├── routes/         # HTTP routes (thin — delegate to services)
├── realtime/       # socket.io setup
├── app.ts          # Express factory
└── server.ts       # entrypoint (HTTP + shutdown handlers)
```

## Layer rules

- `routes/` — parse input via `validate(schema)`, call a service, return via `success()`. NO business logic.
- `services/` — pure functions on top of Prisma + Redis. Throw typed `AppError` subclasses.
- `middleware/` — cross-cutting only. Never contains business rules.
- `lib/` — reusable primitives. No dependencies on `services/`.

## Endpoints (MVP)

```
GET  /v1/health
POST /v1/auth/otp/request     { phone, purpose }
POST /v1/auth/otp/verify      { phone, code } -> { verifiedToken }
POST /v1/auth/signup          { phone, otpToken, fullName, role, ... }
POST /v1/auth/login/otp       { otpToken }
POST /v1/auth/login           { email, password }
POST /v1/auth/refresh         { refreshToken }
POST /v1/auth/logout          { refreshToken }

GET  /v1/me                   (auth)
PATCH /v1/me                  (auth)

GET  /v1/gigs?category=&q=&sort=&cursor=&limit=
GET  /v1/gigs/:slug
```

## Dev

```bash
npm install
npx prisma generate
npx prisma migrate dev  # requires DATABASE_URL
npm run dev
```

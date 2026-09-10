# Apex-Work → Google Play (free, no wrapper rewrite)

The web app is already a full **PWA** (manifest + service worker + offline shell).
Google Play accepts PWAs packaged as a **Trusted Web Activity (TWA)** — a thin
Android shell that opens your real website with zero browser UI. No Play Store
fee beyond the one-time **$25 developer registration**; the tooling below is
100% free and open source.

> Result: a real `app-release.aab` you upload to Play, with your brand, push
> notifications enabled, and the site content served live from
> `apex-work-gold.vercel.app`.

---

## One-time prerequisites

1. **A Google Play Developer account** — https://play.google.com/console
   (one-time $25, needs ID verification).
2. **Node 18+ and Java 17** on your build machine (`sudo apt install openjdk-17-jdk`).
3. Your site must be reachable and own `apex-work-gold.vercel.app` (it is).

## Step 1 — install Bubblewrap (official Google CLI)

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest=https://apex-work-gold.vercel.app/manifest.webmanifest
```

- When asked for a **signing key**, choose _create a new key_.
  - **KEEP THE KEY + PASSWORDS SAFE** — losing it means you can never update
    the app under the same listing. Back it up (this repo intentionally does
    NOT contain any keystore).
- Bubblewrap downloads the Android SDK bits automatically (no Android Studio needed).

The repo already ships a ready template at `twa/twa-manifest.json` — you can
copy it over the generated `twa-manifest.json` to pre-fill colors, name,
shortcuts and notifications.

## Step 2 — build the bundle

```bash
bubblewrap build
```

Outputs:

- `app-release-bundle.aab` — upload this to Play Console.
- `app-release-signed.apk` — for direct testing on a phone.

## Step 3 — link the app to the website (Digital Asset Links)

After building, Bubblewrap prints your signing key's **SHA-256 fingerprint**.
Put it into:

```
apps/web/public/.well-known/assetlinks.json
```

(replace the all-zero placeholder), then push. Verify:

```
https://apex-work-gold.vercel.app/.well-known/assetlinks.json
```

This is what lets the Android app open your URLs with **no URL bar** and
enables WebAPK install. Play verifies it automatically during review.

## Step 4 — Play Console listing checklist

| Item               | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| App name           | Apex-Work                                                                         |
| Short description  | Ethiopia's freelance marketplace — hire & get paid                                |
| Category           | Business                                                                          |
| Privacy policy URL | required — host one on the site (e.g. `/legal/privacy`)                           |
| Content rating     | complete the IARC questionnaire                                                   |
| Data safety        | declare: phone number (account), user content, no data sharing with third parties |
| Target audience    | 18+ recommended (money flows)                                                     |
| Screenshots        | phone screenshots of Home, Browse, Chat, Wallet (min 2)                           |
| Feature graphic    | 1024×500                                                                          |
| Countries          | Ethiopia first, expand later                                                      |

## Step 5 — releases

- Internal testing track first (up to 100 testers), then Production.
- Bump `appVersionCode` in `twa-manifest.json` for every new upload.
- `bubblewrap update --appVersionName=1.0.1` regenerates with the same key.

## Notifications

`enableNotifications: true` in the template means push notifications work
inside the TWA using the site's existing web-push subscription flow — no extra
Firebase setup required.

## Troubleshooting

- **"Draft app not verifiable"** → assetlinks.json not deployed or wrong
  fingerprint; re-check with `bubblewrap fingerprint list`.
- **Play rejects "webview app"** → TWAs are explicitly allowed when the
  assetlinks verification passes; make sure the fingerprint matches the
  **upload key Play shows** (App signing → request the Play-managed
  fingerprint and add it to assetlinks.json as a second entry).
- **White splash** → background_color in the manifest is used; it is already
  set to `#0a0a0f`.

---

## What's already done in the repo

- ✅ `manifest.webmanifest` — id, scope, display_override, 4 shortcuts,
  maskable icons (Play-ready).
- ✅ `public/.well-known/assetlinks.json` — placeholder with correct package
  name `com.apexwork.app`.
- ✅ `twa/twa-manifest.json` — pre-filled Bubblewrap config.
- ✅ Push notifications already work in the PWA (web-push + service worker v9).

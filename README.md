# MailNext

A native desktop email client for Windows 11, built with Tauri v2, Rust and React 19. MailNext follows Apple Human Interface Guidelines aesthetics — glassmorphism, a frameless window with custom traffic-light controls, and a three-column Apple Mail-style layout — while talking directly to your mail provider over IMAP/SMTP with OAuth2 sign-in.

## Features

- **Frameless, translucent window** with custom Apple-style traffic light controls (close/minimize/maximize) and light/dark glassmorphism, following the system theme by default.
- **Onboarding** with a 2×2 glass-card grid for Gmail, Outlook, iCloud and Yahoo Mail, plus a custom/enterprise IMAP-SMTP option.
- **OAuth2 sign-in** (authorization code + PKCE, loopback redirect) for Gmail, Outlook and Yahoo. iCloud and custom servers authenticate with a password or app-specific password, since Apple does not expose a public OAuth2 grant for third-party IMAP access.
- **Three-column mail UI**: folder sidebar with folder creation/deletion, a searchable message list, and a full HTML/plain-text reader with an inline reply bar.
- **Compose** with To/Cc, attachments, and signature insertion.
- **Settings**: signature editor, color-coded label manager, and notification/sound preferences.
- **Native Windows 11 toast notifications** plus synthesized audio chimes (Web Audio API — no bundled sound assets) for new mail, driven by a background IMAP poller.
- **Local-first cache**: accounts, folders, messages, labels and signatures are cached in SQLite via `@tauri-apps/plugin-sql`.
- **In-place auto-updates**: MailNext checks for new versions in the background, downloads the update inside the running app (no browser, no installer wizard), installs it silently, and only needs a one-click restart to finish — with a live progress bar showing bytes downloaded and download speed.
- **AI email summaries**: a one-click "Summarize" action on any open message, powered by Claude (Anthropic). Uses your own Anthropic API key (Settings → AI Summary) — a message's subject and body are only sent to Anthropic when you click Summarize.

## Tech stack

| Layer          | Technology                                                          |
| -------------- | --------------------------------------------------------------------- |
| Shell          | Tauri v2 (Rust + native WebView2 on Windows)                          |
| UI             | React 19, TypeScript, Vite, Tailwind CSS v4                            |
| State          | Zustand                                                                 |
| Storage        | SQLite via `@tauri-apps/plugin-sql`                                     |
| Mail protocols | `async-imap`, `lettre` (SMTP), `oauth2` (OAuth2 + PKCE)                 |
| Notifications  | `@tauri-apps/plugin-notification` (native toasts) + Web Audio chimes   |
| Updates        | `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` (silent NSIS install + relaunch) |
| AI summaries   | Claude Haiku 4.5 via the Anthropic Messages API (`reqwest` from Rust)  |
| Icons          | [Lucide React](https://lucide.dev) only — no emoji anywhere in the UI  |

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Rust (stable) and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform
- On Windows, the WebView2 runtime (bundled by the installer if missing)

### Install dependencies

```bash
npm install
```

### OAuth2 client registration

Gmail, Outlook and Yahoo require MailNext to be registered as an OAuth2 "installed app" with that provider. Register your own client and set these environment variables before running the app (a `.env` file at the repo root works with most shells/IDE run configs, or export them in CI):

| Provider | Variables                                                          | Register at                                 |
| -------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Gmail    | `MAILNEXT_GOOGLE_CLIENT_ID`, `MAILNEXT_GOOGLE_CLIENT_SECRET`             | console.cloud.google.com/apis/credentials       |
| Outlook  | `MAILNEXT_MICROSOFT_CLIENT_ID`, `MAILNEXT_MICROSOFT_CLIENT_SECRET`       | portal.azure.com (Azure App registrations)      |
| Yahoo    | `MAILNEXT_YAHOO_CLIENT_ID`, `MAILNEXT_YAHOO_CLIENT_SECRET`               | developer.yahoo.com/apps                        |

Configure each app's redirect URI as a loopback address (`http://127.0.0.1/callback` with a wildcard/any port, or add each port your provider requires) — MailNext binds an ephemeral local port and opens your system browser to complete sign-in.

iCloud Mail and custom/enterprise servers don't need any of the above: sign in with your regular password or an [app-specific password](https://appleid.apple.com) directly in the onboarding flow.

### AI email summaries (optional)

Unlike the OAuth2 clients above, the AI summary feature needs no build-time configuration — each user pastes their own [Anthropic API key](https://console.anthropic.com) into **Settings → AI Summary** at runtime. The key is stored locally in SQLite and sent only to `api.anthropic.com`, only when that user clicks **Summarize**. Leaving the key unset simply leaves the feature unused; no other part of the app depends on it.

### Run in development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Produces NSIS and MSI installers under `src-tauri/target/release/bundle/`.

## Auto-updates

MailNext ships with an in-app updater (`@tauri-apps/plugin-updater`) instead of asking users to redownload and reinstall the app by hand:

1. On launch (and every 4 hours after), the app polls the update manifest configured in `src-tauri/tauri.conf.json` under `plugins.updater.endpoints`.
2. When a newer version is found, a glass banner offers **Update now**. Downloading happens in place — no browser tab, no installer window — while a progress bar reports bytes downloaded, percentage, and a rolling download-speed estimate (`src/lib/updater.ts`, `src/components/update/UpdateBanner.tsx`).
3. On Windows the NSIS update package installs **silently** (`plugins.updater.windows.installMode: "quiet"` in `tauri.conf.json`) — nothing for the user to click through.
4. Once installed, the banner switches to **Restart now**, which relaunches the app (via `@tauri-apps/plugin-process`) straight into the new version.

The same status is also available anytime under **Settings → Updates**.

### Publishing a release

The updater endpoint (`https://github.com/<owner>/<repo>/releases/latest/download/latest.json`) is populated by [`.github/workflows/release.yml`](.github/workflows/release.yml), which runs [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action) whenever a `v*` tag is pushed. That action builds the NSIS/MSI installers, produces the signed updater artifacts (`.nsis.zip` + `.sig`), and uploads `latest.json` to the GitHub Release.

Update artifacts must be signed so the app can verify they haven't been tampered with in transit. A signing keypair for this repo has already been generated and its **public** half is embedded in `tauri.conf.json` (`plugins.updater.pubkey`) — that part is safe to commit. To cut a real release you additionally need the **private** key, which is never committed:

```bash
# Generate once, store the output somewhere safe (a password manager, not the repo):
npx tauri signer generate

# Set as repository secrets under Settings → Secrets and variables → Actions:
# TAURI_SIGNING_PRIVATE_KEY           (the private key contents)
# TAURI_SIGNING_PRIVATE_KEY_PASSWORD  (only if you generated it with a password)
```

Then publishing a release is just:

```bash
git tag v1.1.0
git push origin v1.1.0
```

Because installers are small (Tauri apps are a few MB, not the tens/hundreds of MB typical of Electron apps) and the download happens over a direct HTTPS connection to the release asset, updates are fast even though this is a full-package update rather than a binary diff — Tauri doesn't support delta patching today, so "no re-downloading the whole app" here means no manual redownload/reinstall step for the user, not a partial-file transfer.

## Project structure

```
src/                       React frontend
  components/
    onboarding/            Service grid, OAuth flow, password/custom sign-in
    layout/                Title bar, traffic lights, sidebar, folder modal
    mail/                  Email list, reader, compose
    settings/               Signature editor, label manager, notification/update settings
    update/                 In-app update progress banner
    ui/                    Shared design-system primitives (Button, GlassPanel, Modal, ...)
    icons/                 Brand marks used in onboarding
  lib/                     SQLite repository, Tauri command bindings, chime synthesis, updater wrapper
  store/                   Zustand stores (accounts, mail, theme, UI, updates)
  types/                   TypeScript types mirroring the Rust models

.github/workflows/         CI release pipeline (builds, signs, publishes updater artifacts)

src-tauri/                 Rust backend
  src/
    commands/               IMAP, SMTP, OAuth2, notifications, background watcher
    db/                     SQLite migration registration
    models/                 Shared serde types exposed to the frontend
  migrations/               SQLite schema
  capabilities/             Tauri v2 permission grants
```

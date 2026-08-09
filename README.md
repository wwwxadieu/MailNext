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

## Tech stack

| Layer          | Technology                                                          |
| -------------- | --------------------------------------------------------------------- |
| Shell          | Tauri v2 (Rust + native WebView2 on Windows)                          |
| UI             | React 19, TypeScript, Vite, Tailwind CSS v4                            |
| State          | Zustand                                                                 |
| Storage        | SQLite via `@tauri-apps/plugin-sql`                                     |
| Mail protocols | `async-imap`, `lettre` (SMTP), `oauth2` (OAuth2 + PKCE)                 |
| Notifications  | `@tauri-apps/plugin-notification` (native toasts) + Web Audio chimes   |
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

### Run in development

```bash
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Produces NSIS and MSI installers under `src-tauri/target/release/bundle/`.

## Project structure

```
src/                       React frontend
  components/
    onboarding/            Service grid, OAuth flow, password/custom sign-in
    layout/                Title bar, traffic lights, sidebar, folder modal
    mail/                  Email list, reader, compose
    settings/               Signature editor, label manager, notification settings
    ui/                    Shared design-system primitives (Button, GlassPanel, Modal, ...)
    icons/                 Brand marks used in onboarding
  lib/                     SQLite repository, Tauri command bindings, chime synthesis
  store/                   Zustand stores (accounts, mail, theme, UI)
  types/                   TypeScript types mirroring the Rust models

src-tauri/                 Rust backend
  src/
    commands/               IMAP, SMTP, OAuth2, notifications, background watcher
    db/                     SQLite migration registration
    models/                 Shared serde types exposed to the frontend
  migrations/               SQLite schema
  capabilities/             Tauri v2 permission grants
```

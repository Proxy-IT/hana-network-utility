# Security Policy — Hana Network Utility

## Reporting a vulnerability

If you find a security issue in Hana, please report it privately rather
than opening a public GitHub issue.

**Email:** zoran@proxy-it.co

Include as much detail as you can:

- A description of the issue and its potential impact
- Steps to reproduce it (a minimal example is ideal)
- The affected version (**Help → About** in the app, or the file name of
  the installer/DMG you used)
- Your operating system

You should expect an acknowledgment within a few business days. Please
allow a reasonable amount of time for a fix before any public disclosure.

## Supported versions

Only the **latest released version** of Hana is supported with security
fixes. Because Hana includes an in-app updater (About → Updates), keeping
up to date is a single click — there is no separate long-term-support branch.

## Scope

In scope:

- The desktop application (`electron/`, `src/`) — the Electron main process,
  preload bridge, and the React renderer
- The build and release pipeline (`.github/workflows/`, `package.json`
  `build` config) — for example, anything affecting code signing, the
  packaged installer's contents, or the auto-update mechanism
- The landing page at [hana.proxy-it.co](https://hana.proxy-it.co)

Out of scope:

- Vulnerabilities in third-party services Hana talks to at the user's
  request (ipinfo.io, ipify.org, rdap.org, whois.vu, GitHub) — please report
  those to the respective provider
- Issues that require the attacker to already have control of the machine
  Hana is running on
- Social engineering or physical access attacks

## What "secure" means for Hana's auto-updater

Since Hana can update itself, these properties are treated as security
guarantees, not just design choices, and any report that one of them
doesn't hold is treated as a valid vulnerability:

- **No arbitrary update source** — the update feed is pinned to this
  project's GitHub repository at build time and re-verified at runtime.
- **Cryptographic verification** — every downloaded update is checked
  against a SHA-512 hash from the signed release metadata before it can be
  installed.
- **No downgrades** — the updater will never replace an installed version
  with an older or pre-release one.
- **No silent updates** — checking, downloading, and installing each
  require an explicit user action; the optional "check on startup" setting
  ships off by default.

See [PRIVACY.md](PRIVACY.md) for what data Hana does and does not send.

# Codecademia

> Premium open-source theory hub and interview prep for software engineers.

A static, multi-course learning site built with vanilla HTML / CSS / JS — no build step, deployable anywhere. Today: Java. Coming: Python, Go, System Design, Kotlin.

![status](https://img.shields.io/badge/status-active-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue) ![stack](https://img.shields.io/badge/stack-static%20HTML%20%2F%20CSS%20%2F%20JS-orange)

## What is inside

- 🎓 **Courses → Modules → Topics** structure with rich metadata (level, duration, prerequisites, learning objectives)
- 📈 **Progress tracking** in `localStorage` (no signup, no tracking)
- 🌍 **3 UI languages**: RU · UK · EN; technical terms preserved identically across locales
- ⌘K **Command palette** with fuzzy search across courses & topics
- 🌓 Light / dark theme, premium gradient backdrop
- ⌨️ Hotkeys: `⌘K` / `Ctrl+K` / `/` — palette, `Esc` — close
- 📋 Code blocks with copy buttons, language badges, syntax highlighting
- 📚 Sticky sidebar (course contents) + sticky on-page ToC with scroll-spy
- 📱 Fully responsive

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080/site/
```

Alternatives: `npx serve -l 8080 .` · VS Code Live Server.

## Repository layout

```
site/
  index.html            ← SPA shell
  assets/
    app.js              ← router, views, markdown rendering, palette, progress
    catalog.js          ← course catalog (courses → modules → topics)
    i18n.js             ← UI translations RU/UK/EN
    styles.css          ← premium UI
  content/
    java/
      ru/               ← canonical RU content (markdown)
      uk/               ← UK translations (when available; falls back to RU)
      en/               ← EN translations (when available; falls back to RU)
deploy/
  cloudbuild.yaml       ← Google Cloud Build pipeline
  deploy.sh             ← one-shot Cloud Run deploy
  nginx.conf.template   ← gzip, security headers, /healthz
Dockerfile              ← nginx:alpine serving the static site
```

## Add a new course

1. Add an entry to `site/assets/catalog.js` with `id`, `slug`, `icon`, `status`, titles, modules and topics.
2. Drop content under `site/content/<courseId>/<lang>/<file>.md`.
3. Reload the page — the course appears in the catalog and command palette automatically.

## Add a translation

Mirror the RU file path under `site/content/java/uk/...` or `.../en/...`. The site falls back to RU and shows a banner when a translation is missing.

## Deploy to Google Cloud Run

```bash
./deploy/deploy.sh <PROJECT_ID> europe-west1 codecademia codecademia
```

The script enables the necessary APIs, creates an Artifact Registry repo, builds the image with Cloud Build, and deploys to Cloud Run with `--allow-unauthenticated`. See [`site/README.md`](site/README.md) for full deployment details (including a GCS+CDN alternative).

## License

MIT. Content and code are open source — fork, fix, extend, send a PR.

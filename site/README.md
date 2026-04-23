# Java Senior Interview Prep — сайт

Сучасний статичний сайт для зручного читання конспектів підготовки до інтерв’ю на Senior Java.

## Особливості

- 🌓 Темна / світла тема (зберігається у `localStorage`)
- 🌐 3 мови UI: **RU · UK · EN**
- ⌘K **Командна палітра** з нечітким пошуком
- ⌨️ Хоткеї: `⌘K`/`Ctrl+K` — пошук, `J`/`K` — наступна / попередня сторінка, `/` — пошук
- 📜 Sticky-ToC з scroll-spy
- 📋 Кнопка **copy** на блоках коду + бейдж мови
- 📖 Reading-progress bar
- ⚡ Підсвічування коду (`highlight.js`)
- 📱 Адаптивна верстка (sidebar згортається < 900 px)

## Локальний запуск

Сайт через `fetch()` тягне `.md` — потрібен локальний HTTP (через `file://` браузер заблокує).

```bash
cd /Users/Yevhenii_Donenko/work/intPreparation
python3 -m http.server 8080
# відкрити: http://localhost:8080/site/
```

Альтернативно: `npx serve -l 8080 .` або VS Code Live Server.

## Структура контенту

```
notes/
  ru/                       ← канонічні конспекти RU
    java-interview-prep.md
    15-cheatsheet.md
    16-100-questions.md
    topics/01..14*.md
    topics/15-concurrency-deep.md   ← deep dive
    topics/16-kafka-deep.md         ← deep dive
  uk/                       ← UK-переклади (хабові файли)
  en/                       ← EN-переклади (хабові файли)
site/
  index.html
  assets/{app,i18n,manifest}.js, styles.css
```

## i18n стратегія

- UI повністю перекладено на 3 мови.
- **Хабові файли** перекладено на UK/EN зі збереженням усіх технічних термінів.
- **Тематичні файли** (`topics/01..16`) — RU оригінал. У режимах UK/EN показується banner і оригінал. Технічні терміни (`HashMap`, `volatile`, `@Transactional`, `partition`, `ISR`, …) однакові всіма мовами.

---

## Деплой у Google Cloud (Cloud Run)

Артефакти у корені репозиторію:
- `Dockerfile` — `nginx:alpine` + `site/` + `notes/`
- `deploy/nginx.conf.template` — gzip, security headers, `/healthz`, `text/markdown` MIME
- `deploy/cloudbuild.yaml` — build → push → deploy
- `deploy/deploy.sh` — one-shot скрипт
- `.dockerignore`

### Передумови (1 раз)

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
```

Потрібен білінг на проєкті (Cloud Run free-tier покриває тестові навантаження).

### Деплой одною командою

```bash
./deploy/deploy.sh <PROJECT_ID> europe-west3 java-prep java-prep
```

Скрипт сам:
1. вмикає `run.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`;
2. створює Artifact Registry repo (якщо нема);
3. збирає image через **Cloud Build** (без локального Docker);
4. деплоїть у **Cloud Run** з `--allow-unauthenticated`;
5. виводить публічний URL.

Очікуваний результат:
```
✅ Deployed:    https://java-prep-xxxx-ew.a.run.app
✅ Site:        https://java-prep-xxxx-ew.a.run.app/site/
✅ Healthcheck: https://java-prep-xxxx-ew.a.run.app/healthz
```

### Альтернативно — Cloud Build trigger

```bash
gcloud builds submit --config=deploy/cloudbuild.yaml \
  --substitutions=_REGION=europe-west3,_SERVICE=java-prep
```

### Локальна перевірка образу перед деплоєм

```bash
docker build -t java-prep:local -f Dockerfile .
docker run --rm -p 8080:8080 -e PORT=8080 java-prep:local
# http://localhost:8080/site/
```

### Видалити сервіс

```bash
gcloud run services delete java-prep --region europe-west3
```

### Параметри Cloud Run (за замовчуванням у скрипті)

| параметр | значення | примітка |
|---|---|---|
| `--cpu` | 1 | мін. для статики достатньо |
| `--memory` | 256 Mi | nginx + статика влізає |
| `--min-instances` | 0 | scale-to-zero, безкоштовно у простої |
| `--max-instances` | 3 | обмеження на тест |
| `--concurrency` | 80 | nginx тягне сильно більше |
| `--port` | 8080 | вимога Cloud Run |
| `--allow-unauthenticated` | ✓ | публічний доступ |

Налаштовуй у [`deploy/deploy.sh`](../deploy/deploy.sh).

### Альтернатива: GCS + CDN (ще дешевше)

```bash
PROJECT=<PROJECT_ID>; BUCKET=$PROJECT-java-prep
gsutil mb -p $PROJECT -l EU gs://$BUCKET
gsutil web set -m site/index.html -e site/index.html gs://$BUCKET
gsutil -m rsync -r -d site  gs://$BUCKET/site
gsutil -m rsync -r -d notes gs://$BUCKET/notes
gsutil iam ch allUsers:objectViewer gs://$BUCKET
echo "https://storage.googleapis.com/$BUCKET/site/index.html"
```

Для кастомного домену + HTTPS зверху — `Load Balancer + Cloud CDN`.

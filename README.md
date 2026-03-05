# AnyConv — File Converter

A fast, free file converter supporting images, documents, audio and video.
Live at **[anyconv.betopialimited.com](https://anyconv.betopialimited.com)**

---

## Features

- Drag & drop upload
- Convert between images, PDFs, Office documents, audio and video
- Real-time progress polling
- Files auto-deleted after 30 minutes
- No account or sign-up required

---

## Supported Conversions

| Input | Output Formats |
|-------|---------------|
| JPG, PNG, WebP, GIF, BMP, TIFF, SVG | JPG, PNG, WebP, GIF, BMP, TIFF, PDF |
| PDF | PNG, JPG (first page) |
| DOCX, PPTX, XLSX | PDF |
| DOC, PPT, XLS | PDF |
| ODT, ODS, ODP | PDF |
| MP3, WAV, OGG, FLAC, AAC | MP3, WAV, OGG, MP4, WebM |
| MP4, WebM, MKV, AVI, MOV | MP4, MP3, WebM, OGG, WAV, AVI, MKV, GIF |
| Any file | ZIP |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Queue | BullMQ + Redis |
| Worker | Node.js TypeScript — plugin-based converter |
| Image conversion | ImageMagick (`magick`) |
| Document conversion | LibreOffice headless (`soffice`) |
| Audio/Video conversion | FFmpeg |
| Reverse proxy | nginx + Let's Encrypt SSL |
| Deployment | Docker Compose |
| CI/CD | GitHub Actions (typecheck + SSH deploy on push to `main`) |

---

## Security Rules

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /api/upload` | 20 requests per 15 minutes per IP |
| `POST /api/convert` | 30 requests per 15 minutes per IP |
| File size | Max 100 MB per upload |

### Blocked File Types

Uploads are rejected for dangerous extensions:
`exe`, `dll`, `apk`, `bat`, `sh`

### IP Ban System — 1 Hour Block

An IP is **automatically banned for 1 hour** when any of the following thresholds are crossed:

| Suspicious Activity | Threshold | Time Window |
|--------------------|-----------|-------------|
| Hitting rate limits repeatedly | 3 times | 10 minutes |
| Uploading invalid/oversized files | 5 times | 10 minutes |
| Sending malformed/invalid requests | 5 times | 10 minutes |
| Flooding non-existent API endpoints | 20 times | 5 minutes |

When banned, the user sees:

> *"Your IP has been blocked for 1 hour due to suspicious activity. Please try again later."*

A countdown timer shows how long until the ban expires. All page and API requests are blocked for the duration.

### Path Traversal Protection

All file paths are validated to ensure they stay within `storage/uploads` or `storage/outputs`. Any attempt to escape these directories is rejected.

### Other Protections

- Redis is not exposed to the internet (Docker internal network only)
- nginx security headers: `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`
- HTTPS enforced with HTTP → HTTPS redirect

---

## File Cleanup

The worker runs a cleanup job every **10 minutes** and deletes any files older than **30 minutes** from both `storage/uploads` and `storage/outputs`.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a file. Returns `{ fileId, fileName, mime, size }` |
| `GET` | `/api/formats?mime=...` | Get supported output formats for a MIME type |
| `POST` | `/api/convert` | Start conversion. Body: `{ fileId, sourceMime, targetExt }`. Returns `{ jobId }` |
| `GET` | `/api/job/:id` | Poll job status. Returns `{ status, progress, ... }` |
| `GET` | `/api/download/:id` | Download converted file when job is done |

---

## Local Development

```bash
# Prerequisites: Node.js 20, Redis, ImageMagick, LibreOffice, ffmpeg

# Install dependencies
npm install
cd worker && npm install && cd ..

# Start Redis
brew services start redis   # macOS
# or: docker run -d -p 6379:6379 redis:7-alpine

# Start worker
cd worker && npm run build && node dist/src/worker.js &

# Start web app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Production Deployment (Docker)

```bash
git clone https://github.com/shikubro90/file_converter.git
cd file_converter
docker compose up -d --build
```

nginx reverse proxy config is in `nginx.conf`. SSL is managed by Certbot / Let's Encrypt.

---

## CI/CD

Every push to `main`:
1. **CI** — TypeScript typecheck on web app and worker
2. **CD** — SSH into server, `git pull`, `docker compose up --build`

Required GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT`

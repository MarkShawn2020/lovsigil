<p align="center">
  <img src="docs/images/cover.png" alt="Lanna Mirror Cover" width="100%">
</p>

<h1 align="center">
  <img src="assets/logo.svg" width="32" height="32" alt="Logo" align="top">
  Lanna Spirit Mirror
</h1>

<p align="center">
  <strong>AI-powered interactive mirror that matches your expressions to Lanna guardian spirits</strong><br>
  <sub>Web | AI Vision | Thai/English/Chinese</sub>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#spirits">Guardian Spirits</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Features

- **Real-time Face Analysis** - MediaPipe AI detects multiple faces and analyzes expressions
- **Guardian Spirit Matching** - FACS-based expression analysis matches you to 5 Lanna spirits
- **Live Portrait Segmentation** - AI separates you from background with spirit-colored glow effects
- **Spirit Portrait Generation** - Generate personalized spirit artwork via Google Gemini
- **Multi-person Support** - Track up to 4 people simultaneously with individual spirit scores
- **Trilingual UI** - Thai, English, and Chinese interface

## Spirits

| Spirit | Element | Traits |
|--------|---------|--------|
| 🐉 **Naga** (พญานาค) | Water | Wisdom, Protection, Depth |
| 🦁 **Singha** (สิงห์) | Fire | Courage, Strength, Leadership |
| 🦢 **Hongsa** (หงส์) | Air | Grace, Purity, Freedom |
| 🐘 **Chang** (ช้าง) | Earth | Stability, Prosperity, Loyalty |
| 🦅 **Garuda** (ครุฑ) | Spirit | Transcendence, Sacred Power |

## Quick Start

```bash
# Install
pnpm install

# Configure
cp .env.example .env.local
# Add your GOOGLE_GEMINI_API_KEY for spirit portrait generation

# Run
pnpm dev
```

Open [http://localhost:5253](http://localhost:5253)

### Environment Variables

Required for full functionality:
```
DATABASE_URL=your_supabase_connection_string
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_GEMINI_API_KEY=your_gemini_key  # For spirit portrait generation
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15, React 19, TypeScript |
| AI Vision | MediaPipe (Face Landmarker, Image Segmenter) |
| AI Generation | Google Gemini |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | Supabase (PostgreSQL), DrizzleORM |
| i18n | next-intl (Thai/English/Chinese) |

## How It Works

1. **Camera Capture** - Accesses webcam with real-time video feed
2. **Face Detection** - MediaPipe detects faces and extracts 468 facial landmarks
3. **Expression Analysis** - FACS blendshapes analyze micro-expressions
4. **Spirit Matching** - Algorithm maps expression patterns to guardian spirit affinities
5. **Visual Effects** - Real-time segmentation with spirit-colored edge glow
6. **Portrait Generation** - Optional AI-generated spirit portrait using Gemini

## Development

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Unit tests
pnpm test:e2e     # E2E tests
pnpm db:studio    # Database explorer
```

## License

MIT

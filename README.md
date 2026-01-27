<p align="center">
  <img src="docs/images/cover.png" alt="LovSigil Cover" width="100%">
</p>

<h1 align="center">
  <img src="assets/logo.png" width="32" height="32" alt="Logo" align="top">
  LovSigil
</h1>

<p align="center">
  <strong>AI-powered personal Sigil totem generator with face detection and rune-style personalization</strong><br>
  <sub>Web | AI Vision | EN/ZH/TH/KO</sub>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Features

- **Real-time Face Detection** - MediaPipe AI detects faces and tracks multiple people
- **AI Vibe Analysis** - Analyzes facial features to understand your inner essence and energy
- **Personalized Sigil Generation** - Creates unique rune-style Sigil totems based on your vibe
- **Name & Bio Input** - Enhanced personalization with your name and personal description
- **Multiple Aspect Ratios** - Support for 1:1, 3:4, 4:3, 9:16, 16:9 formats
- **Gallery View** - Masonry grid gallery with infinite scroll to browse all generated Sigils
- **Multi-language UI** - English, Chinese, Thai, and Korean interface

## How It Works

```
Camera → Face Detection → Click Generate → Input Name+Bio → AI Vibe Analysis → Rune-style Sigil
```

1. **Camera Capture** - Access webcam with real-time video feed
2. **Face Detection** - MediaPipe detects faces and extracts facial landmarks
3. **Photo Capture** - Click on detected face to capture portrait
4. **Personal Input** - Enter your name and optional bio description
5. **Vibe Analysis** - AI analyzes your essence (warrior, sage, mystic, guardian, seeker, creator, healer)
6. **Sigil Generation** - Generate personalized rune-style Sigil totem via Google Gemini

## Quick Start

```bash
# Install
pnpm install

# Configure
cp .env.example .env.local
# Add your API keys (see Environment Variables below)

# Run
pnpm dev
```

Open [http://localhost:6484](http://localhost:6484)

### Environment Variables

Required for full functionality:
```
DATABASE_URL=your_supabase_connection_string
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_GEMINI_API_KEY=your_gemini_key  # For Sigil generation
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16, React 19, TypeScript |
| AI Vision | MediaPipe Face Landmarker |
| AI Generation | Google Gemini |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | Supabase (PostgreSQL), DrizzleORM |
| i18n | next-intl (EN/ZH/TH/KO) |
| Gallery | Masonic (virtual masonry grid) |

## Development

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Unit tests
pnpm test:e2e     # E2E tests
pnpm db:studio    # Database explorer
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MarkShawn2020/lovsigil&type=Date)](https://star-history.com/#MarkShawn2020/lovsigil&Date)

## License

[Apache-2.0](LICENSE)

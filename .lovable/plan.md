

# GearUpToFit RunMatch AI — Running Shoe Recommendation App

## Overview
An AI-powered running shoe recommendation tool that takes user inputs about their running profile and delivers personalized shoe recommendations with shareable, indexable public result pages. Branded to match gearuptofit.com's dark/red aesthetic.

## Design
- **Dark background** with **red (#E53935) accents** matching gearuptofit.com brand
- Bold uppercase headings, clean modern typography
- Fully responsive — mobile-first design
- Professional card-based layouts with smooth animations

## Pages & Flow

### 1. Landing / Quiz Page (`/`)
- Hero section: "Find My Perfect Running Shoe" with RunMatch AI branding
- Multi-step animated quiz collecting:
  - **Foot type** (neutral, flat, high arch, wide)
  - **Pronation** (neutral, overpronation, underpronation, unsure)
  - **Weekly mileage** (slider: 0–100+ km)
  - **Preferred distance** (5K, 10K, half marathon, marathon, ultra, mixed)
  - **Terrain** (road, trail, track, mixed)
  - **Pace goal** (easy/recovery, moderate, tempo, race pace)
  - **Injury history** (multi-select: plantar fasciitis, shin splints, IT band, knee pain, Achilles, none)
  - **Brand preference** (Nike, Asics, Brooks, Hoka, New Balance, Saucony, no preference)
  - **Budget** (under $100, $100–150, $150–200, $200+)
- Progress bar across steps
- "Get My Match" CTA button

### 2. Public Result Page (`/app/runmatch/:slug`)
Slug is auto-generated from inputs (e.g., `beginner-neutral-10k-road`, `overpronation-half-marathon-trail`).

**Result sections:**
1. **Best Shoe Profile** — primary recommendation with shoe category, cushioning level, drop range, support type
2. **Best Shoe Category** — explains why this category fits (e.g., stability, motion control, neutral)
3. **Rotation Recommendation** — suggests a 2-3 shoe rotation with purposes (daily trainer, speed work, long run)
4. **Training Emphasis** — starter training tips based on distance/pace goal
5. **Why This Match Works** — personalized explanation connecting inputs to recommendations

**Cherry-picked GearUpToFit links in 3 locations:**

**A) Directly under results:**
- Links contextually placed within recommendation cards

**B) "Read Before You Buy" module:**
- 📖 [How to Choose the Right Running Shoes](https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/)
- 👟 [Running Shoes Reviews](https://gearuptofit.com/review/running-shoes/)
- 🏃 [Best Running Shoes for Different Distances 2026](https://gearuptofit.com/review/best-running-shoes-for-different-distances/)

**C) FAQ block at bottom:**
- Structured FAQ section with expandable questions, embedding the same links naturally within answers
- About link to [About GearUpToFit](https://gearuptofit.com/about-us/)

### 3. SEO & AI Visibility Features
- JSON-LD structured data (FAQPage schema, Product schema) on every result page
- Clean meta titles/descriptions per result
- Open Graph tags for social sharing
- Semantic HTML headings structure

## AI Integration
- Uses **Lovable AI** (via edge function) to generate personalized, detailed recommendations based on the quiz inputs
- Recommendations are intelligent, contextual, and feel expert-written
- Each result is deterministic per input combination for consistent public URLs

## Technical Approach
- React multi-step form with animated transitions
- React Router for `/` and `/app/runmatch/:slug` routes
- Lovable Cloud edge function for AI-powered recommendation generation
- Local recommendation logic as fallback/base with AI enhancement
- All results shareable via URL


# CareOS Design System

## Brand
- **Product:** CareOS by LaunchFlow (Business Intuitive Inc.)
- **Category:** AI-native clinical operating system
- **Audience:** Clinicians, patients, healthcare IT
- **Voice:** Confident, clinical, human. Direct — no enterprise-generic filler. Uses plain language and active verbs. Numbers and evidence over adjectives.
- **Tagline pattern:** "Built for the clinic. Backed by evidence."

---

## Palette

| Token   | Hex       | Role |
|---------|-----------|------|
| ink     | `#111111` | Primary text, dark sections, nav backgrounds |
| bone    | `#f7f3eb` | Off-white baseline background |
| lime    | `#c4ff4d` | Primary accent — "live", "action", CTAs, hero blocks |
| coral   | `#ff6b5b` | Burden / urgency / clinician overflow |
| sky     | `#4d80ff` | Cloud, interop, electric blue |
| sunny   | `#ffd23f` | Proof, evidence, warm yellow |
| blush   | `#ffd1d1` | Soft pastel pink — closing CTAs |
| aqua    | `#9ee3db` | Teal accent — comparison sections |
| deep teal | `#0a3d3a` | Dark teal — contrast panels |

Tailwind tokens: `ink`, `bone`, `lime` (DEFAULT/muted/dark), `coral`, `sky`, `sunny`, `sage-*`, `warm-*`, `teal-*`, `navy-*`

---

## Typography

- **Display / headings:** Space Grotesk (Google Fonts), weights 400–700
- **Body / UI:** Inter, weights 400–600
- **Heading scale:** 92px hero → 64px section → 52px sub-section → 34px → 24px → 15px labels
- **Tracking:** `-0.03em` on heroes, `-0.025em` on section heads, `0.16em` uppercase on badges
- **Line height:** `0.93–0.96` on large display, `1.35` on prose, `1.6` on body copy

---

## Layout

- **Max width:** `max-w-7xl` (1280px) with `px-6 sm:px-10` padding
- **Section rhythm:** Full-bleed color-blocked sections, alternating bone / ink / lime / aqua / blush
- **Card radius:** `rounded-3xl` (large), `rounded-2xl` (medium), `rounded-xl` (small)
- **Spacing:** Generous — `py-20 sm:py-28` between sections
- **Grid:** `grid-cols-2` for comparisons, `grid-cols-4` for feature grids, `grid-cols-3` for step flows

---

## Components

### Hero
- Full-bleed lime (`bg-[#c4ff4d]`) or ink (`bg-[#111]`) background
- Oversized display heading (72–92px), tracking tight
- Animated pill badge above heading: ink bg + lime text, uppercase, `tracking-[0.16em]`, pulsing dot
- Two CTAs side-by-side: primary (ink bg + lime text, rounded-full) + secondary (white/40 bg, border)

### Navigation
- Sticky, `backdrop-blur-xl`, `bg-[#f7f3eb]/85` or `bg-[#111]/90`
- Logo: rounded-2xl icon tile + product name + sub-label in small uppercase
- Nav links: 13px, medium weight, `text-[#111]/70` on bone, `text-white/70` on ink
- CTA button: `bg-[#111] text-[#c4ff4d] rounded-full px-4 py-2 text-[13px] font-semibold`

### Feature Cards (color-blocked)
- Full color background (lime, coral, sky, sunny) — not white cards on white
- Icon top-left, bold heading (~24px), body copy at 14px opacity 0.8
- `rounded-3xl p-7 min-h-[230px] flex flex-col`
- Grid: 4-up on desktop, 2-up on tablet

### Step Flow Diagrams
- Dark ink background sections
- Step nodes: `rounded-2xl px-5 py-4`, colored border + background tint per state
- Numbered step labels: `text-[10px] font-bold uppercase tracking-widest` in `rgba(255,255,255,0.3)`
- Arrows: `rgba(255,255,255,0.2)` color
- Auto/instant states get a pulsing `⚡ auto` lime badge

### Comparison Panels (aqua sections)
- Section bg: `#9ee3db`
- Left card: white bg, traditional state
- Right card: `#0a3d3a` dark teal bg, CareOS state
- Quote-style body text, 20–24px, medium weight

### CTA Sections
- Blush (`#ffd1d1`) or lime background
- Centered layout, large heading (40–64px)
- Two buttons: ink+lime primary, white/50+border secondary

### Status Lifecycle Strips
- Horizontal pill row with `ArrowRight` connectors
- Active/automated states: lime border + lime text
- Standard states: subtle tinted bg matching their semantic color

### Badges / Pills
- Standard: `px-3 py-1.5 rounded-full bg-black/5 text-[11px] uppercase tracking-[0.16em] font-bold`
- Live indicator: pulsing dot `w-1.5 h-1.5 rounded-full bg-[#111] animate-pulse`
- Auto/instant: `bg-[#c4ff4d]/18 text-[#c4ff4d] border border-[#c4ff4d]/30 animate-pulse`

---

## Iconography
- **Library:** Lucide React
- **Size:** `w-4 h-4` inline, `w-5 h-5` feature cards, `w-7 h-7` hero icons
- **Style:** Stroke, no fill — matches the clean typographic aesthetic

---

## Motion
- Framer Motion for scroll-triggered sections (`useInView`)
- `fadeIn`: opacity 0→1, 0.5s ease-out
- `slideUp`: opacity 0→1 + translateY 10px→0, 0.4s ease-out
- `pulseSoft`: opacity 1→0.7→1, 3s infinite — used on live data indicators
- `animate-pulse` (Tailwind): used on live status dots and auto-dispatch badges

---

## Pages / Routes

| Route | Component | Background |
|-------|-----------|------------|
| `/` | CareOSLanding | bone |
| `/order-flow` | OrderFlowPage | ink |
| `/relational-cds` | RelationalCdsPage | bone |
| `/relational` | RelationalShowcase | bone |
| `/research` | ResearchLanding | bone |
| `/ehr/*` | Platform portal | white/teal clinical |
| `/login/*` | Auth pages | bone |

---

## Do / Don't

**Do:**
- Use full-bleed color blocks — never float a card on white with a drop shadow on the landing pages
- Lead with numbers and evidence ("47 min saved per shift", "3.1× faster")
- Use Space Grotesk for all marketing headings
- Keep CTAs as rounded-full pills, never square buttons on marketing pages

**Don't:**
- Use gradients — flat color blocks only
- Use generic healthcare stock imagery language ("empowering patients", "seamless care")
- Mix Inter and Space Grotesk in the same heading hierarchy on the same page
- Add drop shadows to marketing section cards (use border + tinted bg instead)

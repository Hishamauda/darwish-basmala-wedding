# Royal Ivory — Champagne Gold — Timeless Romance
### Creative direction & design system — دعوة زفاف درويش & بسملة

## 1. Research — the reference (im7md3/MohRad)
Studied from its public source (the live github.io page was not reachable from the build machine's network):

| Reference behaviour | Kept as an idea | Re-designed as |
|---|---|---|
| Curtain + round “OPEN” button, music starts on tap | A ceremonial *threshold* before the content | A sealed royal envelope with an original gold wax seal; the flap opens in 3D, the card rises, the scene dissolves into the names |
| Names in a Diwani font, hero date | Calligraphy is the hero | Names written right-to-left with a soft “pen edge” mask, then one gold light sweep |
| Calendar card + “save the date” | Practical date info | Location scene with a drawn palace arch, Maps search link, Google Calendar + `.ics` |
| Countdown boxes | Live anticipation | Pearl cells with hairline inner frame, time-zone aware, turns into the welcome line at the ceremony time (hidden until a time is confirmed) |
| Timeline with a dot tracking the scroll | Scroll-linked progress | Vertical line that *fills with gold light*; diamond nodes light up one by one |
| Bottom bar with modals | One-thumb navigation | Luxury-glass dock, 6 items (programme hidden until it is confirmed), Web Share with copy fallback, music toggle, WhatsApp → INFINITI page |
| Gift / wallet / bank-QR modals, friends’ messages, photos | — | **Removed entirely** (brief §8) |

Nothing from the reference repository (code, `FS_Diwany.ttf`, audio, images, SVG) was copied. All ornaments are drawn in code (`tools/make_assets.py`), music is synthesised live (`assets/js/music.js`).

## 2. Skills audit (what was available, and what it changed)
| Skill requested | Status | Concrete effect in this project |
|---|---|---|
| `ui-ux-pro-max` | ✅ used | Ran `--design-system` + UX searches. Its generic output suggested pink + Latin script fonts — **rejected** (brief fixes palette & Arabic). Kept: *exaggerated-minimal* hierarchy (oversized names, generous whitespace), 44 px touch targets, ≤5 nav items, reduced-motion rules, “1–2 animated elements per view”, no infinite decorative loops, its pre-delivery checklist. Its contrast rule exposed that **Champagne #C6A66B on Ivory is only 2.18:1** → champagne is ornament-only; small gold text uses a darker derived tone #8A6A35 (4.72:1). |
| `design-system` | ✅ used | `design/tokens.json` (primitive → semantic → component) compiled with the skill’s `generate-tokens.cjs` into `assets/css/tokens.css`; `validate-tokens.cjs` audited the CSS: 13 hard-coded colours found and moved into tokens (0 left). |
| `frontend-design` | ❌ not installed | Replaced by an explicit art direction (this document) and visual iteration with screenshots. |
| `web-typography` | ❌ not installed | Typography decisions tested directly with HarfBuzz/Chromium renders (see §4). |
| `ux-writing` | ❌ not installed | Copy reviewed manually: approved texts untouched; only short UI labels added. |
| `artifact-design` | available, not applicable | It targets claude.ai Artifacts; this deliverable is a GitHub Pages site. |
| `ui-styling` | available, not applicable | shadcn/Tailwind stack; a dependency-free static site was the better fit for speed in Gaza’s network conditions. |

## 3. Colour
| Token | Value | Use | Contrast on Ivory |
|---|---|---|---|
| `--color-bg` Ivory White | #FAF8F4 | page | — |
| `--color-surface` Pearl White | #F4EFE8 | cards, cells | — |
| `--color-text` Espresso | #30251E | body text | 14.05:1 |
| `--color-text-soft` | #5A4A3D | secondary text | ≥ 7:1 |
| `--color-gold-ornament` Champagne | #C6A66B | lines, ornaments, glow — **never text** | 2.18:1 |
| `--color-gold-display` Antique | #A88348 | large display only (≥ 24 px) | 3.30:1 |
| `--color-gold-ink` (derived) | #8A6A35 | small gold text, icons, buttons | 4.72:1 |
| `--color-gold-deep` (derived) | #6E5328 | headings, countdown digits | 6.75:1 |

## 4. Typography
* **Names & art lines — Aref Ruqaa Bold** (OFL). The bride's name keeps the `jalt` (swash) setting of the original design; it has no visible effect on «بسملة», which renders identically.
  No open-licensed *Diwani* font exists (Google Fonts & Fontsource searched: 168 Arabic-capable families). The two
  Nastaliq candidates (Gulzar, Noto Nastaliq Urdu — Diwani’s closest relatives) were rendered and **rejected because they
  corrupted Arabic names** (letters merged, dots dropped). Ruqaa renders every letter of «درويش» and «بسملة» correctly.
* **Formal text — Amiri** 400/700 (OFL): classic Naskh with complete tashkeel support for the Basmala.
* Fonts are subset to Arabic + Latin digits and served as WOFF2 (≈ 157 KB total, the two main faces preloaded).
* Arabic is **never letter-spaced**; line-height 1.95; fluid sizes with `clamp()`; dates that mix digits and Arabic are
  wrapped in `<bdi dir="ltr">` so «20-11-2026» can never be reordered into «2026-11-20».

## 5. Space, shape, ornament
Spacing scale 4 → 96 px (`--primitive-spacing-*`), radii 6 / 14 / 24 / pill. Ornaments: hairline double frames,
corner sprigs, a fleur divider, a gold pearl sprig, a palace arch (stroke-drawn) and the wax seal — all original vectors.

## 6. Motion tokens
| Token | Value | Used for |
|---|---|---|
| `--motion-micro` | 180 ms | press / hover |
| `--motion-ui` | 320 ms | toggles, toast |
| `--motion-reveal` | 700–1000 ms | scroll reveals (opacity + 18 px + 3 px blur, staggered 110 ms) |
| `--motion-scene` | 1.4–3.3 s | envelope choreography, name writing, prayer reveal |
| easing | `cubic-bezier(.22,1,.36,1)` out, `(.65,0,.35,1)` in-out | |
`prefers-reduced-motion`: envelope opens instantly, no masks/clip reveals, no parallax, no sparks.

## 7. Components
Gold button (pill, 52 px, sheen on hover), ghost button, chip, glass dock (64 px, backdrop blur, safe-area aware),
countdown cell, timeline node + progress line, royal card, calm panel, toast.

## 8. Breakpoints tested
360 · 390 · 430 · 768 · 1440 px (see `qa/screenshots/`).

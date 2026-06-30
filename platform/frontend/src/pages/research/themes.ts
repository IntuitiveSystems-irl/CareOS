// Palette themes for the Relational chart (theme explorer + showcase).
//
// Each theme is a flat map of CSS custom properties consumed by
// <RelationalChart/>. The `clinical` theme reproduces the exact look used in
// the controlled study (so the in-study prototype is visually unchanged); the
// others are vibrant alternates for the explorer / showcase only.
import type { CSSProperties } from 'react'

export interface RelationalTheme {
  id: string
  name: string
  tagline: string
  /** 3 representative colors for the explorer swatch. */
  swatch: [string, string, string]
  /** Optional display font to load + apply within the chart. */
  font?: { family: string; importUrl: string }
  vars: Record<string, string>
}

// ── Clinical Teal — matches the current study prototype exactly ──────────────
export const CLINICAL: RelationalTheme = {
  id: 'clinical',
  name: 'Clinical Teal',
  tagline: 'Calm, muted, clinical — the current study look.',
  swatch: ['#319999', '#faf8f5', '#d4daca'],
  vars: {
    '--r-panel-bg': '#faf8f5',
    '--r-panel-border': 'rgba(212,218,202,0.7)',
    '--r-surface': '#ffffff',
    '--r-divider': '#e8ebe3',
    '--r-header-from': '#267a7d',
    '--r-header-to': '#236266',
    '--r-header-fg': '#ffffff',
    '--r-header-fg-dim': '#d4f1f1',
    '--r-avatar-bg': 'rgba(255,255,255,0.15)',
    '--r-accent': '#319999',
    '--r-accent-fg': '#ffffff',
    '--r-selected-sub': '#f0fafa',
    '--r-icon': '#267a7d',
    '--r-label': '#236266',
    '--r-soft-bg': '#f0fafa',
    '--r-soft-bg-hover': 'rgba(240,250,250,0.4)',
    '--r-soft-fg': '#224f53',
    '--r-conn-border': '#76cece',
    '--r-ring': '#a9e3e3',
    '--r-badge-bg': '#d4f1f1',
    '--r-badge-fg': '#236266',
    '--r-text': '#111827',
    '--r-muted': '#9ca3af',
    '--r-muted-2': '#6b7280',
    '--r-danger': '#dc2626',
    '--r-danger-soft-bg': '#fef2f2',
    '--r-danger-soft-fg': '#b91c1c',
    '--r-danger-icon': '#ef4444',
    '--r-chip-radius': '0.75rem',
    '--r-panel-radius': '1rem',
    '--r-shadow': '0 2px 15px -3px rgba(0,0,0,0.04), 0 4px 6px -4px rgba(0,0,0,0.02)',
    '--r-glow': '0 0 20px rgba(49,153,153,0.12)',
    '--r-font': "'Inter', system-ui, -apple-system, sans-serif",
  },
}

// ── Vibrant CareOS — ink + lime, bold and editorial ─────────────────────────
export const VIBRANT: RelationalTheme = {
  id: 'vibrant',
  name: 'Vibrant CareOS',
  tagline: 'Ink + lime, bold and editorial — the launchflow.tech language.',
  swatch: ['#c4ff4d', '#111111', '#ff6b5b'],
  font: {
    family: "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif",
    importUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
  },
  vars: {
    '--r-panel-bg': '#f7f3eb',
    '--r-panel-border': 'rgba(17,17,17,0.10)',
    '--r-surface': '#ffffff',
    '--r-divider': 'rgba(17,17,17,0.07)',
    '--r-header-from': '#c4ff4d',
    '--r-header-to': '#b6f53d',
    '--r-header-fg': '#111111',
    '--r-header-fg-dim': 'rgba(17,17,17,0.6)',
    '--r-avatar-bg': 'rgba(17,17,17,0.12)',
    '--r-accent': '#111111',
    '--r-accent-fg': '#c4ff4d',
    '--r-selected-sub': 'rgba(196,255,77,0.75)',
    '--r-icon': '#111111',
    '--r-label': '#111111',
    '--r-soft-bg': '#eefcc9',
    '--r-soft-bg-hover': 'rgba(196,255,77,0.18)',
    '--r-soft-fg': '#33450a',
    '--r-conn-border': '#b6f53d',
    '--r-ring': 'rgba(196,255,77,0.65)',
    '--r-badge-bg': '#111111',
    '--r-badge-fg': '#c4ff4d',
    '--r-text': '#111111',
    '--r-muted': 'rgba(17,17,17,0.45)',
    '--r-muted-2': 'rgba(17,17,17,0.65)',
    '--r-danger': '#e0392b',
    '--r-danger-soft-bg': '#ffe7e4',
    '--r-danger-soft-fg': '#b3261e',
    '--r-danger-icon': '#ff6b5b',
    '--r-chip-radius': '0.9rem',
    '--r-panel-radius': '1.4rem',
    '--r-shadow': '0 10px 40px -15px rgba(0,0,0,0.14), 0 4px 6px -4px rgba(0,0,0,0.04)',
    '--r-glow': '0 8px 20px -6px rgba(17,17,17,0.35)',
    '--r-font': "'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif",
  },
}

// ── Electric Sky — confident, product-blue ──────────────────────────────────
export const SKY: RelationalTheme = {
  id: 'sky',
  name: 'Electric Sky',
  tagline: 'Confident product-blue with crisp white surfaces.',
  swatch: ['#4d80ff', '#f5f8ff', '#1e3a8a'],
  vars: {
    '--r-panel-bg': '#f5f8ff',
    '--r-panel-border': 'rgba(77,128,255,0.18)',
    '--r-surface': '#ffffff',
    '--r-divider': '#e6edff',
    '--r-header-from': '#4d80ff',
    '--r-header-to': '#3a63d9',
    '--r-header-fg': '#ffffff',
    '--r-header-fg-dim': 'rgba(255,255,255,0.8)',
    '--r-avatar-bg': 'rgba(255,255,255,0.18)',
    '--r-accent': '#4d80ff',
    '--r-accent-fg': '#ffffff',
    '--r-selected-sub': '#eaf1ff',
    '--r-icon': '#3a63d9',
    '--r-label': '#2f4fb0',
    '--r-soft-bg': '#eaf1ff',
    '--r-soft-bg-hover': 'rgba(234,241,255,0.5)',
    '--r-soft-fg': '#1e3a8a',
    '--r-conn-border': '#b9ccff',
    '--r-ring': 'rgba(77,128,255,0.35)',
    '--r-badge-bg': '#dde7ff',
    '--r-badge-fg': '#2f4fb0',
    '--r-text': '#0f172a',
    '--r-muted': '#94a3b8',
    '--r-muted-2': '#64748b',
    '--r-danger': '#dc2626',
    '--r-danger-soft-bg': '#fef2f2',
    '--r-danger-soft-fg': '#b91c1c',
    '--r-danger-icon': '#ef4444',
    '--r-chip-radius': '0.85rem',
    '--r-panel-radius': '1.2rem',
    '--r-shadow': '0 10px 40px -18px rgba(30,58,138,0.25)',
    '--r-glow': '0 0 20px rgba(77,128,255,0.28)',
    '--r-font': "'Inter', system-ui, -apple-system, sans-serif",
  },
}

// ── Midnight — dark mode legibility check ───────────────────────────────────
export const MIDNIGHT: RelationalTheme = {
  id: 'midnight',
  name: 'Midnight',
  tagline: 'Dark surfaces with a teal glow — focus-mode reading.',
  swatch: ['#4ab4b4', '#0f1115', '#e6e9ef'],
  vars: {
    '--r-panel-bg': '#0f1115',
    '--r-panel-border': 'rgba(255,255,255,0.08)',
    '--r-surface': '#171a21',
    '--r-divider': 'rgba(255,255,255,0.06)',
    '--r-header-from': '#1b1f27',
    '--r-header-to': '#0f1115',
    '--r-header-fg': '#ffffff',
    '--r-header-fg-dim': 'rgba(255,255,255,0.5)',
    '--r-avatar-bg': 'rgba(255,255,255,0.08)',
    '--r-accent': '#4ab4b4',
    '--r-accent-fg': '#0f1115',
    '--r-selected-sub': 'rgba(15,17,21,0.7)',
    '--r-icon': '#4ab4b4',
    '--r-label': '#9fe6e6',
    '--r-soft-bg': 'rgba(74,180,180,0.14)',
    '--r-soft-bg-hover': 'rgba(74,180,180,0.08)',
    '--r-soft-fg': '#9fe6e6',
    '--r-conn-border': 'rgba(74,180,180,0.5)',
    '--r-ring': 'rgba(74,180,180,0.35)',
    '--r-badge-bg': 'rgba(74,180,180,0.2)',
    '--r-badge-fg': '#9fe6e6',
    '--r-text': '#e6e9ef',
    '--r-muted': 'rgba(230,233,239,0.5)',
    '--r-muted-2': 'rgba(230,233,239,0.7)',
    '--r-danger': '#ff6b5b',
    '--r-danger-soft-bg': 'rgba(255,107,91,0.14)',
    '--r-danger-soft-fg': '#ff9c91',
    '--r-danger-icon': '#ff6b5b',
    '--r-chip-radius': '0.85rem',
    '--r-panel-radius': '1.2rem',
    '--r-shadow': '0 16px 50px -20px rgba(0,0,0,0.6)',
    '--r-glow': '0 0 24px rgba(74,180,180,0.4)',
    '--r-font': "'Inter', system-ui, -apple-system, sans-serif",
  },
}

export const RELATIONAL_THEMES: RelationalTheme[] = [CLINICAL, VIBRANT, SKY, MIDNIGHT]

export const getTheme = (id: string): RelationalTheme =>
  RELATIONAL_THEMES.find((t) => t.id === id) ?? CLINICAL

/** CSS variable map as an inline style object for the chart root. */
export const themeStyle = (t: RelationalTheme): CSSProperties =>
  ({ ...t.vars } as CSSProperties)

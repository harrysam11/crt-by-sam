/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg, #08090d)',
        panel: 'var(--color-panel, #0e1017)',
        surface: 'var(--color-surface, #141722)',
        grid: 'var(--color-grid, rgba(255, 255, 255, 0.08))',
        primary: 'var(--color-text, #f8fafc)',
        secondary: 'var(--color-secondary, #94a3b8)',
        up: 'var(--color-up, #22c55e)',
        down: 'var(--color-down, #ef4444)',
        accent: 'var(--color-accent, #38bdf8)',
        muted: 'var(--color-muted, #64748b)',
      },
      boxShadow: {
        'clay-card': '6px 6px 14px #020204, -3px -3px 8px rgba(255, 255, 255, 0.03), inset 1px 1px 1.5px rgba(255, 255, 255, 0.12), inset -2px -2px 4px rgba(0, 0, 0, 0.65)',
        'clay-pill': '4px 4px 10px #020204, -2px -2px 6px rgba(255, 255, 255, 0.03), inset 1px 1px 1px rgba(255, 255, 255, 0.12), inset -1px -1px 2px rgba(0, 0, 0, 0.55)',
        'clay-pill-active': '0 0 16px rgba(255, 255, 255, 0.35), 4px 4px 10px #020204, inset 1px 1px 2px rgba(255, 255, 255, 0.8), inset -2px -2px 3px rgba(0, 0, 0, 0.25)',
        'clay-btn': '3px 3px 8px #020204, -2px -2px 5px rgba(255, 255, 255, 0.03), inset 1px 1px 1px rgba(255, 255, 255, 0.1), inset -1px -1px 2px rgba(0, 0, 0, 0.5)',
        'clay-inset': 'inset 3px 3px 8px #020203, inset -2px -2px 6px rgba(255, 255, 255, 0.03)',
      },
      borderRadius: {
        'clay': '16px',
        'clay-lg': '22px',
        'clay-pill': '9999px',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

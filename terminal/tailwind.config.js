/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg, #0b0e14)',
        panel: 'var(--color-panel, #10141c)',
        grid: 'var(--color-grid, #1e222d)',
        up: '#26a69a',
        down: '#ef5350',
        accent: '#4c8dff',
        muted: 'var(--color-muted, #6b7384)',
      },
    },
  },
  plugins: [],
};

import type { Config } from 'tailwindcss';

// Luxury black & white palette (see DESIGN.md). Tokens mirror the CSS variables
// declared in globals.css so they can be used as Tailwind utilities too.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deep': 'var(--bg-deep)',
        'bg-base': 'var(--bg-base)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-glass': 'var(--bg-glass)',
        'text-high': 'var(--text-high)',
        'text-mid': 'var(--text-mid)',
        'text-low': 'var(--text-low)',
        'on-card-high': 'var(--on-card-high)',
        'on-card-mid': 'var(--on-card-mid)',
        'on-card-low': 'var(--on-card-low)',
        accent: 'var(--accent)',
        gold: 'var(--gold)',
        border: 'var(--border)',
        'border-card': 'var(--border-card)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        display: 'var(--font-display)',
      },
      boxShadow: {
        'glow-white': 'var(--glow-white)',
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};

export default config;

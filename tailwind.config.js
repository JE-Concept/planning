/** @type {import('tailwindcss').Config} */

/*
 * De JE Concept-huisstijl, overgenomen uit Kenjeklanten/je-concept
 * (src/styles/tokens.css + tailwind.config.js). De schalen `ink` en `accent`
 * zijn hier de dragers: de app gebruikt ze al overal, dus door ze op de
 * merkwaarden te zetten staat de hele tool in één keer in huisstijl.
 * De merknamen staan er los naast voor waar een specifieke kleur hoort.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Merkkleuren, letterlijk uit tokens.css ──────────────────────────
        navy:   { DEFAULT: '#1A3A6B', dark: '#112550', light: '#243F75' },
        powder: { DEFAULT: '#4A7FC1', light: '#7AAAD6' },
        sky:    '#B8D4F0',
        gold:   { DEFAULT: '#C9A84C', soft: '#E8D89C' },
        bone:   '#FAF8F4',
        sand:   '#F5EFE3',

        // ── Neutralen: warme grond, koele grijstrap, ink als tekstkleur ─────
        ink: {
          50:  '#FAF8F4', // bone — de grond van de app
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0B1626', // --ink — primaire tekst
          950: '#060D16', // schaduwlagen achter dialogen
        },

        // ── Actie: powder voor focus en rand, navy voor de primaire knop ────
        accent: {
          50:  '#EAF1FA',
          100: '#D6E6F6',
          200: '#B8D4F0', // sky
          300: '#7AAAD6', // powder-light
          400: '#5C92CB',
          500: '#4A7FC1', // powder
          600: '#1A3A6B', // navy
          700: '#112550', // navy-dark
          800: '#0E1F44',
          900: '#0B1938',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:    ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        // Warm getint, zoals de JE Concept-elevatieschaal
        card:   '0 1px 3px rgba(11, 22, 38, 0.06)',
        'cue-md': '0 6px 24px rgba(11, 22, 38, 0.08)',
        'cue-lg': '0 16px 48px rgba(11, 22, 38, 0.12)',
        drawer: '-8px 0 48px rgba(11, 22, 38, 0.18)',
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(135deg, #112550 0%, #1A3A6B 60%, #243F75 100%)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */

/*
 * De JE Concept-huisstijl zoals het design ze vastlegt (Claude Design, "JE
 * Concept Design System"): navy uit het logo, koele papiergrond, Oswald voor
 * koppen en Source Sans 3 voor tekst, en strakke hoeken.
 *
 * De tokens zelf staan in src/styles/je-ds.css. Hier worden de Tailwind-schalen
 * die de app al overal gebruikt (`ink`, `accent`) op die tokens gezet, zodat ook
 * de schermen die niet in het design staan meteen in dezelfde stijl staan.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Merk, letterlijk uit het design system ─────────────────────────
        navy: {
          DEFAULT: '#1B3A6B',
          dark: '#00172E',
          light: '#2A4E86',
          50: '#EEF2F8',
          100: '#DCE4F0',
          200: '#C6D3E8',
          300: '#9DB3D5',
          400: '#6C8CBE',
          500: '#3E67A3',
          600: '#2A4E86',
          700: '#1B3A6B',
          800: '#003060',
          900: '#002246',
          950: '#00172E',
        },
        paper: '#F8F9FB',
        powder: { DEFAULT: '#3E67A3', light: '#6C8CBE' },
        sky: '#C6D3E8',
        gold: { DEFAULT: '#B4761B', soft: '#E8D89C' },
        bone: '#F8F9FB',
        sand: '#EEF2F8',

        // ── Neutralen: papier als grond, navy-slate als tekst ───────────────
        ink: {
          50: '#F8F9FB', // paper — de grond van de app
          100: '#EEF2F8',
          200: '#E6E9EE',
          300: '#C9CFD8',
          400: '#98A1B0',
          500: '#5C6779',
          600: '#2E3744',
          700: '#2E3744',
          800: '#002246',
          900: '#00172E', // navy-950 — primaire tekst
          950: '#00172E',
        },

        // ── Actie: navy-700 is de primaire knop ─────────────────────────────
        accent: {
          50: '#EEF2F8',
          100: '#DCE4F0',
          200: '#C6D3E8',
          300: '#9DB3D5',
          400: '#6C8CBE',
          500: '#3E67A3',
          600: '#1B3A6B',
          700: '#002246',
          800: '#00172E',
          900: '#00172E',
        },
      },
      fontFamily: {
        display: ['Oswald', '"Helvetica Neue Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans: ['"Source Sans 3"', '"Helvetica Neue"', 'Helvetica', 'system-ui', 'sans-serif'],
        script: ['Parisienne', 'cursive'],
        serif: ['Prata', 'Didot', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      // Het merk leest strak, niet vriendelijk-rond: de bestaande afrondingen
      // worden allemaal klein, zonder elke klasse in de app te herschrijven.
      borderRadius: {
        sm: '2px',
        DEFAULT: '2px',
        md: '2px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '8px',
        '4xl': '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,23,46,.05), 0 6px 16px -12px rgba(0,23,46,.18)',
        'cue-md': '0 2px 4px rgba(0,23,46,.06), 0 18px 40px -24px rgba(0,23,46,.28)',
        'cue-lg': '0 4px 8px rgba(0,23,46,.07), 0 40px 80px -36px rgba(0,23,46,.34)',
        drawer: '-8px 0 48px rgba(0,23,46,.18)',
      },
      backgroundImage: {
        'gradient-navy': 'linear-gradient(180deg, #00172E 0%, #002246 100%)',
      },
    },
  },
  plugins: [],
}

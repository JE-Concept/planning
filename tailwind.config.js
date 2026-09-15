/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral surface scale — the app is a dense work tool, so the chrome
        // stays quiet and the brand colours come from the data itself.
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0b9c9',
          400: '#8593a9',
          500: '#65748d',
          600: '#505d74',
          700: '#414b5e',
          800: '#38404f',
          900: '#232935',
          950: '#161a22',
        },
        accent: {
          50: '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd7ff',
          300: '#8ebeff',
          400: '#599bff',
          500: '#3377ff',
          600: '#1d57f5',
          700: '#1743e1',
          800: '#1938b6',
          900: '#1b358f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10)',
        drawer: '-8px 0 32px rgba(16, 24, 40, 0.12)',
      },
    },
  },
  plugins: [],
}

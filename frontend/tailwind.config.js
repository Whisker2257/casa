// /Users/nashe/casa/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#6366f1', dark: '#4f46e5' },
        secondary: '#a1a1aa',
        background: '#0b0c0d',
        surface: '#18191b',
        'text-primary': '#f9fafb',
        'text-secondary': '#9ca3af',
        border: '#27272a',
        accent: '#8b5cf6',
        success: '#22c55e',
        warning: '#facc15',
        error: '#ef4444',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

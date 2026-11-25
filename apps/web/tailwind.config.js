/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#008000',
          blue: '#008000',
          teal: '#006600',
          warning: '#B45309',
          danger: '#B91C1C',
          bg: '#F4F6F9',
          text: '#1E293B',
        },
        primary: {
          DEFAULT: '#008000',
          foreground: '#FFFFFF',
          hover: '#006600',
        },
        secondary: {
          DEFAULT: '#008000',
          foreground: '#FFFFFF',
          hover: '#006600',
        },
        accent: {
          DEFAULT: '#006600',
          foreground: '#FFFFFF',
          hover: '#004D00',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#162C46',
          blue: '#1D5A96',
          teal: '#0F766E',
          warning: '#B45309',
          danger: '#B91C1C',
          bg: '#F4F6F9',
          text: '#1E293B',
        },
        primary: {
          DEFAULT: '#162C46',
          foreground: '#FFFFFF',
          hover: '#0F2034',
        },
        secondary: {
          DEFAULT: '#1D5A96',
          foreground: '#FFFFFF',
          hover: '#164675',
        },
        accent: {
          DEFAULT: '#0F766E',
          foreground: '#FFFFFF',
          hover: '#0D5E58',
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

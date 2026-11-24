/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#172F50',
          blue: '#2563A6',
          teal: '#0D9488',
          warning: '#F59E0B',
          bg: '#F8FAFC',
          text: '#1E293B',
        },
        primary: {
          DEFAULT: '#172F50',
          foreground: '#FFFFFF',
          hover: '#0F2139',
        },
        secondary: {
          DEFAULT: '#2563A6',
          foreground: '#FFFFFF',
          hover: '#1D4E83',
        },
        accent: {
          DEFAULT: '#0D9488',
          foreground: '#FFFFFF',
          hover: '#0B766D',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
      },
    },
  },
  plugins: [],
};

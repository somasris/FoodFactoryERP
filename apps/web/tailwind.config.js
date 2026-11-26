/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#245C3A',
          dark: '#17452C',
          forest: '#103B28',
          sidebar: '#173F2B',
          blue: '#3D7651',
          teal: '#3D7651',
          muted: '#6F9478',
          gold: '#C39A45',
          goldLight: '#E8D7AA',
          cream: '#F4F0E4',
          subtle: '#EAF1E8',
          input: '#FAFBF8',
          border: '#E1E7DD',
          warning: '#C58A25',
          danger: '#C74440',
          info: '#3977A8',
          success: '#27834A',
          bg: '#F7F8F2',
          text: '#24352A',
          textSecondary: '#66756A',
          textMuted: '#8A958C',
        },
        primary: {
          DEFAULT: '#245C3A',
          foreground: '#FFFFFF',
          hover: '#17452C',
        },
        secondary: {
          DEFAULT: '#EAF1E8',
          foreground: '#17452C',
          hover: '#DCE7D8',
        },
        accent: {
          DEFAULT: '#C39A45',
          foreground: '#FFFFFF',
          hover: '#A88336',
        },
        muted: {
          DEFAULT: '#F4F0E4',
          foreground: '#66756A',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans Tamil',
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

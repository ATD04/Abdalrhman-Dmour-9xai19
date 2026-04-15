/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        twin: {
          bg:           '#080808',
          surface:      '#0E0E0E',
          card:         '#141414',
          hover:        '#1C1C1C',
          border:       '#232323',
          'border-mid': '#303030',
          'border-hi':  '#404040',
          text:         '#F2F2F2',
          'text-2':     '#9A9A9A',
          'text-3':     '#545454',
          accent:       '#FFFFFF',
        },
      },
      fontFamily: {
        sans:   ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

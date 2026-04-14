import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary: Rich Slate-Indigo (aligned with CSS --primary-* tokens) ──
        primary: {
          50: '#f8fafc',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
        },
        // ── Accent: Warm Gold (aligned with CSS --accent-* tokens) ──
        accent: {
          gold: '#d4a853',
          'gold-light': '#e8c87a',
          'gold-dark': '#b8923a',
        },
        // ── Teal: Vibrant accent ──
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          DEFAULT: '#0d9488',
          light: '#f0fdfa',
        },
        // ── Surface ──
        surface: {
          DEFAULT: 'var(--bg-card)',
          muted: 'var(--bg-muted)',
          subtle: 'var(--bg-subtle)',
          elevated: 'var(--bg-elevated)',
        },
        // ── Semantic Colors (aligned with CSS tokens) ──
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          700: '#15803d',
        },
        warning: {
          50: '#fefce8',
          100: '#fef9c3',
          500: '#eab308',
          700: '#a16207',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          700: '#b91c1c',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          700: '#1d4ed8',
        },
        // ── Warm Stone neutrals ──
        stone: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        arabic: ['IBM Plex Sans Arabic', 'Noto Sans Arabic', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['18px', { lineHeight: '28px' }],
        '2xl': ['22px', { lineHeight: '32px' }],
        '3xl': ['28px', { lineHeight: '36px' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        'sm': '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 4px -1px rgb(15 23 42 / 0.06)',
        'md': '0 2px 4px -1px rgb(15 23 42 / 0.04), 0 4px 8px -2px rgb(15 23 42 / 0.08)',
        'lg': '0 4px 6px -2px rgb(15 23 42 / 0.03), 0 12px 20px -4px rgb(15 23 42 / 0.08)',
        'xl': '0 8px 10px -4px rgb(15 23 42 / 0.03), 0 20px 32px -8px rgb(15 23 42 / 0.10)',
        'glow': '0 0 24px rgb(13 148 136 / 0.15)',
        'glow-gold': '0 0 24px rgb(212 168 83 / 0.15)',
        'card': '0 1px 2px 0 rgb(15 23 42 / 0.03), 0 2px 6px -1px rgb(15 23 42 / 0.05)',
        'card-hover': '0 4px 6px -2px rgb(15 23 42 / 0.04), 0 12px 24px -4px rgb(15 23 42 / 0.09)',
      },
      borderRadius: {
        'sm': '8px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        '2xl': '24px',
        '3xl': '32px',
      },
      animation: {
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out forwards',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
  plugins: [],
};

export default config;

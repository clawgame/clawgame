import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        bg: {
          primary: '#0a0a0f',
          secondary: '#12121a',
          tertiary: '#1a1a25',
          card: '#15151f',
          elevated: '#1f1f2e',
        },
        // Accents
        accent: {
          primary: '#00ff88',
          secondary: '#00cc6a',
          purple: '#a855f7',
          cyan: '#22d3ee',
          orange: '#ff6b35',
          red: '#ef4444',
          yellow: '#fbbf24',
        },
        // Text
        text: {
          primary: '#ffffff',
          secondary: '#a0a0b0',
          muted: '#606070',
        },
        // Borders
        border: {
          DEFAULT: '#2a2a3a',
          hover: '#3a3a4a',
          active: '#00ff88',
        },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 40px rgba(0, 255, 136, 0.15)',
        'glow-green-lg': '0 0 60px rgba(0, 255, 136, 0.25)',
        'glow-purple': '0 0 40px rgba(168, 85, 247, 0.15)',
        'glow-red': '0 0 40px rgba(239, 68, 68, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 20s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-up': 'fadeUp 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(50px, -30px) scale(1.1)' },
          '66%': { transform: 'translate(-30px, 50px) scale(0.9)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

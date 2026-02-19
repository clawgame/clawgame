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
          primary: '#0f1218',
          secondary: '#151922',
          tertiary: '#1e2430',
          card: '#161b25',
          elevated: '#232b39',
        },
        // Accents
        accent: {
          primary: '#ff6a00',
          secondary: '#ff8f1f',
          purple: '#ff3d00',
          cyan: '#53d9ff',
          orange: '#ff6a00',
          red: '#ff4d30',
          yellow: '#ffc45a',
        },
        // Text
        text: {
          primary: '#f7f9fc',
          secondary: '#b3bdcd',
          muted: '#697487',
        },
        // Borders
        border: {
          DEFAULT: '#2b3443',
          hover: '#3a4558',
          active: '#ff6a00',
        },
      },
      fontFamily: {
        display: ['Exo 2', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
      },
      boxShadow: {
        'glow-green': '0 0 40px rgba(255, 106, 0, 0.2)',
        'glow-green-lg': '0 0 65px rgba(255, 106, 0, 0.35)',
        'glow-purple': '0 0 40px rgba(255, 61, 0, 0.2)',
        'glow-red': '0 0 40px rgba(255, 77, 48, 0.22)',
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

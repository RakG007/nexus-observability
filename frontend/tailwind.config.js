/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#04070F',
        panel: '#0A101F',
        surface: '#111A30',
        borderline: '#1E2D4D',
        cipherCyan: '#22D3EE',
        cipherViolet: '#8B5CF6',
        cipherEmerald: '#10B981',
        cipherAmber: '#F59E0B',
        cipherRose: '#F43F5E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'orb-drift': {
          '0%, 100%': { transform: 'translate3d(0px, 0px, 0) scale(1)' },
          '33%': { transform: 'translate3d(38px, -26px, 0) scale(1.06)' },
          '66%': { transform: 'translate3d(-28px, 22px, 0) scale(0.95)' },
        },
        'orb-drift-reverse': {
          '0%, 100%': { transform: 'translate3d(0px, 0px, 0) scale(1)' },
          '33%': { transform: 'translate3d(-34px, 28px, 0) scale(1.08)' },
          '66%': { transform: 'translate3d(26px, -22px, 0) scale(0.94)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-reverse-slow': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'scan-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      animation: {
        'orb-drift': 'orb-drift 18s ease-in-out infinite',
        'orb-drift-reverse': 'orb-drift-reverse 22s ease-in-out infinite',
        'spin-slow': 'spin-slow 24s linear infinite',
        'spin-reverse-slow': 'spin-reverse-slow 18s linear infinite',
        'scan-sweep': 'scan-sweep 4.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'cyber-bg': '#0a0e17',
        'cyber-panel': '#1a1f2e',
        'cyber-cyan': '#00f0ff',
        'cyber-red': '#ff2d55',
        'cyber-orange': '#ff9100',
        'cyber-green': '#00e676',
      },
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
        'source-sans': ['"Source Sans 3"', 'sans-serif'],
      },
      animation: {
        'pulse-alert': 'pulse-alert 2s ease-in-out infinite',
        'glow-cyan': 'glow-cyan 2s ease-in-out infinite',
        'flow-data': 'flow-data 1.5s linear infinite',
      },
      keyframes: {
        'pulse-alert': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'glow-cyan': {
          '0%, 100%': { boxShadow: '0 0 5px #00f0ff, 0 0 10px #00f0ff33' },
          '50%': { boxShadow: '0 0 15px #00f0ff, 0 0 30px #00f0ff55' },
        },
        'flow-data': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
    },
  },
  plugins: [],
};

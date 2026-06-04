/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'bg-primary': '#0a0e17',
        'bg-secondary': '#1a1f2e',
        'bg-tertiary': '#2a3040',
        'accent-green': '#00ff88',
        'accent-red': '#ff3366',
        'accent-orange': '#ffaa00',
        'accent-blue': '#00aaff',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
    },
  },
  plugins: [],
};

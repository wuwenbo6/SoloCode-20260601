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
        hud: {
          bg: '#0a0e17',
          primary: '#00ff88',
          warning: '#ff9500',
          info: '#00d4ff',
          alert: '#ff3b30',
          panel: 'rgba(10, 14, 23, 0.85)',
          border: 'rgba(0, 255, 136, 0.3)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        heading: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        'hud-glow': '0 0 10px rgba(0, 255, 136, 0.3), 0 0 20px rgba(0, 255, 136, 0.1)',
        'hud-glow-lg': '0 0 15px rgba(0, 255, 136, 0.4), 0 0 30px rgba(0, 255, 136, 0.2)',
        'hud-glow-warning': '0 0 10px rgba(255, 149, 0, 0.3), 0 0 20px rgba(255, 149, 0, 0.1)',
        'hud-glow-alert': '0 0 10px rgba(255, 59, 48, 0.3), 0 0 20px rgba(255, 59, 48, 0.1)',
        'hud-glow-info': '0 0 10px rgba(0, 212, 255, 0.3), 0 0 20px rgba(0, 212, 255, 0.1)',
      },
    },
  },
  plugins: [],
};

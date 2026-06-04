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
        nvme: {
          bg: '#0a0e17',
          surface: '#111827',
          surfaceLight: '#1e293b',
          border: '#1e3a5f',
          cyan: '#00e5ff',
          cyanDim: '#00b8d4',
          red: '#ff3d71',
          redDim: '#e63956',
          green: '#00e096',
          greenDim: '#00c07f',
          text: '#e2e8f0',
          textDim: '#94a3b8',
          textMuted: '#64748b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

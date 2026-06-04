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
        primary: '#1a1a2e',
        secondary: '#2d2d44',
        accent: '#00e676',
        danger: '#ff5252',
        info: '#448aff',
        surface: '#16162a',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

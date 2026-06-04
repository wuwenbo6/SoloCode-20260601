/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        "crypt-bg": "#0f172a",
        "crypt-card": "#1e293b",
        "crypt-accent": "#10b981",
        "crypt-text": "#94a3b8",
        "crypt-border": "#334155",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

import type { Config } from "tailwindcss";

export default {
  // darkMode: "selector",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8b28c1',
        secondary: '#322fbc',
        "light-title": '#0f172a',
        "light-text": '#334155',
        "light-bg": "#ffffff",
        "light-bg-2": "#f8fafc",
        "light-input": "#f9fafb",
        "light-border": "#d1d5db",
        "light-boxshadow": "#e5e7eb",
        "dark-title": "#e2e8f0",
        "dark-text": "#94a3b8",
        "dark-bg": "#0f172a",
        "dark-bg-2": "#1e293b",
        "dark-border": "#4b5563",
        "dark-input": "#374151",
        "dark-boxshadow": "#ffffff1a",
      },
      backgroundImage: {
        'mic-gradient': 'linear-gradient(to right, #8b28c1, #322fbc)', 
        'mic-gradient-reverse': 'linear-gradient(to right, #322fbc, #8b28c1)', 

      },
    },
  },
  plugins: [],
} satisfies Config;

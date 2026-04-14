/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shield: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 700: '#15803d', 900: '#14532d' },
        threat: { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 700: '#b91c1c', 900: '#7f1d1d' },
        armor:  { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
      },
    },
  },
  plugins: [],
};

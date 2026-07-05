/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        night: '#050506',
        ink: '#101010',
        champagne: '#d8b56d',
        ivory: '#f7f1e5',
        platinum: '#d8d5ce',
      },
      boxShadow: {
        glow: '0 24px 70px rgba(216, 181, 109, 0.18)',
        panel: '0 22px 60px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1D9E75',
          light: '#22c55e',
          dark: '#166b50',
        },
      },
    },
  },
  plugins: [],
};

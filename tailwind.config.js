/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#10B981',
        success: '#10B981',
        danger: '#EF4444',
        alert: '#F59E0B',
        background: '#F9FAFB',
      },
    },
  },
  plugins: [],
};

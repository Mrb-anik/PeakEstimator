/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-indigo-50','bg-emerald-50','bg-amber-50','bg-blue-50','bg-red-50','bg-green-50',
    'text-indigo-600','text-emerald-600','text-amber-600','text-blue-600','text-red-600','text-green-600',
    'bg-indigo-100','bg-blue-50','bg-amber-50',
  ]
};

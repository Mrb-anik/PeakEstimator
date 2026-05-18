import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          50: '#EEEDFD',
          100: '#DDDCFB',
          200: '#BBB9F7',
          300: '#9995F3',
          400: '#7772EF',
          500: '#4F46E5',
          600: '#3730BD',
          700: '#2B2595',
          800: '#1F1B6D',
          900: '#141145',
        },
        dark: '#0F172A',
        slate: {
          750: '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'indigo': '0 10px 30px -5px rgba(79, 70, 229, 0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;

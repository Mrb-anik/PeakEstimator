/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // PeakEstimator Enterprise Palette
        navy: {
          DEFAULT: '#0F172A',
          700: '#1E293B',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        copper: {
          DEFAULT: '#C58B5C',
          hover: '#D9A679',
          50:  '#FDF8F5',
          100: '#F9EFE8',
          200: '#F0D5C1',
          300: '#E7BB9A',
          400: '#DEA173',
          500: '#C58B5C',
          600: '#A46F46',
          700: '#845431',
          800: '#643C1F',
          900: '#472712',
        },
        gold: {
          DEFAULT: '#D9A679',
        },
        app: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          darkBg: '#020617',
          darkCard: '#0F172A',
          darkBorder: '#1E293B',
        },
        text: {
          primary: '#111827',
          secondary: '#64748B',
          darkPrimary: '#F8FAFC',
          darkSecondary: '#94A3B8',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
        sora: ['Sora', 'sans-serif'],
        'space-grotesk': ['"Space Grotesk"', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        'card': '0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.03)',
        'premium': '0 10px 30px -10px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.02)',
      },
      backgroundImage: {
        'peak-hero': 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out forwards',
        'scale-in':   'scaleIn 0.2s ease-out forwards',
        'slide-up':   'slideUp 0.35s ease-out forwards',
        'float':      'float 6s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.95)' },     to: { opacity: '1', transform: 'scale(1)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};

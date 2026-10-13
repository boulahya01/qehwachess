/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          950: 'rgb(var(--tw-surface-950) / <alpha-value>)',
          900: 'rgb(var(--tw-surface-900) / <alpha-value>)',
          800: 'rgb(var(--tw-surface-800) / <alpha-value>)',
          700: 'rgb(var(--tw-surface-700) / <alpha-value>)',
          600: 'rgb(var(--tw-surface-600) / <alpha-value>)',
        },
        brand: {
          50: 'rgb(var(--tw-brand-50) / <alpha-value>)',
          100: 'rgb(var(--tw-brand-100) / <alpha-value>)',
          200: 'rgb(var(--tw-brand-200) / <alpha-value>)',
          300: 'rgb(var(--tw-brand-300) / <alpha-value>)',
          400: 'rgb(var(--tw-brand-400) / <alpha-value>)',
          500: 'rgb(var(--tw-brand-500) / <alpha-value>)',
          600: 'rgb(var(--tw-brand-600) / <alpha-value>)',
          700: 'rgb(var(--tw-brand-700) / <alpha-value>)',
          800: 'rgb(var(--tw-brand-800) / <alpha-value>)',
          900: 'rgb(var(--tw-brand-900) / <alpha-value>)',
        },
        accent: {
          50: 'rgb(var(--tw-accent-50) / <alpha-value>)',
          100: 'rgb(var(--tw-accent-100) / <alpha-value>)',
          200: 'rgb(var(--tw-accent-200) / <alpha-value>)',
          300: 'rgb(var(--tw-accent-300) / <alpha-value>)',
          400: 'rgb(var(--tw-accent-400) / <alpha-value>)',
          500: 'rgb(var(--tw-accent-500) / <alpha-value>)',
          600: 'rgb(var(--tw-accent-600) / <alpha-value>)',
          700: 'rgb(var(--tw-accent-700) / <alpha-value>)',
        },
        success: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Outfit Variable', 'system-ui', 'sans-serif'],
        display: ['Outfit Variable', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
};

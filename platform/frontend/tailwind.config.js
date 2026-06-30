/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // CareOS brand palette
        ink: '#111111',
        bone: '#f7f3eb',
        lime: {
          DEFAULT: '#c4ff4d',
          muted: '#d6ffaa',
          dark: '#9acc3a',
        },
        coral: {
          DEFAULT: '#ff6b5b',
          muted: '#ffb3ab',
          dark: '#e04c3b',
        },
        sky: {
          DEFAULT: '#4d80ff',
          muted: '#a0bcff',
          dark: '#2d5fd4',
        },
        sunny: {
          DEFAULT: '#ffd23f',
          muted: '#ffe99a',
        },
        // Patient therapeutic palette
        sage: {
          50: '#f6f7f4',
          100: '#e8ebe3',
          200: '#d4daca',
          300: '#b5c0a7',
          400: '#95a584',
          500: '#788c67',
          600: '#5e7050',
          700: '#4a5940',
          800: '#3d4936',
          900: '#343e2f',
        },
        warm: {
          50: '#faf8f5',
          100: '#f3efe8',
          200: '#e8e0d4',
          300: '#d6c9b6',
          400: '#c2ac93',
          500: '#b29578',
          600: '#a5836a',
          700: '#8a6c59',
          800: '#71594c',
          900: '#5d4a40',
        },
        teal: {
          50: '#f0fafa',
          100: '#d4f1f1',
          200: '#a9e3e3',
          300: '#76cece',
          400: '#4ab4b4',
          500: '#319999',
          600: '#267a7d',
          700: '#236266',
          800: '#224f53',
          900: '#214346',
        },
        // Staff enterprise palette (ink-based)
        navy: {
          50: '#f2f2f2',
          100: '#e0e0e0',
          200: '#c2c2c2',
          300: '#a3a3a3',
          400: '#858585',
          500: '#666666',
          600: '#4d4d4d',
          700: '#333333',
          800: '#1f1f1f',
          900: '#151515',
          950: '#111111',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 10px 40px -15px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.02)',
        'glow': '0 0 20px rgba(196, 255, 77, 0.20)',
        'glow-lime': '0 0 20px rgba(196, 255, 77, 0.25)',
        'glow-teal': '0 0 20px rgba(49, 153, 153, 0.12)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}

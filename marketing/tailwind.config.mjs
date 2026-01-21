/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // IntelliFill Brand Colors - matching the app
        primary: {
          DEFAULT: '#02C39A', // Brand Teal
          50: '#E6FBF5',
          100: '#CCF7EB',
          200: '#99EFD7',
          300: '#66E7C3',
          400: '#33DFAF',
          500: '#02C39A',
          600: '#029C7B',
          700: '#01755C',
          800: '#014E3D',
          900: '#00271F',
        },
        // Dark theme surface colors
        surface: {
          900: '#0f172a', // slate-900
          800: '#1e293b', // slate-800
          700: '#334155', // slate-700
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
      },
    },
  },
  plugins: [],
};

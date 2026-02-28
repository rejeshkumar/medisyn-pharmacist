import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00475a',
          50: '#e6f2f5',
          100: '#b3d9e2',
          200: '#80c0cf',
          300: '#4da7bc',
          400: '#268ea8',
          500: '#00758f',
          600: '#00475a',
          700: '#003a4a',
          800: '#002d3a',
          900: '#001f28',
        },
      },
    },
  },
  plugins: [],
};

export default config;

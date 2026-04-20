import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#f31948',
          pink: '#af005f',
          orange: '#fc6f43',
          dark: '#0a0010',
        },
      },
      fontFamily: {
        score: ['"Barlow Condensed"', 'sans-serif'],
        sans: ['Barlow', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

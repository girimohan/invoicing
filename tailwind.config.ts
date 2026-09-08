import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Bundled system stack — no webfont fetch, so the packaged Electron app
        // renders identically offline and on first launch.
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'Inter', 'system-ui', '-apple-system', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"Cascadia Mono"', '"SF Mono"', 'Consolas', '"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: '#f5f6f8',
        ink: {
          DEFAULT: '#0f172a',
          soft: '#475569',
          muted: '#94a3b8',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'card-hover': '0 2px 4px -1px rgb(15 23 42 / 0.06), 0 8px 16px -4px rgb(15 23 42 / 0.10)',
        rail: 'inset -1px 0 0 0 rgb(15 23 42 / 0.06)',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
}

export default config

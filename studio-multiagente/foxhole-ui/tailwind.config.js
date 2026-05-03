/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        foxhole: {
          bg: '#0e1014',
          surface: '#1a1d23',
          'surface-2': '#22262d',
          border: '#2a2e36',
          'border-strong': '#3a3e46',
          fg: '#e6e8eb',
          muted: '#8b9099',
          subtle: '#5a6068',
          accent: '#a3c46a',
          'accent-bright': '#bdd685',
          warning: '#d4a847',
          danger: '#cc4848',
          info: '#5b87b3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Berkeley Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'foxhole-glow': '0 0 0 1px rgba(163, 196, 106, 0.18)',
        'foxhole-card': '0 1px 0 0 rgba(255, 255, 255, 0.03), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      },
    },
  },
  plugins: [],
};

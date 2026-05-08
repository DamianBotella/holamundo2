/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        foxhole: {
          // Estructura
          bg: '#1e1a16',
          'bg-deep': '#14110e',
          surface: '#2a2218',
          'surface-2': '#3f3227',
          border: '#3a3028',
          'border-strong': '#5b4a38',
          // Texto
          fg: '#e8e0cc',
          muted: '#b49b6e',
          subtle: '#a89880',
          // Acentos militares
          accent: '#84bc9c',
          'accent-bright': '#a3d4b8',
          olive: '#556b2f',
          tan: '#b49b6e',
          bone: '#e8e0cc',
          'bone-dim': '#a89880',
          // Estados
          'state-idle':    '#7a8a70',
          'state-working': '#84bc9c',
          'state-waiting': '#e0a85c',
          'state-failed':  '#8b2e1f',
          // Alertas
          warning: '#c68866',
          danger: '#a04030',
          info: '#4a6b8a',
          success: '#4a7a50',
        },
      },
      fontFamily: {
        // Display: titulos militares condensados
        display: ['Oswald', 'Anton', 'Bebas Neue', 'sans-serif'],
        // Sans: texto general
        sans: ['Inter', 'Roboto Condensed', 'system-ui', 'sans-serif'],
        // Mono: datos tecnicos, codigos, coordenadas
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Berkeley Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'foxhole-glow': '0 0 0 1px rgba(163, 196, 106, 0.18)',
        'foxhole-card': '0 1px 0 0 rgba(255, 255, 255, 0.03), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      },
    },
  },
  plugins: [],
};

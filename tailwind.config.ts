import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0E0E11',
        'bg-2': '#131318',
        surface: '#16161B',
        'surface-2': '#1A1A20',
        'surface-3': '#20202A',
        border: '#25252D',
        'border-strong': '#34343F',
        hairline: '#1F1F26',
        text: '#ECECEE',
        'text-soft': '#C2C2C8',
        'text-muted': '#888892',
        'text-dim': '#5C5C66',
        chatgpt: '#10A37F',
        claude: '#D97757',
        gemini: '#4285F4',
        grok: '#E7E7E7',
        ok: '#3FB950',
        warn: '#E3B341',
        err: '#F85149',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
    },
  },
  plugins: [],
} satisfies Config

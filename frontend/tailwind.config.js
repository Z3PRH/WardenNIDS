/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom neon green from screenshot
        'neon-green': {
          DEFAULT: '#00ff88',
          50: '#e6fff5',
          100: '#b3ffe0',
          200: '#80ffcc',
          300: '#4dffb8',
          400: '#1affa4',
          500: '#00ff88',
          600: '#00cc6d',
          700: '#009952',
          800: '#006637',
          900: '#00331c',
        },
        
        // Shadcn/ui compatible colors
        border: '#1e293b', // slate-800
        input: '#1e293b',
        ring: '#00ff88',
        background: '#000000',
        foreground: '#f1f5f9',
        
        primary: {
          DEFAULT: '#00ff88',
          foreground: '#000000',
        },
        secondary: {
          DEFAULT: '#1e293b',
          foreground: '#f1f5f9',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#f1f5f9',
        },
        muted: {
          DEFAULT: '#1e293b',
          foreground: '#94a3b8',
        },
        accent: {
          DEFAULT: '#1e293b',
          foreground: '#f1f5f9',
        },
        popover: {
          DEFAULT: '#000000',
          foreground: '#f1f5f9',
        },
        card: {
          DEFAULT: '#000000',
          foreground: '#f1f5f9',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
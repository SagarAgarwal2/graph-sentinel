/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['sohne-var', 'Inter', 'SF Pro Display', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['SourceCodePro', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Stripe-inspired palette
        primary: '#533afd', // Stripe Purple
        'primary-hover': '#4434d4',
        navy: '#061b31', // Deep Navy
        'brand-dark': '#1c1e54',
        'dark-navy': '#0d253d',
        ruby: '#ea2261',
        magenta: '#f96bee',
        'magenta-light': '#ffd7ef',
        border: '#e5edf5',
        'border-soft-purple': '#d6d9fc',
        bg: '#ffffff',
        card: '#ffffff',
        elevated: '#ffffff',
        text: '#061b31',
        label: '#273951',
        body: '#64748d',
        success: '#15be53',
        warning: '#F59E0B',
        danger: '#EF4444',
        subtext: '#9CA3AF',
        muted: '#6B7280',
        'success-text': '#108c3d',
        lemon: '#9b6829',
      },
      boxShadow: {
        card: '0px 4px 12px rgba(0,0,0,0.3)',
        'card-hover': '0px 8px 24px rgba(0,0,0,0.45)',
        panel: '0 24px 48px rgba(0,0,0,0.6)',
        'blue-glow': '0 0 16px rgba(43,109,239,0.25)',
      },
      animation: {
        'fade-in':    'fadeIn 0.18s ease-out',
        'slide-up':   'slideUp 0.18s ease-out',
        'ping-slow':  'pingSlow 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pingSlow: { '0%,100%': { transform: 'scale(1)', opacity: '0.8' }, '50%': { transform: 'scale(1.6)', opacity: '0' } },
      },
    },
  },
  plugins: [],
};

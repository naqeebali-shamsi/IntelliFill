/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Core UI colors - OKLCH variables (no HSL wrapper needed)
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },

        // Status colors from index.css
        "status-pending": {
          DEFAULT: "var(--status-pending)",
          foreground: "var(--status-pending-foreground)",
        },
        "status-success": {
          DEFAULT: "var(--status-success)",
          foreground: "var(--status-success-foreground)",
        },
        "status-warning": {
          DEFAULT: "var(--status-warning)",
          foreground: "var(--status-warning-foreground)",
        },
        "status-error": {
          DEFAULT: "var(--status-error)",
          foreground: "var(--status-error-foreground)",
        },

        // Semantic feedback colors from theme.css
        success: {
          DEFAULT: "var(--feedback-success)",
          foreground: "var(--feedback-success-text)",
          light: "var(--feedback-success-light)",
          dark: "var(--feedback-success-dark)",
          border: "var(--feedback-success-border)",
        },
        warning: {
          DEFAULT: "var(--feedback-warning)",
          foreground: "var(--feedback-warning-text)",
          light: "var(--feedback-warning-light)",
          dark: "var(--feedback-warning-dark)",
          border: "var(--feedback-warning-border)",
        },
        error: {
          DEFAULT: "var(--feedback-error)",
          foreground: "var(--feedback-error-text)",
          light: "var(--feedback-error-light)",
          dark: "var(--feedback-error-dark)",
          border: "var(--feedback-error-border)",
        },
        info: {
          DEFAULT: "var(--feedback-info)",
          foreground: "var(--feedback-info-text)",
          light: "var(--feedback-info-light)",
          dark: "var(--feedback-info-dark)",
          border: "var(--feedback-info-border)",
        },

        // Surface hierarchy tokens from theme.css
        surface: {
          1: "var(--surface-1)",
          "1-hover": "var(--surface-1-hover)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          muted: "var(--surface-muted)",
          "muted-hover": "var(--surface-muted-hover)",
          accent: "var(--surface-accent)",
          "accent-hover": "var(--surface-accent-hover)",
          background: "var(--surface-background)",
        },

        // Text hierarchy tokens from theme.css
        text: {
          heading: "var(--text-heading)",
          body: "var(--text-body)",
          muted: "var(--text-muted)",
          placeholder: "var(--text-placeholder)",
          link: "var(--text-link)",
          "link-hover": "var(--text-link-hover)",
          inverted: "var(--text-inverted)",
          "inverted-muted": "var(--text-inverted-muted)",
        },

        // Border tokens from theme.css
        "border-custom": {
          DEFAULT: "var(--border-default)",
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
          focus: "var(--border-focus)",
          "focus-ring": "var(--border-focus-ring)",
          divider: "var(--border-divider)",
          input: "var(--border-input)",
          "input-hover": "var(--border-input-hover)",
          "input-focus": "var(--border-input-focus)",
        },

        // Brand colors from theme.css
        brand: {
          primary: "var(--color-brand-primary)",
          "primary-hover": "var(--color-brand-primary-hover)",
          "primary-active": "var(--color-brand-primary-active)",
          "primary-muted": "var(--color-brand-primary-muted)",
          black: "var(--color-brand-black)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "progress-indeterminate": "progress-indeterminate 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
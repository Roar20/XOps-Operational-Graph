import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f14",
          900: "#111826",
          800: "#1a2332",
          700: "#26334a",
          600: "#3b4a63",
          500: "#5b6b85",
          400: "#8494ac",
          300: "#adb9cb",
          200: "#d3dae4",
          100: "#e9edf3",
          50: "#f6f8fb",
        },
        gate: { ok: "#1f8a5b", no: "#9aa4b4" },
        sev: { c1: "#b42318", c2: "#b54708", c3: "#175cd3", cx: "#667085" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;

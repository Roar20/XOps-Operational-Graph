import type { Config } from "tailwindcss";

/** Paleta PepsiCo. Azul #02355A dominante, #155798 y #3680CE de apoyo,
 *  fondo #F5F4F0. Sobria y de alta densidad: esto se proyecta en sala. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pep: {
          900: "#02355A", // dominante
          700: "#155798", // apoyo
          500: "#3680CE", // apoyo claro
          100: "#DCE8F5",
          50: "#EEF4FB",
        },
        canvas: "#F5F4F0",
        ink: {
          900: "#12202E",
          700: "#33475B",
          500: "#5B7085",
          400: "#8496A8",
          300: "#B3C0CC",
          200: "#D8DFE6",
          100: "#EAEEF2",
        },
        // Evidencia: E1 alta, E2 media, E3 baja autoridad.
        ev: { e1: "#1F7A5A", e2: "#B26A00", e3: "#A03535" },
        good: "#1F7A5A",
        bad: "#A03535",
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

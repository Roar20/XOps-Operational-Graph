import type { Config } from "tailwindcss";

/** Paleta PepsiCo, familia azul. Anclas de marca: #02355A dominante, #155798 y
 *  #3680CE de apoyo, fondo #F5F4F0. El resto de la rampa esta interpolado sobre
 *  esas anclas, asi que no entra ningun azul que no derive del estandar.
 *  Sobria y de alta densidad: esto se proyecta en sala.
 *
 *  Regla de texto, medida contra blanco: pep-600 y mas oscuro pasan AA. pep-500
 *  y mas claros van solo como relleno, borde o fondo, nunca como texto corrido.
 *
 *  Los mismos hex viven en lib/palette.ts para el codigo que pinta SVG, y en
 *  :root de app/globals.css para lo que quede fuera de Tailwind. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pep: {
          950: "#01223A",
          900: "#02355A", // dominante
          800: "#0C487C",
          700: "#155798", // apoyo
          600: "#276EB6", // ultimo tono seguro para texto normal sobre blanco
          500: "#3680CE", // apoyo claro
          400: "#72A6DD",
          300: "#9FC2E7",
          200: "#CBDEF2",
          100: "#E5EEF9",
          50: "#F4F8FC",
        },
        canvas: "#F5F4F0",
        // Neutros con azul dentro, no grises neutros. Los pasos 800, 600 y 50
        // son interpolados: la interfaz ya los usaba y sin definirlos aqui
        // Tailwind no generaba la clase, de modo que el color no se aplicaba.
        ink: {
          900: "#12202E",
          800: "#223444",
          700: "#33475B",
          600: "#475C70",
          500: "#5B7085",
          400: "#8496A8",
          300: "#B3C0CC",
          200: "#D8DFE6",
          100: "#EAEEF2",
          50: "#F5F6F9",
        },
        // Acentos frios, para cuando una grafica pasa de tres series.
        acc: {
          teal: "#0F6E6E",
          "teal-soft": "#2A9D9D",
          cyan: "#1B93C7",
          indigo: "#3B4E9B",
          slate: "#4A6FA5",
        },
        // Evidencia: E1 alta, E2 media, E3 baja autoridad.
        ev: { e1: "#1F7A5A", e2: "#B26A00", e3: "#A03535" },
        good: "#1F7A5A",
        warn: "#B26A00",
        bad: "#A03535",
        neutral: "#5B7085",
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

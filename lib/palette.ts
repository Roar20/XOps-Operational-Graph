/**
 * Paleta PepsiCo, familia azul. Fuente unica de verdad para todo lo que se
 * pinta desde JavaScript: recharts y el SVG plano del grafo.
 *
 * Por que existe este archivo y no se usan las variables CSS de globals.css:
 * los atributos de presentacion de SVG (fill, stroke) NO resuelven var(), que
 * solo funciona en propiedades CSS. Recharts escribe fill y stroke como
 * atributos, asi que un var() ahi se renderiza en negro. Las variables CSS de
 * globals.css quedan para hojas de estilo, draw.io y exportables; estas
 * constantes quedan para el codigo. Los dos juegos salen de los mismos hex.
 *
 * Procedencia: las anclas #02355A (dominante), #155798 y #3680CE (apoyo) y el
 * fondo #F5F4F0 vienen del estandar de marca. El resto de la rampa, los
 * acentos y los tonos de estado son derivados, no oficiales.
 */

export const PEP = {
  950: "#01223A",
  900: "#02355A", // ancla dominante
  800: "#0C487C",
  700: "#155798", // ancla de apoyo
  600: "#276EB6", // ultimo tono seguro para texto normal sobre blanco
  500: "#3680CE", // ancla de apoyo claro
  400: "#72A6DD",
  300: "#9FC2E7",
  200: "#CBDEF2",
  100: "#E5EEF9",
  50: "#F4F8FC",
} as const;

export const CANVAS = "#F5F4F0";
export const WHITE = "#FFFFFF";

/* Neutros con azul dentro, no grises neutros: conviven con la rampa pep sin
   verse sucios. Los pasos 800, 600 y 50 estan interpolados sobre los anclas
   vecinos de la especificacion, que solo publica 900/700/500/400/300/200/100.
   Se agregan porque la interfaz ya los usaba: sin definirlos, Tailwind no
   genera la clase y el color simplemente no se aplica. */
export const INK = {
  900: "#12202E",
  800: "#223444", // derivado: punto medio 900-700
  700: "#33475B",
  600: "#475C70", // derivado: punto medio 700-500
  500: "#5B7085",
  400: "#8496A8",
  300: "#B3C0CC",
  200: "#D8DFE6",
  100: "#EAEEF2",
  50: "#F5F6F9", // derivado: 100 a medio camino del blanco
} as const;

/* Acentos frios, para cuando una grafica necesita mas de tres series. */
export const ACC = {
  teal: "#0F6E6E",
  tealSoft: "#2A9D9D",
  cyan: "#1B93C7",
  indigo: "#3B4E9B",
  slate: "#4A6FA5",
} as const;

/* Estado y evidencia. E1 alta, E2 media, E3 baja autoridad. */
export const STATUS = {
  good: "#1F7A5A",
  warn: "#B26A00",
  bad: "#A03535",
  neutral: "#5B7085",
} as const;

/**
 * Orden de asignacion para series categoricas. Fijo: la serie 4 siempre es
 * acc-teal, tenga la grafica cuatro series o seis. Nunca se cicla ni se
 * reasigna por rango, porque un filtro que cambia el numero de series no debe
 * repintar a las que sobreviven.
 *
 * El orden difiere del que trae la especificacion de paleta
 * (pep-900 - acc-teal - pep-500 - acc-indigo - pep-300 - acc-cyan) porque ese
 * deja acc-indigo #3B4E9B adyacente a pep-500 #3680CE, y ese par separa
 * dE 14.8 a vision normal, debajo del piso duro de 15: son dos azules que
 * cuesta distinguir incluso con vision de color completa. Este orden mantiene
 * las mismas seis tintas y sube el peor par adyacente a dE 15.9 normal y 14.7
 * con deficiencia de color. Ademas respeta lo que la propia especificacion
 * dice de los acentos: entran cuando la grafica pasa de tres series, asi que
 * las tres primeras son la rampa de marca.
 */
export const SERIES = [
  PEP[900],
  PEP[500],
  PEP[300],
  ACC.teal,
  ACC.cyan,
  ACC.indigo,
] as const;

/* Rampa monocroma para volumen. El extremo claro respeta el piso de contraste
   2:1 contra blanco del skill dataviz: pep-400 mide 2.56:1. pep-300 mide
   1.85:1 y por eso NO sirve como relleno de barra sobre blanco. */
export const RAMP = {
  strong: PEP[900],
  mid: PEP[700],
  rail: PEP[400],
  reference: INK[400],
} as const;

/** Luminancia relativa WCAG 2.1 de un hex de seis digitos. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razon de contraste WCAG entre dos hex. Devuelve el numero, no un veredicto:
 *  quien llama decide contra que piso lo compara. */
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Par de colores de texto legible encima de un relleno dado.
 *
 * Existe porque fijar el texto a blanco no funciona sobre esta rampa: la
 * familia pep va de #01223A a #F4F8FC, y blanco sobre pep-400 mide 2.56:1,
 * muy debajo del piso AA de 4.5. En vez de elegir a mano por cada relleno, se
 * mide. `text` es el rotulo principal, `meta` el secundario, un paso mas suave
 * pero todavia por encima de 4.5:1 contra el mismo relleno.
 */
export function onFill(bg: string): { text: string; meta: string } {
  return contrast(WHITE, bg) >= contrast(INK[900], bg)
    ? { text: WHITE, meta: PEP[200] }
    : { text: INK[900], meta: PEP[950] };
}

/* Cromo de grafica: rejilla, ejes y rotulos. Recesivo por definicion. */
export const CHART = {
  grid: INK[100],
  axis: INK[200],
  tick: INK[500],
  tickMuted: INK[400],
  tickStrong: INK[700],
  tooltipBorder: INK[200],
} as const;

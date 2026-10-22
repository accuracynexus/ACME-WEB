// Marcas del recuadro de Yape directo: cabecera, marca de agua y pie con el
// sello de Accuracy Nexus. Todo en SVG, en grises translucidos, para que se vea
// igual en cualquier pantalla y no dependa de fuentes ni imagenes externas.

const TINTA = "#374151";
const GRIS = "#6b7280";
const LINEA = "#9ca3af";

/** Roseta tipo guilloche (como en billetes): curvas r = R + a*sin(k*t) giradas. */
function roseta(
  cx: number,
  cy: number,
  radio: number,
  amplitud: number,
  lobulos: number,
  vueltas: number,
): string {
  const trazos: string[] = [];
  for (let v = 0; v < vueltas; v += 1) {
    const giro = (v / vueltas) * ((2 * Math.PI) / lobulos);
    let d = "";
    for (let i = 0; i <= 240; i += 1) {
      const t = (i / 240) * 2 * Math.PI;
      const r = radio + amplitud * Math.sin(lobulos * t);
      const x = cx + r * Math.cos(t + giro);
      const y = cy + r * Math.sin(t + giro);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    trazos.push(`${d}Z`);
  }
  return trazos.join(" ");
}

const ROSETA_EMBLEMA = roseta(32, 32, 22, 4, 12, 6);
const ROSETA_FONDO = roseta(160, 160, 112, 14, 18, 10);

const ESCUDO = "M32 3 L56 12 V31 C56 46 45 56 32 61 C19 56 8 46 8 31 V12 Z";
const LETRA_A =
  "M19 44 L27.5 19 H31.5 L40 44 H35.6 L33.6 37.6 H25.4 L23.4 44 Z M26.6 33.8 H32.4 L29.5 24.6 Z";
const LETRA_N = "M36 44 V19 H39.6 L46 35 V19 H49.4 V44 H46 L39.4 28 V44 Z";

// Escudo con monograma AN, en linea gris.
function Emblema() {
  return (
    <>
      <path
        d={ESCUDO}
        fill="#ffffff"
        fillOpacity="0.55"
        stroke={GRIS}
        strokeWidth="1.6"
      />
      <path
        d={ROSETA_EMBLEMA}
        fill="none"
        stroke={LINEA}
        strokeOpacity="0.45"
        strokeWidth="0.4"
      />
      <path d={LETRA_A} fill={TINTA} />
      <path d={LETRA_N} fill={GRIS} />
    </>
  );
}

// Marca de Yape en gris, solo contorno.
function MarcaYape() {
  return (
    <>
      <rect
        x="0.75"
        y="0.75"
        width="66"
        height="32"
        rx="9"
        fill="none"
        stroke={GRIS}
        strokeWidth="1.2"
      />
      <text
        x="33.5"
        y="22.5"
        textAnchor="middle"
        fontFamily="'Arial Rounded MT Bold', 'Nunito', 'Segoe UI', Arial, sans-serif"
        fontWeight="800"
        fontSize="17"
        fill={GRIS}
      >
        yape
      </text>
    </>
  );
}

/** Linea superior, integrada como en otras billeteras: Yape a la izquierda y el sello a la derecha. */
export function CabeceraVerificacion() {
  return (
    <svg
      className="yape-propio__cabecera"
      viewBox="0 0 360 34"
      role="img"
      aria-label="Pago con Yape verificado por Accuracy Nexus"
    >
      <g transform="translate(0 0.5)">
        <MarcaYape />
      </g>
      <text
        x="326"
        y="15"
        textAnchor="end"
        fontFamily="'Segoe UI', Arial, sans-serif"
        fontSize="7.4"
        letterSpacing="1.4"
        fill={LINEA}
      >
        VERIFICADO POR
      </text>
      <text
        x="326"
        y="27"
        textAnchor="end"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="10.5"
        fontWeight="700"
        letterSpacing="1.6"
        fill={GRIS}
      >
        ACCURACY NEXUS
      </text>
      <g transform="translate(332 2) scale(0.45)">
        <Emblema />
      </g>
    </svg>
  );
}

/** Fondo de seguridad: roseta guilloche y escudo apenas visibles. */
export function MarcaDeAgua() {
  return (
    <svg
      className="yape-propio__marca-agua"
      viewBox="0 0 320 320"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={ROSETA_FONDO}
        fill="none"
        stroke={LINEA}
        strokeOpacity="0.16"
        strokeWidth="0.6"
      />
      <g transform="translate(96 92) scale(2)" opacity="0.06">
        <path d={ESCUDO} fill={TINTA} />
      </g>
    </svg>
  );
}

/** Pie discreto, como el "Powered by" de otras pasarelas. */
export function PieVerificacion({
  anio = new Date().getFullYear(),
}: {
  anio?: number;
}) {
  return (
    <svg
      className="yape-propio__pie"
      viewBox="0 0 220 18"
      role="img"
      aria-label={`Powered by Accuracy Nexus ${anio}`}
    >
      <text
        x="62"
        y="12.5"
        textAnchor="end"
        fontFamily="'Segoe UI', Arial, sans-serif"
        fontSize="7"
        letterSpacing="0.8"
        fill={LINEA}
      >
        Powered by
      </text>
      <g transform="translate(66 1) scale(0.25)">
        <Emblema />
      </g>
      <text
        x="84"
        y="12.5"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="8"
        fontWeight="700"
        letterSpacing="1"
        fill={GRIS}
      >
        ACCURACY NEXUS {anio}
      </text>
    </svg>
  );
}

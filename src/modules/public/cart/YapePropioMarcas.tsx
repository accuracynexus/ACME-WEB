import { useId } from "react";

// Marcas del recuadro de Yape directo: cabecera, marca de agua y pie con el
// sello de Acuraci Nexus. Todo en SVG para que se vea igual en cualquier
// pantalla y no dependa de fuentes ni imagenes externas.

const AZUL = "#0b1f3a";
const AZUL_MEDIO = "#163a66";
const ORO = "#c9a24a";
const YAPE = "#742284";

function idSeguro(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

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

/** Ondas paralelas para el fondo de la cabecera y el pie. */
function ondas(
  ancho: number,
  alto: number,
  lineas: number,
  amplitud: number,
  periodo: number,
): string {
  const trazos: string[] = [];
  for (let l = 0; l < lineas; l += 1) {
    const base = ((l + 0.5) / lineas) * alto;
    const fase = l * 0.55;
    let d = "";
    for (let x = 0; x <= ancho; x += 4) {
      const y = base + amplitud * Math.sin((x / periodo) * 2 * Math.PI + fase);
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(2)}`;
    }
    trazos.push(d);
  }
  return trazos.join(" ");
}

const ROSETA_EMBLEMA = roseta(32, 32, 22, 4, 12, 6);
const ROSETA_FONDO = roseta(160, 160, 112, 14, 18, 10);
const ONDAS_CABECERA = ondas(360, 72, 9, 3.2, 90);
const ONDAS_PIE = ondas(360, 40, 5, 2, 70);

/** Cabecera del recuadro de pago. */
export function CabeceraVerificacion() {
  const id = idSeguro(useId());
  return (
    <svg
      className="yape-propio__cabecera"
      viewBox="0 0 360 72"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Pago con Yape verificado por Acuraci Nexus"
    >
      <defs>
        <linearGradient id={`${id}-fondo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={AZUL} />
          <stop offset="1" stopColor={AZUL_MEDIO} />
        </linearGradient>
        <linearGradient id={`${id}-oro`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6a22" />
          <stop offset="0.5" stopColor="#e9d18f" />
          <stop offset="1" stopColor="#8a6a22" />
        </linearGradient>
      </defs>
      <rect width="360" height="72" fill={`url(#${id}-fondo)`} />
      <path
        d={ONDAS_CABECERA}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.07"
        strokeWidth="0.6"
      />
      <rect y="69" width="360" height="3" fill={`url(#${id}-oro)`} />
      <g transform="translate(12 8) scale(0.84)">
        <AcuraciNexusEmblemaGrupo id={id} />
      </g>
      <text
        x="74"
        y="31"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="16"
        fontWeight="700"
        letterSpacing="2.6"
        fill="#f4ead0"
      >
        ACURACI NEXUS
      </text>
      <text
        x="74"
        y="47"
        fontFamily="'Segoe UI', Arial, sans-serif"
        fontSize="8.2"
        letterSpacing="2.2"
        fill={ORO}
      >
        VERIFICACIÓN DE PAGOS
      </text>
      <line
        x1="74"
        y1="54"
        x2="216"
        y2="54"
        stroke={ORO}
        strokeOpacity="0.45"
        strokeWidth="0.6"
      />
      <g transform="translate(274 16)">
        <rect
          x="0.5"
          y="0.5"
          width="75"
          height="39"
          rx="10"
          fill={YAPE}
          stroke="#ffffff"
          strokeOpacity="0.35"
        />
        <text
          x="38"
          y="27"
          textAnchor="middle"
          fontFamily="'Arial Rounded MT Bold', 'Nunito', 'Segoe UI', Arial, sans-serif"
          fontWeight="800"
          fontSize="21"
          fill="#ffffff"
        >
          yape
        </text>
      </g>
    </svg>
  );
}

// El emblema dentro de otro SVG (sin el <svg> propio).
function AcuraciNexusEmblemaGrupo({ id }: { id: string }) {
  return (
    <>
      <path
        d="M32 3 L56 12 V31 C56 46 45 56 32 61 C19 56 8 46 8 31 V12 Z"
        fill={AZUL}
        stroke={`url(#${id}-oro)`}
        strokeWidth="2.2"
      />
      <path
        d={ROSETA_EMBLEMA}
        fill="none"
        stroke={ORO}
        strokeOpacity="0.28"
        strokeWidth="0.45"
      />
      <path
        d="M19 44 L27.5 19 H31.5 L40 44 H35.6 L33.6 37.6 H25.4 L23.4 44 Z M26.6 33.8 H32.4 L29.5 24.6 Z"
        fill={ORO}
      />
      <path
        d="M36 44 V19 H39.6 L46 35 V19 H49.4 V44 H46 L39.4 28 V44 Z"
        fill="#f4ead0"
        opacity="0.92"
      />
    </>
  );
}

/** Fondo de seguridad: roseta guilloche, escudo y Yape apenas visibles. */
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
        stroke={AZUL_MEDIO}
        strokeOpacity="0.07"
        strokeWidth="0.6"
      />
      <g transform="translate(96 92) scale(2)" opacity="0.045">
        <path
          d="M32 3 L56 12 V31 C56 46 45 56 32 61 C19 56 8 46 8 31 V12 Z"
          fill={AZUL}
        />
      </g>
      <text
        x="160"
        y="292"
        textAnchor="middle"
        fontFamily="'Arial Rounded MT Bold', 'Nunito', Arial, sans-serif"
        fontWeight="800"
        fontSize="44"
        fill={YAPE}
        opacity="0.05"
      >
        yape
      </text>
    </svg>
  );
}

/** Pie del recuadro: microimpresion, sello y "Powered by". */
export function PieVerificacion({
  anio = new Date().getFullYear(),
}: {
  anio?: number;
}) {
  const id = idSeguro(useId());
  const micro = "ACURACI NEXUS · PAGO VERIFICADO · ".repeat(8);
  return (
    <svg
      className="yape-propio__pie"
      viewBox="0 0 360 52"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Powered by Acuraci Nexus ${anio}`}
    >
      <defs>
        <linearGradient id={`${id}-oro`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6a22" />
          <stop offset="0.5" stopColor="#e9d18f" />
          <stop offset="1" stopColor="#8a6a22" />
        </linearGradient>
      </defs>
      <rect width="360" height="52" fill={AZUL} />
      <path
        d={ONDAS_PIE}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.06"
        strokeWidth="0.5"
        transform="translate(0 6)"
      />
      <rect width="360" height="2" fill={`url(#${id}-oro)`} />
      <text
        x="0"
        y="9"
        fontFamily="'Segoe UI', Arial, sans-serif"
        fontSize="3.4"
        letterSpacing="0.6"
        fill={ORO}
        opacity="0.55"
      >
        {micro}
      </text>
      <g transform="translate(98 15) scale(0.4)">
        <AcuraciNexusEmblemaGrupo id={id} />
      </g>
      <text
        x="128"
        y="27"
        fontFamily="'Segoe UI', Arial, sans-serif"
        fontSize="6.4"
        letterSpacing="1.8"
        fill="#9fb3cf"
      >
        POWERED BY
      </text>
      <text
        x="128"
        y="39"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="10"
        fontWeight="700"
        letterSpacing="1.8"
        fill="#f4ead0"
      >
        ACURACI NEXUS{' '}
        <tspan fill={ORO}>{anio}</tspan>
      </text>
    </svg>
  );
}

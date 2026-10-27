import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GRUPOS, soles } from './yapeLabels';

export interface TraficoPunto {
  etiqueta: string;
  conciliado: number;
  diferencia: number;
  aire: number;
  conciliado_centimos: number;
  diferencia_centimos: number;
  aire_centimos: number;
}

const SERIES = ['conciliado', 'diferencia', 'aire'] as const;

/**
 * Yapes que llegaron en cada tramo del periodo, apilados por veredicto.
 * Se importa con React.lazy para mantener recharts fuera del chunk principal.
 */
export default function YapeTrafficChart({ puntos, animar }: { puntos: TraficoPunto[]; animar: boolean }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: -22 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--acme-border)" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={14}
            tick={{ fontSize: 11, fill: 'var(--acme-text-faint)', fontWeight: 700 }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--acme-text-faint)' }} />
          <Tooltip
            cursor={{ fill: 'var(--acme-purple-light)' }}
            contentStyle={{ borderRadius: 12, border: '1px solid var(--acme-border)', boxShadow: 'var(--acme-shadow-md)', fontSize: 12.5 }}
            formatter={(value, name, item) => {
              const serie = String(name) as (typeof SERIES)[number];
              const centimos = Number((item?.payload as TraficoPunto | undefined)?.[`${serie}_centimos`] ?? 0);
              return [`${Number(value ?? 0)} · ${soles(centimos)}`, GRUPOS[serie]?.label ?? String(name)];
            }}
          />
          {SERIES.map((serie, index) => (
            <Bar
              key={serie}
              dataKey={serie}
              stackId="yapes"
              fill={GRUPOS[serie].color}
              radius={index === SERIES.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={animar}
              animationDuration={650}
              animationBegin={index * 90}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

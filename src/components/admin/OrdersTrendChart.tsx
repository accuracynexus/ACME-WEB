import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OrdersTrendPoint } from '../../core/services/adminOverviewService';

/**
 * Gráfico compacto de pedidos de los últimos 7 días.
 * Se importa con React.lazy para mantener recharts fuera del chunk principal.
 */
export default function OrdersTrendChart({ points }: { points: OrdersTrendPoint[] }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="ordersTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4d148c" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#4d148c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--acme-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--acme-text-faint)', fontWeight: 700 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--acme-text-faint)' }}
          />
          <Tooltip
            cursor={{ stroke: 'var(--acme-border-strong)', strokeDasharray: '4 4' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--acme-border)',
              boxShadow: 'var(--acme-shadow-md)',
              fontSize: 12.5,
            }}
            labelFormatter={(label) => `Día: ${label}`}
            formatter={(value) => [`${Number(value ?? 0)} pedidos`, 'Total']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#4d148c"
            strokeWidth={2.5}
            fill="url(#ordersTrendFill)"
            dot={{ r: 3, fill: '#ff6200', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#ff6200', strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

import React from 'react';
import {
  ComposedChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { colors } from '../../../styles/tokens';

export function RequestsTrendChart({ data = [], slaThreshold = 10 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: colors.textSecondary }}>
        No request trend data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
          <XAxis dataKey="day" stroke={colors.textSecondary} fontSize={12} tickLine={false} />
          <YAxis stroke={colors.textSecondary} fontSize={12} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: '8px',
              color: colors.textPrimary,
              fontSize: '0.85rem',
            }}
          />
          <Bar dataKey="count" fill={colors.brand} radius={[4, 4, 0, 0]} name="Requests" />
          {slaThreshold && (
            <ReferenceLine
              y={slaThreshold}
              stroke={colors.red.icon}
              strokeDasharray="4 4"
              label={{
                value: `SLA Threshold (${slaThreshold})`,
                fill: colors.red.icon,
                fontSize: 11,
                position: 'top',
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RequestsTrendChart;

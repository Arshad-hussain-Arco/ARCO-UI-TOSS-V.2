import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { colors } from '../../../styles/tokens';

export function DepartmentBarChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: colors.textSecondary }}>
        No department data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: Math.max(200, data.length * 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
        >
          <XAxis type="number" stroke={colors.textSecondary} fontSize={12} tickLine={false} />
          <YAxis
            type="category"
            dataKey="department"
            stroke={colors.textSecondary}
            fontSize={12}
            tickLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: '8px',
              color: colors.textPrimary,
              fontSize: '0.85rem',
            }}
          />
          <Bar dataKey="count" fill={colors.brand} radius={[0, 4, 4, 0]} name="Staff / Days" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DepartmentBarChart;

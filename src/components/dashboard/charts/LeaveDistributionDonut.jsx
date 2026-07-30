import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { colors } from '../../../styles/tokens';

export function LeaveDistributionDonut({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px', color: colors.textSecondary }}>
        No leave distribution data available
      </div>
    );
  }

  const totalValue = data.reduce((acc, item) => acc + (item.value || 0), 0);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={3}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || colors.brand} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: '8px',
                color: colors.textPrimary,
                fontSize: '0.85rem',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend showing Name + Value + Percentage */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '12px' }}>
        {data.map((item, idx) => {
          const pct = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                color: colors.textPrimary,
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: item.color || colors.brand,
                }}
              />
              <span style={{ fontWeight: 600 }}>{item.name}:</span>
              <span>
                {item.value} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LeaveDistributionDonut;

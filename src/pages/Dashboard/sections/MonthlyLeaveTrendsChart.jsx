import React, { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

// Custom enterprise-styled tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-primary)',
        padding: '8px 12px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--text-primary)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '2px', color: 'var(--text-secondary)' }}>{label}</div>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--c-primary)' }}>{value}</span>
          <span> {value === 1 ? 'Consultant' : 'Consultants'} on Leave</span>
        </div>
      </div>
    );
  }
  return null;
};

function MonthlyLeaveTrendsChartComponent({ trendData }) {
  // Professional monthly trends data
  const data = (trendData && trendData.length > 0) ? trendData : [
    { name: 'Jan', leaveCount: 12 },
    { name: 'Feb', leaveCount: 8 },
    { name: 'Mar', leaveCount: 15 },
    { name: 'Apr', leaveCount: 22 },
    { name: 'May', leaveCount: 18 },
    { name: 'Jun', leaveCount: 25 },
    { name: 'Jul', leaveCount: 30 },
    { name: 'Aug', leaveCount: 28 },
    { name: 'Sep', leaveCount: 14 },
    { name: 'Oct', leaveCount: 16 },
    { name: 'Nov', leaveCount: 20 },
    { name: 'Dec', leaveCount: 35 },
  ];

  return (
    <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px', padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primar', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Monthly Leave Trends
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total leave applications count by month</span>
      </div>

      {/* Chart Wrapper */}
      <div style={{ flex: 1, width: '100%', minHeight: '220px', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="leaveTrendGradRefined" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--c-primary)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--c-primary)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
            <XAxis
              dataKey="name"
              stroke="var(--text-tertiary)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--text-tertiary)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="leaveCount"
              stroke="var(--c-primary)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#leaveTrendGradRefined)"
              name="Leaves"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const MonthlyLeaveTrendsChart = memo(MonthlyLeaveTrendsChartComponent);
export default MonthlyLeaveTrendsChart;

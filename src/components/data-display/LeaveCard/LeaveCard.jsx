import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useEffect, useState } from 'react';
import './LeaveCard.css';
ChartJS.register(ArcElement, Tooltip, Legend);
function LeaveCard({ title, subtitle, icon: Icon, centerCount, left, used, color, isLoading, isUnlimited, variant }) {
  const isSimple = variant === 'simple';
  const [bgColor, setBgColor] = useState('#e5e7eb');
  useEffect(() => {
    const updateBgColor = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setBgColor(isDark ? '#374151' : '#e5e7eb');
    };
    updateBgColor();
    const observer = new MutationObserver(updateBgColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  // An unlimited leave type has no numeric cap to chart — show a plain
  // background ring instead of a used/left split, since "left" is
  // meaningless (there's no total to divide it against).
  const data = {
    datasets: [
      {
        data: isUnlimited ? [0, 1] : [used, left],
        backgroundColor: [color, bgColor],
        borderWidth: 0,
        cutout: '75%',
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };
  const leaveType = title.toLowerCase().replace(/\s+/g, '-');
  
  if (isLoading) {
    return (
      <div className="leave-card" data-leave-type={leaveType}>
        <div className="leave-card-header">
          <div className="leave-card-skeleton-text" style={{ width: '70%', height: '14px' }}></div>
        </div>
        <div className="leave-card-chart-container">
          <div className="leave-card-skeleton-circle"></div>
        </div>
        <div className="leave-card-stats">
          <div className="leave-card-stat">
            <div className="leave-card-skeleton-text" style={{ width: '20px', height: '14px', marginBottom: '4px' }}></div>
            <div className="leave-card-skeleton-text" style={{ width: '30px', height: '10px' }}></div>
          </div>
          <div className="leave-card-stat">
            <div className="leave-card-skeleton-text" style={{ width: '20px', height: '14px', marginBottom: '4px' }}></div>
            <div className="leave-card-skeleton-text" style={{ width: '30px', height: '10px' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-card" data-leave-type={leaveType}>
      <div className="leave-card-header" style={{ flexDirection: 'column', alignItems: 'center', gap: '2px', width: '100%' }}>
        <h3 className="leave-card-title">{title}</h3>
        {subtitle && (
          <span style={{ fontSize: '9px', fontWeight: '500', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {subtitle}
          </span>
        )}
        {Icon && <Icon className="leave-card-icon" style={{ position: 'absolute', right: '8px', top: '8px' }} />}
      </div>

      {isSimple ? (
        <div className="leave-card-chart-container">
          <div className="leave-card-simple-value">{centerCount}</div>
        </div>
      ) : (
        <>
          <div className="leave-card-chart-container">
            <div className="leave-card-chart">
              <Doughnut data={data} options={options} />
              <div className="leave-card-center-value">{isUnlimited ? '∞' : centerCount}</div>
            </div>
          </div>

          {isUnlimited ? (
            // No cap means "Left" has nothing to be relative to — showing
            // it as "Unlimited" next to a numeric Used reads as a mismatched
            // pair, so an unlimited type gets a single centered Used stat
            // instead of the usual two-column Left/Used split.
            <div className="leave-card-stats leave-card-stats-single">
              <div className="leave-card-stat">
                <span className="leave-card-stat-value">{used}</span>
                <span className="leave-card-stat-label">Used</span>
              </div>
            </div>
          ) : (
            <div className="leave-card-stats">
              <div className="leave-card-stat">
                <span className="leave-card-stat-value">{left}</span>
                <span className="leave-card-stat-label">Left</span>
              </div>
              <div className="leave-card-stat">
                <span className="leave-card-stat-value">{used}</span>
                <span className="leave-card-stat-label">Used</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export { LeaveCard };
export default LeaveCard;

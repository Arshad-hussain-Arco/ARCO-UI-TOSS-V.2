import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useEffect, useState } from 'react';
import './TeamKPICard.css';
ChartJS.register(ArcElement, Tooltip, Legend);
function TeamKPICard({ title, count, total, color }) {
  const remaining = total - count;
  const [bgColor, setBgColor] = useState('#f3f4f6');
  useEffect(() => {
    const updateBgColor = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setBgColor(isDark ? '#374151' : '#f3f4f6');
    };
    updateBgColor();
    const observer = new MutationObserver(updateBgColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  const data = {
    datasets: [
      {
        data: [count, remaining],
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
  return (
    <div className="team-kpi-card">
      <div className="team-kpi-chart-container">
        <div className="team-kpi-chart">
          <Doughnut data={data} options={options} />
          <div className="team-kpi-center-value">{count}</div>
        </div>
      </div>

      <div className="team-kpi-footer">
        <span className="team-kpi-label">{title}</span>
      </div>
    </div>
  );
}
export { TeamKPICard };
export default TeamKPICard;

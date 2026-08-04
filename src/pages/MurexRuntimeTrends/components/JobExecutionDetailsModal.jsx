import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

import { AdminModal } from '@components/ui/AdminModal/AdminModal';

import { getRunGanttSpec } from '../utils';
import { PlotlyChart } from './PlotlyChart';

export function JobExecutionDetailsModal({
  selectedCellDetails,
  onClose,
  isGanttLoading,
  expandedRunGanttIds,
  toggleRunGantt,
}) {
  if (!selectedCellDetails) return null;

  return (
    <AdminModal
      isOpen={Boolean(selectedCellDetails)}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Job Execution Details</span>
          <span className="murex-modal-script-badge">{selectedCellDetails.scriptName}</span>
        </div>
      }
      size="lg"
    >
      {isGanttLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px', color: 'var(--text-tertiary)' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-color)' }} />
          <p>Fetching Job Execution Details...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="murex-modal-summary-grid">
            <div className="murex-modal-summary-card">
              <span className="murex-modal-card-label">Week</span>
              <span className="murex-modal-card-val">{selectedCellDetails.week}</span>
            </div>
            <div className="murex-modal-summary-card">
              <span className="murex-modal-card-label">Day</span>
              <span className="murex-modal-card-val">{selectedCellDetails.day}</span>
            </div>
            <div className="murex-modal-summary-card">
              <span className="murex-modal-card-label">Date</span>
              <span className="murex-modal-card-val">{selectedCellDetails.date}</span>
            </div>
            <div className="murex-modal-summary-card">
              <span className="murex-modal-card-label">Avg Duration</span>
              <span className="murex-modal-card-val">{selectedCellDetails.avgDuration}</span>
            </div>
            <div className="murex-modal-summary-card">
              <span className="murex-modal-card-label">Total Runs</span>
              <span className="murex-modal-card-val">{selectedCellDetails.totalRuns}</span>
            </div>
            <div className={`murex-modal-summary-card ${selectedCellDetails.outliersCount > 0 ? 'warning' : ''}`}>
              <span className="murex-modal-card-label">Outliers</span>
              <span className={`murex-modal-card-val ${selectedCellDetails.outliersCount > 0 ? 'warning' : ''}`}>
                {selectedCellDetails.outliersCount > 0 ? `⚠️ ${selectedCellDetails.outliersCount}` : '0'}
              </span>
            </div>
          </div>

          <div className="murex-modal-runs-section">
            <h4 className="murex-modal-runs-title">All Run Durations</h4>
            {selectedCellDetails.runs.map((run) => {
              const isGanttOpen = expandedRunGanttIds.has(run.id);
              const ganttSpec = getRunGanttSpec(run);
              const totalDb = run.steps.reduce((a, b) => a + b.dbTime, 0);
              const totalCpu = run.steps.reduce((a, b) => a + b.cpuTime, 0);

              return (
                <div key={run.id} className={`murex-run-item ${run.isOutlier ? 'outlier' : ''}`}>
                  <div className="murex-run-item-header">
                    <div className="murex-run-info-left">
                      <span className="murex-run-name">{run.name}</span>
                      <span className="murex-run-dur">{run.duration}</span>
                      {run.isOutlier && (
                        <span className="murex-run-badge-outlier">
                          <AlertTriangle size={10} /> Outlier
                        </span>
                      )}
                    </div>

                    <button type="button" className="murex-gantt-toggle-btn" onClick={() => toggleRunGantt(run.id)}>
                      {isGanttOpen ? (
                        <>Hide Gantt <ChevronUp size={12} /></>
                      ) : (
                        <>Show Gantt <ChevronDown size={12} /></>
                      )}
                    </button>
                  </div>

                  {isGanttOpen && (
                    <div className="murex-gantt-chart-container">
                      <div className="murex-gantt-summary-bar">
                        <span className="murex-gantt-step-count">{run.steps.length} Steps</span>
                        <span>Total DB: <strong>{totalDb.toLocaleString()}s</strong></span>
                        <span>Total CPU: <strong>{totalCpu.toLocaleString()}s</strong></span>
                        <span>Total Duration: <strong>{run.seconds.toLocaleString()}s</strong></span>
                      </div>

                      <PlotlyChart data={ganttSpec.data} layout={ganttSpec.layout} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminModal>
  );
}

export default JobExecutionDetailsModal;

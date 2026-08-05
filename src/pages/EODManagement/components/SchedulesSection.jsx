import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { eodService } from '@services/eodService';
import { ScheduleModal } from './ScheduleModal';

function formatDateGroup(dateVal) {
  if (!dateVal) return 'Today';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return String(dateVal);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  ) {
    return 'Today';
  }

  if (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  ) {
    return 'Tomorrow';
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

export function SchedulesSection() {
  const [scheduleList, setScheduleList] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  /** Fetch schedule records only on page load */
  const fetchScheduleData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const schedulesData = await eodService.getEodSchedules();
      setScheduleList(schedulesData || []);
    } catch (err) {
      console.error('Failed to fetch EOD schedules:', err);
      setError(err?.message || 'Failed to load schedule data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  /** Lazily load environments only when opening Add/Edit modal (uses lightweight API without SFTP overhead) */
  const fetchEnvironmentsIfNeeded = async () => {
    if (environments.length > 0) return environments;
    try {
      const envsData = await eodService.getEnvironments();
      setEnvironments(envsData || []);
      return envsData || [];
    } catch (err) {
      console.error('Failed to fetch environments for modal:', err);
      return [];
    }
  };

  const getEnv = (envId) =>
    environments.find(
      (e) =>
        e.id === envId ||
        String(e.id) === String(envId) ||
        e.name?.toLowerCase() === String(envId)?.toLowerCase()
    );

  const handleOpenAdd = async () => {
    const envs = await fetchEnvironmentsIfNeeded();
    setEditingSchedule({
      id: '',
      envId: envs[0]?.id || '',
      selectedDate: new Date(),
      time: '22:00',
      recurrence: 'Daily',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = async (sch, e) => {
    e?.stopPropagation();
    const envs = await fetchEnvironmentsIfNeeded();
    setEditingSchedule({
      ...sch,
      selectedDate: sch.selectedDate || new Date(),
    });
    setModalOpen(true);
  };


  const handleSaveSchedule = async (schData) => {
    try {
      const formattedDate = formatDateGroup(schData.selectedDate);
      const payload = {
        ...schData,
        dateGroup: formattedDate,
      };

      if (schData.id) {
        await eodService.updateEodSchedule(schData.id, payload);
      } else {
        await eodService.createEodSchedule(payload);
      }
      setModalOpen(false);
      await fetchScheduleData();
    } catch (err) {
      console.error('Failed to save schedule:', err);
      // Fallback local update if backend error
      const formattedDate = formatDateGroup(schData.selectedDate);
      const itemToSave = {
        id: schData.id || `sch-${Date.now()}`,
        envId: schData.envId,
        dateGroup: formattedDate,
        time: schData.time,
        recurrence: schData.recurrence,
        isActive: true,
      };
      if (schData.id) {
        setScheduleList((prev) => prev.map((s) => (s.id === schData.id ? itemToSave : s)));
      } else {
        setScheduleList((prev) => [...prev, itemToSave]);
      }
      setModalOpen(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    setIsSaving(true);
    try {
      await eodService.deleteEodSchedule(id);
      setDeleteConfirmSchedule(null);
      await fetchScheduleData();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      setScheduleList((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmSchedule(null);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Loader message="Loading automated EOD schedules…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Schedules could not be loaded"
        description={error}
        onRetry={fetchScheduleData}
      />
    );
  }

  const days = Array.from(new Set(scheduleList.map((s) => s.dateGroup || 'Today')));

  return (
    <div className="eod-section">
      <div className="eod-section-bar">
        <div>
          <p className="eod-section-title">Scheduled Runs</p>
          <span className="eod-section-subtitle">
            Manage automated End-of-Day batch execution schedules
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="eod-add-btn"
            onClick={fetchScheduleData}
            style={{
              background: 'transparent',
              color: 'var(--c-primary)',
              border: '1px solid var(--c-primary)',
            }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
          <button
            type="button"
            className="eod-add-btn primary-green"
            onClick={handleOpenAdd}
          >
            <Plus size={13} /> Add Schedule
          </button>
        </div>
      </div>

      {/* ── Empty State vs Content ── */}
      {scheduleList.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No records found"
          description="No automated End-of-Day batch execution schedules available."
          action={
            <button
              type="button"
              className="eod-add-btn primary-green"
              onClick={handleOpenAdd}
            >
              <Plus size={13} /> Add Schedule
            </button>
          }
        />
      ) : (
        <div className="eod-schedules-container">
          {days.map((day) => {
            const daySchedules = scheduleList.filter((s) => s.dateGroup === day);
            return (
              <div key={day} className="eod-schedule-card">
                <div className="eod-schedule-header">
                  <div className="eod-schedule-header-title">
                    <Calendar size={14} className="eod-cal-icon" />
                    <span>{day}</span>
                  </div>
                  <span className="eod-schedule-count-pill">{daySchedules.length} scheduled</span>
                </div>

                {daySchedules.length === 0 ? (
                  <div className="eod-schedule-empty">
                    <Clock size={18} className="eod-empty-clock" />
                    <span>No scheduled runs for {day}.</span>
                    <button
                      type="button"
                      className="eod-empty-add-btn"
                      onClick={handleOpenAdd}
                    >
                      <Plus size={11} /> Add Schedule
                    </button>
                  </div>
                ) : (
                  <div className="eod-timeline-list">
                    {daySchedules.map((sch) => {
                      const env = getEnv(sch.envId);
                      const envName = env?.name || sch.environmentName || String(sch.envId || 'ENVIRONMENT').toUpperCase();
                      const envColor = env?.color || '#005A36';

                      return (
                        <div key={sch.id} className="eod-sch-row-item">
                          <div className="eod-sch-time-col">
                            <span className="eod-sch-time-tag">{sch.time}</span>
                          </div>

                          <div className="eod-sch-dot-wrap">
                            <span
                              className="eod-sch-dot"
                              style={{ background: envColor, color: envColor }}
                            />
                          </div>

                          <div className="eod-sch-details-col">
                            <div className="eod-sch-env-badge">
                              <span className="eod-sch-env-dot" style={{ background: envColor }} />
                              <span className="eod-sch-env-name">{envName}</span>
                            </div>

                            <div className="eod-sch-recur-pill">
                              <RefreshCw size={10} />
                              <span>{sch.recurrence}</span>
                            </div>
                            {sch.cronExpression && (
                              <code className="eod-dur-code" style={{ fontSize: 11, marginLeft: 6 }} title="Stored Cron Expression">
                                {sch.cronExpression}
                              </code>
                            )}
                          </div>


                          <div className="eod-sch-actions-col">
                            <button
                              type="button"
                              className="eod-icon-btn"
                              onClick={(e) => handleOpenEdit(sch, e)}
                              title="Edit Schedule"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              className="eod-icon-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmSchedule(sch);
                              }}
                              title="Delete Schedule"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Schedule Modal Overlay */}
      {modalOpen && editingSchedule && (
        <ScheduleModal
          isOpen={modalOpen}
          schedule={editingSchedule}
          environments={environments}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveSchedule}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSchedule && (
        <AdminModal
          isOpen={Boolean(deleteConfirmSchedule)}
          onClose={() => setDeleteConfirmSchedule(null)}
          title="Delete Schedule"
          size="sm"
        >
          <div className="eod-delete-modal-body">
            <AlertTriangle size={24} className="eod-danger-icon" />
            <p>
              Are you sure you want to delete the schedule for{' '}
              <strong>
                {getEnv(deleteConfirmSchedule.envId)?.name || deleteConfirmSchedule.environmentName || deleteConfirmSchedule.envId}
              </strong>{' '}
              at <strong>{deleteConfirmSchedule.time}</strong>?
            </p>
          </div>
          <div className="eod-modal-footer">
            <button
              type="button"
              className="eod-modal-btn cancel"
              onClick={() => setDeleteConfirmSchedule(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="eod-modal-btn danger"
              onClick={() => handleDeleteSchedule(deleteConfirmSchedule.id)}
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Deleting...</> : 'Delete Schedule'}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

export default SchedulesSection;

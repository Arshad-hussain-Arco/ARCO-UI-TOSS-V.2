import { useEffect, useState } from 'react';
import { Check, Edit2, Plus, Search, Trash2, X } from 'lucide-react';

import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { Select } from '@components/forms/Select/Select';
import { TableSkeleton } from '@components/feedback/Skeleton';
import { useToast } from '@hooks/useToast';
import { leaveService } from '@services/leaveService';

import { computeDayOfWeek, computeStatus, formatDate, parseDateValue, toDateInputValue } from '../utils';
import { AddEditHolidayModal } from './AddEditHolidayModal';

function mapHoliday(h) {
  return {
    ...h,
    id: h.id,
    name: h.holiday_name || h.name,
    date: h.date || (h.dates && h.dates[0]) || '',
    day: h.day || (h.date ? computeDayOfWeek(h.date) : ''),
    type: h.type || 'Public Holiday',
    status: h.status || 'Upcoming',
    description: h.description || '',
  };
}

export function HolidaysTab({ onCountChange }) {
  const toast = useToast();

  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [holidayEditForm, setHolidayEditForm] = useState({
    name: '', date: '', day: '', type: 'Public Holiday', status: 'Upcoming', description: '',
  });

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '', date: '', day: '', type: 'Public Holiday', status: 'Upcoming', description: '',
  });

  useEffect(() => {
    let active = true;
    const fetchHolidays = async () => {
      setIsLoading(true);
      try {
        const hData = await leaveService.listHolidays();
        const mapped = (hData || []).map(mapHoliday);
        if (active) {
          setHolidays(mapped);
          onCountChange?.(mapped.length);
        }
      } catch (err) {
        console.error('Failed to load holidays:', err);
        if (active) toast.error('Error loading holidays');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchHolidays();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddHolidayModal = () => {
    setEditingHoliday(null);
    const todayStr = toDateInputValue(new Date());
    setHolidayForm({
      name: '', date: todayStr, day: computeDayOfWeek(todayStr),
      type: 'Public Holiday', status: computeStatus(todayStr), description: '',
    });
    setIsHolidayModalOpen(true);
  };

  const startHolidayInlineEdit = (h) => {
    setEditingHolidayId(h.id);
    setHolidayEditForm({
      name: h.name, date: h.date, day: computeDayOfWeek(h.date),
      type: h.type || 'Public Holiday', status: computeStatus(h.date), description: h.description || '',
    });
  };

  const cancelHolidayInlineEdit = () => {
    setEditingHolidayId(null);
    setHolidayEditForm({ name: '', date: '', day: '', type: 'Public Holiday', status: 'Upcoming', description: '' });
  };

  const handleSaveHolidayInlineEdit = async (id) => {
    if (!holidayEditForm.name || !holidayEditForm.date) {
      toast.error('Please enter holiday name and date');
      return;
    }
    const payload = {
      holiday_name: holidayEditForm.name,
      dates: [holidayEditForm.date],
      description: holidayEditForm.description || '',
      emp_id: 10,
    };
    try {
      await leaveService.editHoliday(id, payload);
      const computedDay = computeDayOfWeek(holidayEditForm.date);
      const computedStatus = computeStatus(holidayEditForm.date);
      setHolidays((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
              ...item,
              name: holidayEditForm.name,
              date: holidayEditForm.date,
              day: computedDay,
              type: holidayEditForm.type,
              status: computedStatus,
              description: holidayEditForm.description,
            }
            : item,
        ),
      );
      setEditingHolidayId(null);
      toast.success(`Updated holiday: ${holidayEditForm.name}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save inline edit');
    }
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.name || !holidayForm.date) {
      toast.error('Please enter holiday name and date');
      return;
    }
    const payload = {
      holiday_name: holidayForm.name,
      dates: [holidayForm.date],
      description: holidayForm.description,
      emp_id: 10,
    };
    try {
      if (editingHoliday) {
        await leaveService.editHoliday(editingHoliday.id, payload);
        toast.success(`Updated holiday: ${holidayForm.name}`);
      } else {
        await leaveService.addHoliday(payload);
        toast.success(`Added holiday: ${holidayForm.name}`);
      }
      setIsHolidayModalOpen(false);
      const hData = await leaveService.listHolidays();
      const mapped = (hData || []).map(mapHoliday);
      setHolidays(mapped);
      onCountChange?.(mapped.length);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save holiday');
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      await leaveService.deleteHoliday(id, { emp_id: 10 });
      setHolidays((prev) => {
        const next = prev.filter((h) => h.id !== id);
        onCountChange?.(next.length);
        return next;
      });
      toast.success('Holiday deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete holiday');
    }
  };

  const filteredHolidays = holidays.filter(
    (h) =>
      (h.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (h.type || '').toLowerCase().includes((searchQuery || '').toLowerCase()),
  );

  return (
    <div className="lc-card-panel">
      <div className="lc-card-toolbar">
        <div className="lc-search-box">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search holidays..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button type="button" className="lc-btn-primary" onClick={openAddHolidayModal}>
          <Plus size={16} />
          Add Holiday
        </button>
      </div>

      <div className="lc-table-responsive">
        <table className="lc-data-table">
          <thead>
            <tr>
              <th>Holiday Name</th>
              <th>Date</th>
              <th>Day</th>
              <th>Type</th>
              <th>Status</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <TableSkeleton rows={5} columns={7} showHeader={false} />
                  </div>
                </td>
              </tr>
            ) : filteredHolidays.length === 0 ? (
              <tr>
                <td colSpan={8} className="lc-empty-state">
                  No holidays match your search criteria.
                </td>
              </tr>
            ) : (
              filteredHolidays.map((h) => {
                const isEditing = editingHolidayId === h.id;

                return (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>
                      {isEditing ? (
                        <input
                          className="lc-inline-input"
                          style={{ width: '100%', minWidth: '150px' }}
                          value={holidayEditForm.name}
                          onChange={(e) =>
                            setHolidayEditForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          autoFocus
                        />
                      ) : (
                        h.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="lc-inline-edit-wrap" style={{ width: '100%' }}>
                          <DatePicker
                            value={parseDateValue(holidayEditForm.date)}
                            onChange={(value) =>
                              setHolidayEditForm((prev) => ({
                                ...prev,
                                date: toDateInputValue(value),
                              }))
                            }
                            placeholder="Select date"
                            width="100%"
                            showClear={false}
                          />
                        </div>
                      ) : (
                        formatDate(h.date)
                      )}
                    </td>
                    <td style={{ color: '#64748b' }}>
                      {isEditing ? computeDayOfWeek(holidayEditForm.date) : computeDayOfWeek(h.date)}
                    </td>
                    <td>
                      {isEditing ? (
                        <Select
                          value={holidayEditForm.type}
                          onChange={(value) =>
                            setHolidayEditForm((prev) => ({ ...prev, type: value }))
                          }
                          options={[
                            { value: 'Public Holiday', label: 'Public Holiday' },
                            { value: 'National Holiday', label: 'National Holiday' },
                            { value: 'Company Holiday', label: 'Company Holiday' },
                          ]}
                          placeholder="Select type"
                          width="180px"
                        />
                      ) : (
                        <span className="lc-code-badge">{h.type}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <span className={computeStatus(holidayEditForm.date) === 'Upcoming' ? 'lc-tag-upcoming' : 'lc-tag-past'}>
                          {computeStatus(holidayEditForm.date)}
                        </span>
                      ) : (
                        <span className={computeStatus(h.date) === 'Upcoming' ? 'lc-tag-upcoming' : 'lc-tag-past'}>
                          {computeStatus(h.date)}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="lc-inline-input"
                          style={{ width: '100%', minWidth: '150px' }}
                          value={holidayEditForm.description}
                          onChange={(e) =>
                            setHolidayEditForm((prev) => ({ ...prev, description: e.target.value }))
                          }
                        />
                      ) : (
                        <span
                          className="lc-description-cell"
                          title={h.description || 'No description available'}
                        >
                          {h.description || '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="lc-btn-primary"
                            style={{ height: '32px', padding: '0 12px' }}
                            onClick={() => handleSaveHolidayInlineEdit(h.id)}
                          >
                            <Check size={14} />
                            Save Changes
                          </button>
                          <button
                            type="button"
                            className="lc-ghost-btn"
                            style={{ width: 'auto', padding: '0 12px' }}
                            onClick={cancelHolidayInlineEdit}
                          >
                            <X size={14} />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="lc-ghost-btn"
                            title="Edit Holiday"
                            onClick={() => startHolidayInlineEdit(h)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="lc-ghost-btn danger"
                            title="Delete Holiday"
                            onClick={() => handleDeleteHoliday(h.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddEditHolidayModal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        isEditing={!!editingHoliday}
        form={holidayForm}
        setForm={setHolidayForm}
        onSave={handleSaveHoliday}
        existingTypes={holidays.map(h => h.type).filter(Boolean)}
      />
    </div>
  );
}

export default HolidaysTab;

import React, { useEffect, useState } from 'react';
import { X, Info, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { dateStr } from '@components/leave/InlineCalendar';
import './EditLeaveModal.css';

const DURATION_LABEL = {
  FULL_DAY: 'Full Day',
  FIRST_HALF: '1st Half',
  SECOND_HALF: '2nd Half',
};

// A Claim submission is N separate Leave rows sharing one requested_date
// (see ClaimService.submit_claim/_sibling_claims on the backend) — there's
// no single row to edit, so this works off the whole batch: leaveGroup is
// the grouped row shape TeamRequestsTab's groupClaimRows()/the equivalent
// My Leave grouping produce, carrying `claimDates` (one entry per row) and
// `raw` (the anchor row's untouched backend object).
export function EditClaimModal({ leaveGroup, onClose, onSuccess }) {
  const { user } = useAuth();
  const toast = useToast();

  // TeamRequestsTab's grouped rows carry the untouched backend leave under
  // `.raw`; LeaveManagementPage's groupClaimLeaves instead spreads the raw
  // leave fields directly onto the group — support both shapes.
  const anchor = leaveGroup.raw || leaveGroup;
  const leaveTypeCode = anchor.leave_type;
  const empId = anchor.emp_id;
  const anchorLeaveId = anchor.id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState(anchor.leave_reason || '');
  const [modReason, setModReason] = useState('');

  // One row per claimed date — `removed: true` marks it for deletion
  // without actually deleting from state, so it can be un-removed before
  // submit. Existing rows carry their Leave id (used server-side only to
  // resolve the batch, not required per-date — the whole set is resent).
  const [rows, setRows] = useState(() => {
    // groupClaimLeaves/groupClaimRows only keep `claimDates` for a 2+-date
    // batch — a single-date claim gets it deleted entirely, with that one
    // date living directly on the group's own (or `.raw`'s) start_date/
    // leave_duration fields instead. Without this fallback, every
    // single-date claim opened this modal to an empty "No dates yet." row
    // list.
    if (leaveGroup.claimDates && leaveGroup.claimDates.length > 0) {
      return leaveGroup.claimDates.map((cd) => ({
        id: cd.id,
        date: cd.date,
        duration: cd.duration === 'morning' ? 'FIRST_HALF'
          : cd.duration === 'afternoon' ? 'SECOND_HALF'
          : cd.duration === 'FIRST_HALF' || cd.duration === 'SECOND_HALF' ? cd.duration
          : 'FULL_DAY',
        removed: false,
      }));
    }
    if (!anchor.start_date) return [];
    return [{
      id: anchor.id,
      date: anchor.start_date,
      duration: anchor.leave_duration || 'FULL_DAY',
      removed: false,
    }];
  });

  const status = (leaveGroup.status_code || leaveGroup.status || anchor.status_code || '').toString().toUpperCase();
  const isPending = status === 'PENDING';
  const isOnBehalf = empId != null && user?.emp_id != null && empId !== user.emp_id;

  const activeRows = rows.filter((r) => !r.removed);
  const activeDates = new Set(activeRows.map((r) => r.date));

  // Eligible dates to add from, per this claim type's configured rule
  // (Weekend / Company Holiday / Custom Dates — see backend
  // _claim_eligible_dates), fetched over a window around the batch's
  // existing dates. Excludes this batch's own rows from "already claimed"
  // so its own dates aren't greyed out.
  const [eligibleDates, setEligibleDates] = useState([]);
  const [claimedPortions, setClaimedPortions] = useState({});
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);
  const [newDate, setNewDate] = useState(null); // Date object, matching DatePicker's value shape
  const [newDuration, setNewDuration] = useState('FULL_DAY');

  useEffect(() => {
    if (!empId || !leaveTypeCode) return;
    // Same 365-day lookback window as ApplyLeaveModal's Submit Claim flow
    // (queryStart/queryEnd) — using just this batch's own earliest date as
    // the window start (as this used to) meant any eligible date further
    // back than the batch's own dates was never even fetched, so it could
    // never appear as selectable regardless of eligibility.
    const today = new Date();
    const queryStart = new Date(today);
    queryStart.setDate(queryStart.getDate() - 365);
    const queryEnd = new Date(today.getTime() - 864e5); // yesterday — claims never include today
    const start = dateStr(queryStart);
    const end = dateStr(queryEnd);
    setIsLoadingEligible(true);
    leaveService
      .getClaimEligibleDates({
        emp_id: empId,
        leave_type_code: leaveTypeCode,
        start,
        end,
        exclude_leave_ids: rows.map((r) => r.id).filter(Boolean),
      })
      .then((data) => {
        // Dates already fully claimed elsewhere are dropped from
        // eligible_dates outright by the backend; claimed_portions lists
        // the dates still partially open (e.g. First Half already
        // claimed, Second Half still available) — same shape ApplyLeaveModal
        // already reads for the Submit Claim flow.
        setEligibleDates(data?.eligible_dates || []);
        setClaimedPortions(data?.claimed_portions || {});
      })
      .catch(() => {
        setEligibleDates([]);
        setClaimedPortions({});
      })
      .finally(() => setIsLoadingEligible(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId, leaveTypeCode]);

  const eligibleDateSet = new Set(eligibleDates);
  const addableCount = eligibleDates.filter((d) => !activeDates.has(d)).length;

  // Which halves of `iso` are already spoken for — by an existing
  // PENDING/APPROVED claim elsewhere (claimedPortions, from the server) —
  // so "Add a Date" never offers a duration that would actually conflict.
  // FULL_DAY counts as unavailable if either half is taken.
  function unavailablePortionsFor(iso) {
    const taken = new Set(claimedPortions[iso] || []);
    if (taken.has('FIRST_HALF') || taken.has('SECOND_HALF')) taken.add('FULL_DAY');
    return taken;
  }

  function toggleRemove(index) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, removed: !r.removed } : r)));
  }

  function updateDuration(index, duration) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, duration } : r)));
  }

  function addDate() {
    if (!newDate) return;
    const iso = dateStr(newDate);
    setRows((prev) => [...prev, { id: null, date: iso, duration: newDuration, removed: false }]);
    setNewDate(null);
    setNewDuration('FULL_DAY');
  }

  const handleSubmit = async () => {
    // A date picked in "Add a Date" only lands in `rows` (and therefore in
    // the submission) once the separate + button is clicked — easy to miss
    // if the reason/click order feels like "pick it, then submit". Rather
    // than silently dropping it, fold it in here too so picking a date is
    // enough on its own; skip it if that same date's already an active row
    // (the DatePicker already disables it, but activeDates can still shift
    // between the picker render and this click).
    const pendingNew = newDate && !activeDates.has(dateStr(newDate))
      ? [{ date: dateStr(newDate), duration: newDuration }]
      : [];
    const finalDates = [
      ...activeRows.map((r) => ({ date: r.date, duration: r.duration })),
      ...pendingNew,
    ];
    if (finalDates.length === 0) {
      toast.error('At least one date must remain in the claim.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Reason is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      let res;
      if (isOnBehalf) {
        res = await leaveService.editClaimOnBehalf(anchorLeaveId, {
          manager_id: user?.emp_id,
          dates: finalDates,
          reason,
        });
      } else {
        res = await leaveService.modifyClaim(anchorLeaveId, {
          emp_id: empId,
          dates: finalDates,
          reason,
          modification_reason: modReason,
        });
      }

      if (isOnBehalf) {
        toast.success('Claim modified and approved on behalf of the employee.');
      } else if (res?.type === 'mod_request') {
        toast.success('Modification request submitted. Awaiting manager approval.');
      } else {
        toast.success('Claim updated successfully.');
      }
      onSuccess();
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || 'Failed to modify claim. Please try again.';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="al-overlay" onClick={() => onClose(false)}>
      <div className="al-modal" onClick={(e) => e.stopPropagation()}>
        <div className="al-header">
          <div className="al-header-left">
            <h2 className="al-title">
              Edit {leaveGroup.leaveType || leaveGroup.displayType || leaveTypeCode} Claim
              {isOnBehalf ? ` (${leaveGroup.employeeName || `employee #${empId}`})` : ''}
            </h2>
          </div>
          <button type="button" className="al-close-btn" onClick={() => onClose(false)}>
            <X size={15} />
          </button>
        </div>

        <div className="al-body" style={{ padding: '20px' }}>
          <div className="el-workflow-banner">
            <Info size={14} className="el-workflow-banner-icon" />
            <span>
              {isOnBehalf
                ? 'Editing on behalf of your report — this change is applied and approved immediately.'
                : isPending
                  ? 'This claim is still pending — your changes will be applied immediately, no re-approval needed.'
                  : 'This claim is already approved — changed or removed dates will be submitted as a modification request awaiting manager approval; any newly added date is created as a new pending claim.'}
            </span>
          </div>

          <div className="al-form-group">
            <label className="al-label">Claimed Dates *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px', backgroundColor: 'var(--bg-secondary)' }}>
              {rows.map((row, index) => (
                <div
                  key={`${row.date}-${row.id ?? 'new'}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px', backgroundColor: 'var(--surface-primary)', borderRadius: '4px',
                    border: '1px solid var(--border-primary)',
                    opacity: row.removed ? 0.5 : 1,
                    textDecoration: row.removed ? 'line-through' : 'none',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {row.date}{row.id == null && !row.removed && (
                      <span className="el-nonworking-tag">new</span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!row.removed && (
                      <div className="al-duration-chips" style={{ margin: 0, gap: '4px' }}>
                        {Object.entries(DURATION_LABEL).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            className="al-duration-chip"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            data-active={row.duration === val}
                            onClick={() => updateDuration(index, val)}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="al-btn al-btn-ghost"
                      style={{ padding: '4px 8px' }}
                      title={row.removed ? 'Undo remove' : 'Remove this date'}
                      onClick={() => toggleRemove(index)}
                    >
                      {row.removed ? 'Undo' : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No dates yet.</span>
              )}
            </div>
          </div>

          <div className="al-form-group" style={{ marginTop: '12px' }}>
            <label className="al-label">Add a Date</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <DatePicker
                value={newDate}
                onChange={(d) => {
                  setNewDate(d);
                  // If the previously-picked duration isn't available for
                  // the newly-picked date (e.g. its First Half is already
                  // claimed elsewhere), fall back to whatever is — so Add
                  // never submits a portion that's actually already taken.
                  const iso = d ? dateStr(d) : null;
                  const unavailable = iso ? unavailablePortionsFor(iso) : new Set();
                  if (unavailable.has(newDuration)) {
                    if (!unavailable.has('FIRST_HALF')) setNewDuration('FIRST_HALF');
                    else if (!unavailable.has('SECOND_HALF')) setNewDuration('SECOND_HALF');
                  }
                }}
                isDateDisabled={(d) => {
                  const iso = dateStr(d);
                  if (!eligibleDateSet.has(iso) || activeDates.has(iso)) return true;
                  // Only disable outright when BOTH halves are taken — one
                  // half already claimed elsewhere should still leave the
                  // date pickable, just with the remaining half as the
                  // only duration option (handled below).
                  const unavailable = unavailablePortionsFor(iso);
                  return unavailable.has('FIRST_HALF') && unavailable.has('SECOND_HALF');
                }}
                placeholder={isLoadingEligible ? 'Loading eligible dates…' : addableCount === 0 ? 'No more eligible dates' : 'Select a date'}
                disabled={isLoadingEligible || addableCount === 0}
                width="200px"
              />
              <div className="al-duration-chips" style={{ margin: 0, gap: '4px' }}>
                {Object.entries(DURATION_LABEL).map(([val, lbl]) => {
                  const unavailable = newDate ? unavailablePortionsFor(dateStr(newDate)) : new Set();
                  return (
                    <button
                      key={val}
                      type="button"
                      className="al-duration-chip"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      data-active={newDuration === val}
                      disabled={unavailable.has(val)}
                      title={unavailable.has(val) ? 'Already claimed for this date' : undefined}
                      onClick={() => setNewDuration(val)}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="al-btn al-btn-primary"
                style={{ padding: '6px 10px' }}
                disabled={!newDate}
                onClick={addDate}
                title="Add this date to the claim"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="al-form-group" style={{ marginTop: '15px' }}>
            <label className="al-label">Reason *</label>
            <textarea
              className="al-textarea"
              style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {!isOnBehalf && (
            <div className="al-form-group" style={{ marginTop: '15px' }}>
              <label className="al-label">Reason for Modification (Optional)</label>
              <textarea
                className="al-textarea"
                style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
                placeholder="Why are you modifying this claim?"
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button className="al-btn al-btn-ghost" onClick={() => onClose(false)}>
              Cancel
            </button>
            <button
              className="al-btn al-btn-primary"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting
                ? 'Submitting...'
                : isOnBehalf
                  ? 'Modify & Approve'
                  : isPending
                    ? 'Save Changes'
                    : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

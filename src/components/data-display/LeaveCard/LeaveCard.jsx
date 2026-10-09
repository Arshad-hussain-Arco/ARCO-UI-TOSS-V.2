import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import './LeaveCard.css';

// Whole numbers stay whole; half-days (0.5) stay exact — never rounded.
const formatDays = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(2)));
};

const ROWS = [
  { key: 'used', label: 'Used' },
  { key: 'planned', label: 'Planned' },
];

// ⓘ next to Booked. Opens on hover/focus (desktop) and on click/tap, closes
// on mouse-leave, outside click, Escape, scroll or resize. Rendered in a
// portal with fixed positioning so the card grid's overflow-x scroller
// can't clip it.
function BookedInfo({ breakdown, title }) {
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const closeTimer = useRef(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const popId = useId();

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = popRef.current?.offsetWidth || 190;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    setPos({ top: r.bottom + 6, left });
  }, []);

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(false);
    setPinned(false);
  }, []);

  const show = () => {
    clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  };
  // Short delay so the pointer can travel from the icon to the popover.
  const hideSoon = () => {
    if (pinned) return;
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    if (!open) return undefined;
    place();
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, place, close]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="leave-card-info-btn"
        aria-label={`Booked breakdown for ${title}`}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        onClick={() => {
          if (open && pinned) close();
          else { show(); setPinned(true); }
        }}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          id={popId}
          role="tooltip"
          className="leave-card-popover"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={hideSoon}
        >
          {breakdown ? (
            <table className="leave-card-breakdown">
              <thead>
                <tr>
                  <th aria-label="Type" />
                  <th scope="col">Pending</th>
                  <th scope="col">Approved</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(({ key, label }) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{formatDays(breakdown[key]?.pending)}</td>
                    <td>{formatDays(breakdown[key]?.approved)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="leave-card-popover-empty">No booking details available</span>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * One card per leave type:
 *   Title / Available / Booked ⓘ (/ Carry Over, only when applicable).
 * All numbers come from the backend (BalanceService.summary with
 * include_booked) — nothing is calculated here.
 *
 * `available` is null for an unlimited type (rendered as ∞).
 * `claimed` (days earned via approved claims; Weekend Work / Comp Off only)
 * and `carryOver` hide their rows when undefined/null.
 */
function LeaveCard({
  title, subtitle, icon: Icon, available, booked, breakdown, claimed, carryOver,
  isUnlimited, isLoading, color,
}) {
  const leaveType = title.toLowerCase().replace(/\s+/g, '-');

  if (isLoading) {
    return (
      <div className="leave-card" data-leave-type={leaveType} aria-busy="true">
        <div className="leave-card-header">
          <div className="leave-card-skeleton-text" style={{ width: '70%', height: '14px' }} />
        </div>
        {[0, 1].map((i) => (
          <div className="leave-card-row" key={i}>
            <div className="leave-card-skeleton-text" style={{ width: '45%', height: '12px' }} />
            <div className="leave-card-skeleton-text" style={{ width: '20px', height: '12px' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="leave-card" data-leave-type={leaveType} style={color ? { '--leave-accent': color } : undefined}>
      <div className="leave-card-header">
        <div className="leave-card-heading">
          <h3 className="leave-card-title">{title}</h3>
          {subtitle && <span className="leave-card-subtitle">{subtitle}</span>}
        </div>
        {Icon && (
          <span className="leave-card-icon" aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
      </div>

      <div className="leave-card-row">
        <span className="leave-card-row-label">Available</span>
        <span className="leave-card-row-value">
          {isUnlimited || available == null ? '∞' : formatDays(available)}
        </span>
      </div>

      <div className="leave-card-row">
        <span className="leave-card-row-label leave-card-row-label-info">
          Booked
          <BookedInfo breakdown={breakdown} title={title} />
        </span>
        <span className="leave-card-row-value">{formatDays(booked)}</span>
      </div>

      {claimed != null && (
        <div className="leave-card-row">
          <span className="leave-card-row-label">Claimed</span>
          <span className="leave-card-row-value">{formatDays(claimed)}</span>
        </div>
      )}

      {carryOver != null && (
        <div className="leave-card-row">
          <span className="leave-card-row-label">Carry Over</span>
          <span className="leave-card-row-value">{formatDays(carryOver)}</span>
        </div>
      )}
    </div>
  );
}

export { LeaveCard };
export default LeaveCard;

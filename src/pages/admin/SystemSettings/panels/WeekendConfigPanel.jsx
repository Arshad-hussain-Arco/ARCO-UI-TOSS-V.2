import { memo } from 'react';

const DAY_SELECTED_CLASS =
  'bg-[var(--c-primary-light)] text-[var(--c-primary)] border-[var(--c-primary)]';
const DAY_IDLE_CLASS =
  'bg-[var(--surface-primary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:border-[var(--border-secondary)]';

/**
 * Weekend day selection and the weekend EOD switch.
 *
 * @param {Object} props
 * @param {{ days: string[], selectedDays: string[], runEodOnWeekends: boolean }} props.weekend
 * @param {(day: string) => void} props.onToggleDay
 * @param {() => void} props.onToggleWeekendEod
 */
function WeekendConfigPanelComponent({ weekend, onToggleDay, onToggleWeekendEod }) {
  return (
    <div className="ss-form-card">
      <div className="p-6 flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
          <legend className="text-[0.8125rem] font-semibold text-[var(--text-primary)] p-0">
            Weekend Days
          </legend>
          <span className="text-[0.75rem] text-[var(--text-secondary)]">
            Select the days that are considered weekends for batch processing.
          </span>

          <div className="flex gap-2 mt-2">
            {weekend.days.map((day) => {
              const isSelected = weekend.selectedDays.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onToggleDay(day)}
                  aria-pressed={isSelected}
                  className={`w-10 h-10 rounded text-[0.75rem] font-medium flex items-center justify-center border transition-colors ${isSelected ? DAY_SELECTED_CLASS : DAY_IDLE_CLASS}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="h-px bg-[var(--border-primary)] w-full" />

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">
              Run EOD on Weekends
            </span>
            <span className="text-[0.75rem] text-[var(--text-secondary)]">
              Enable if end of day processing should run on selected weekend days.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={weekend.runEodOnWeekends}
            aria-label="Run EOD on weekends"
            onClick={onToggleWeekendEod}
            className={`w-8 h-4 rounded-full relative cursor-pointer border-0 p-0 ${weekend.runEodOnWeekends ? 'bg-[var(--c-primary)]' : 'bg-[var(--switch-background)]'}`}
          >
            <span
              className={`w-3 h-3 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${weekend.runEodOnWeekends ? 'right-0.5' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export const WeekendConfigPanel = memo(WeekendConfigPanelComponent);
export default WeekendConfigPanel;

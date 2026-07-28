import { useCallback, useEffect, useRef, useState } from 'react';

/** Grace period that lets the pointer travel from the trigger into the tooltip. */
const HIDE_DELAY = 100;

/**
 * Hover-tooltip state for the collapsed sidebar: which item is hovered and where
 * its flyout should sit vertically. Extracted from the component so the sidebar
 * only deals with rendering.
 *
 * @param {boolean} enabled  Tooltips only exist while the sidebar is collapsed.
 */
export function useHoverTooltip(enabled) {
  const [activeId, setActiveId] = useState(null);
  const [top, setTop] = useState(null);
  const hideTimer = useRef(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const hideNow = useCallback(() => {
    clearHideTimer();
    setActiveId(null);
    setTop(null);
  }, [clearHideTimer]);

  // Collapsing or expanding the sidebar must not leave a tooltip stranded.
  useEffect(() => {
    if (!enabled) hideNow();
  }, [enabled, hideNow]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const show = useCallback(
    (id, element) => {
      if (!enabled || !element) return;

      clearHideTimer();
      const rect = element.getBoundingClientRect();
      setTop(rect.top + rect.height / 2);
      setActiveId(id);
    },
    [enabled, clearHideTimer],
  );

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setActiveId(null);
      setTop(null);
    }, HIDE_DELAY);
  }, [clearHideTimer]);

  const keepVisible = useCallback(
    (id) => {
      clearHideTimer();
      setActiveId(id);
    },
    [clearHideTimer],
  );

  return { activeId, top, show, scheduleHide, keepVisible, hideNow };
}

export default useHoverTooltip;

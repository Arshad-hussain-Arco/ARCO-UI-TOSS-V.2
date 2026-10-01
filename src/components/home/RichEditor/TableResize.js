const TABLE_GRIP = 14;

/** Returns the table whose bottom-right corner grip is under the pointer. */
export function tableCornerAt(e, root) {
  const table = e.target?.closest?.('table');
  if (!table || !root?.contains(table)) return null;
  const r = table.getBoundingClientRect();
  const nearRight = e.clientX >= r.right - TABLE_GRIP && e.clientX <= r.right + 6;
  const nearBottom = e.clientY >= r.bottom - TABLE_GRIP && e.clientY <= r.bottom + 6;
  return nearRight && nearBottom ? table : null;
}

/** Drag the corner to scale table width and row heights. */
export function startTableResize(e, table, containerEl, onDone) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const rect = table.getBoundingClientRect();
  const rows = Array.from(table.rows);
  const rowHeights = rows.map((r) => r.getBoundingClientRect().height);
  const maxWidth = containerEl?.clientWidth || 9999;

  const onMove = (m) => {
    const w = Math.max(80, Math.min(maxWidth, rect.width + (m.clientX - startX)));
    const scale = Math.max(0.3, (rect.height + (m.clientY - startY)) / (rect.height || 1));
    table.style.width = `${w}px`;
    rows.forEach((r, i) => {
      r.style.height = `${Math.max(16, rowHeights[i] * scale)}px`;
    });
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    onDone?.();
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

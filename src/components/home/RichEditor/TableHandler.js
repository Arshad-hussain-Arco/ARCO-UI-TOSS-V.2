/**
 * Custom table editing — DOM is the single source of truth (no parallel
 * JS grid kept alive between operations). Every operation computes an
 * ephemeral grid on demand via buildGrid(), accounting for existing
 * colspan/rowspan, then mutates the <table> DOM directly and discards it.
 */

function createEmptyCell(tag = 'td') {
  const cell = document.createElement(tag);
  cell.innerHTML = '<br>';
  return cell;
}

/**
 * Computes grid[row][col] = { cellEl, isOrigin, originRow, originCol } for
 * every occupied slot, correctly accounting for colspan/rowspan carried
 * over from earlier rows/columns.
 */
export function buildGrid(table) {
  const rows = Array.from(table.rows);
  const numRows = rows.length;
  const grid = Array.from({ length: numRows }, () => []);
  let spanning = []; // cells with rowSpan > 1 still occupying future rows
  let colCount = 0;

  for (let r = 0; r < numRows; r++) {
    const stillSpanning = [];
    spanning.forEach((sp) => {
      for (let cc = 0; cc < sp.colSpan; cc++) {
        grid[r][sp.col + cc] = { cellEl: sp.cellEl, isOrigin: false, originRow: sp.originRow, originCol: sp.originCol };
      }
      if (sp.remaining - 1 > 0) stillSpanning.push({ ...sp, remaining: sp.remaining - 1 });
    });
    spanning = stillSpanning;

    const cells = Array.from(rows[r].cells);
    let col = 0;
    cells.forEach((cellEl) => {
      while (grid[r][col]) col += 1;
      const colSpan = cellEl.colSpan || 1;
      const rowSpan = cellEl.rowSpan || 1;
      for (let cc = 0; cc < colSpan; cc++) {
        grid[r][col + cc] = { cellEl, isOrigin: cc === 0, originRow: r, originCol: col };
      }
      if (rowSpan > 1) {
        spanning.push({ col, colSpan, remaining: rowSpan - 1, cellEl, originRow: r, originCol: col });
      }
      col += colSpan;
    });
    colCount = Math.max(colCount, grid[r].length);
  }

  return { grid, rowCount: numRows, colCount };
}

function getPhysicalCellsInRow(grid, r, colCount) {
  const seen = new Set();
  const list = [];
  for (let c = 0; c < colCount; c++) {
    const entry = grid[r]?.[c];
    if (entry && entry.originRow === r && !seen.has(entry.cellEl)) {
      seen.add(entry.cellEl);
      list.push({ cellEl: entry.cellEl, startCol: entry.originCol, colSpan: entry.cellEl.colSpan || 1 });
    }
  }
  return list;
}

export function findCellPosition(grid, colCount, cellEl) {
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const entry = grid[r]?.[c];
      if (entry && entry.cellEl === cellEl && entry.originRow === r && entry.originCol === c) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

export function insertTable(rows = 3, cols = 3, { withHeader = true } = {}) {
  const table = document.createElement('table');
  table.className = 'rte-table';

  if (withHeader) {
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (let c = 0; c < cols; c += 1) headRow.appendChild(createEmptyCell('th'));
    thead.appendChild(headRow);
    table.appendChild(thead);
  }

  const tbody = document.createElement('tbody');
  const bodyRows = withHeader ? rows - 1 : rows;
  for (let r = 0; r < Math.max(bodyRows, 1); r += 1) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c += 1) tr.appendChild(createEmptyCell('td'));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

export function deleteTable(table) {
  table?.remove();
}

/** Inserts a new row immediately after `rowIndex` (grid row index, thead+tbody combined). */
export function insertRowAfter(table, rowIndex) {
  const { grid, colCount } = buildGrid(table);
  const newRow = document.createElement('tr');
  const widened = new Set();

  for (let c = 0; c < colCount; c += 1) {
    const entry = grid[rowIndex]?.[c];
    if (entry) {
      const rowSpan = entry.cellEl.rowSpan || 1;
      const spanEndRow = entry.originRow + rowSpan - 1;
      if (rowIndex < spanEndRow) {
        if (!widened.has(entry.cellEl)) {
          entry.cellEl.rowSpan = rowSpan + 1;
          widened.add(entry.cellEl);
        }
        continue;
      }
    }
    newRow.appendChild(createEmptyCell('td'));
  }

  const refRow = table.rows[rowIndex];
  if (refRow?.parentNode) {
    refRow.parentNode.insertBefore(newRow, refRow.nextSibling);
  } else {
    (table.tBodies[0] || table).appendChild(newRow);
  }
  return newRow;
}

export function deleteRow(table, rowIndex) {
  const { grid, colCount, rowCount } = buildGrid(table);
  if (rowCount <= 1) return deleteTable(table);

  const rowToRemove = table.rows[rowIndex];
  const handled = new Set();

  for (let c = 0; c < colCount; c += 1) {
    const entry = grid[rowIndex]?.[c];
    if (!entry || handled.has(entry.cellEl)) continue;
    handled.add(entry.cellEl);

    const rowSpan = entry.cellEl.rowSpan || 1;
    if (rowSpan > 1) {
      entry.cellEl.rowSpan = rowSpan - 1;
      if (entry.originRow === rowIndex) {
        const nextRow = table.rows[rowIndex + 1];
        if (nextRow) {
          const physicalCells = getPhysicalCellsInRow(grid, rowIndex + 1, colCount).filter((pc) => pc.cellEl !== entry.cellEl);
          let anchor = null;
          physicalCells.forEach((pc) => {
            if (pc.startCol < entry.originCol) anchor = pc.cellEl;
          });
          if (anchor) nextRow.insertBefore(entry.cellEl, anchor.nextSibling);
          else nextRow.insertBefore(entry.cellEl, nextRow.firstChild);
        }
      }
    }
  }
  rowToRemove?.remove();
}

export function insertColumnAfter(table, colIndex) {
  const { grid, rowCount, colCount } = buildGrid(table);
  const widened = new Set();

  for (let r = 0; r < rowCount; r += 1) {
    const entry = grid[r]?.[colIndex];
    if (entry) {
      const colSpan = entry.cellEl.colSpan || 1;
      const spanEndCol = entry.originCol + colSpan - 1;
      if (colIndex < spanEndCol) {
        if (!widened.has(entry.cellEl)) {
          entry.cellEl.colSpan = colSpan + 1;
          widened.add(entry.cellEl);
        }
        continue;
      }
    }

    const physicalCells = getPhysicalCellsInRow(grid, r, colCount);
    let anchor = null;
    physicalCells.forEach((pc) => {
      if (pc.startCol <= colIndex) anchor = pc.cellEl;
    });
    const td = createEmptyCell('td');
    const row = table.rows[r];
    if (anchor) row.insertBefore(td, anchor.nextSibling);
    else row.insertBefore(td, row.firstChild);
  }
}

export function deleteColumn(table, colIndex) {
  const { grid, rowCount, colCount } = buildGrid(table);
  if (colCount <= 1) return deleteTable(table);

  const handled = new Set();
  for (let r = 0; r < rowCount; r += 1) {
    const entry = grid[r]?.[colIndex];
    if (!entry || handled.has(entry.cellEl)) continue;
    handled.add(entry.cellEl);

    const colSpan = entry.cellEl.colSpan || 1;
    if (colSpan > 1) {
      entry.cellEl.colSpan = colSpan - 1;
    } else {
      entry.cellEl.remove();
    }
  }
}

/**
 * Merges `cellEls` into one cell. Requires the cells' combined bounding
 * rectangle to be fully and exactly covered by the given cells — a
 * non-rectangular selection can't be represented by colspan/rowspan and is
 * rejected.
 */
export function mergeCells(table, cellEls) {
  if (!cellEls || cellEls.length < 2) return { success: false, reason: 'Select at least two cells to merge.' };

  const { grid, colCount } = buildGrid(table);
  const positions = cellEls.map((el) => findCellPosition(grid, colCount, el)).filter(Boolean);
  if (positions.length !== cellEls.length) return { success: false, reason: 'Could not resolve selected cells.' };

  const minRow = Math.min(...positions.map((p) => p.row));
  const maxRow = Math.max(...positions.map((p, i) => {
    const el = cellEls[i];
    return p.row + (el.rowSpan || 1) - 1;
  }));
  const minCol = Math.min(...positions.map((p) => p.col));
  const maxCol = Math.max(...positions.map((p, i) => {
    const el = cellEls[i];
    return p.col + (el.colSpan || 1) - 1;
  }));

  const selectedSet = new Set(cellEls);
  for (let r = minRow; r <= maxRow; r += 1) {
    for (let c = minCol; c <= maxCol; c += 1) {
      const entry = grid[r]?.[c];
      if (!entry || !selectedSet.has(entry.cellEl)) {
        return { success: false, reason: 'Selection must form a complete rectangle to merge.' };
      }
    }
  }

  const sorted = [...selectedSet].sort((a, b) => {
    const pa = findCellPosition(grid, colCount, a);
    const pb = findCellPosition(grid, colCount, b);
    return pa.row - pb.row || pa.col - pb.col;
  });
  const [origin, ...rest] = sorted;
  origin.colSpan = maxCol - minCol + 1;
  origin.rowSpan = maxRow - minRow + 1;

  rest.forEach((cellEl) => {
    const content = cellEl.innerHTML.trim();
    if (content && content !== '<br>') {
      origin.insertAdjacentHTML('beforeend', ` ${content}`);
    }
    cellEl.remove();
  });

  return { success: true, mergedCell: origin };
}

/** Resets a merged cell's colspan/rowspan to 1, backfilling the freed slots with empty cells. */
export function splitCell(table, cellEl) {
  const { grid, colCount } = buildGrid(table);
  const pos = findCellPosition(grid, colCount, cellEl);
  if (!pos) return { success: false };

  const colSpan = cellEl.colSpan || 1;
  const rowSpan = cellEl.rowSpan || 1;
  if (colSpan === 1 && rowSpan === 1) return { success: true };

  const { row: originRow, col: originCol } = pos;

  for (let r = originRow; r < originRow + rowSpan; r += 1) {
    let anchorEl = r === originRow ? cellEl : null;
    if (r !== originRow) {
      const physicalCells = getPhysicalCellsInRow(grid, r, colCount).filter((pc) => pc.cellEl !== cellEl);
      physicalCells.forEach((pc) => {
        if (pc.startCol < originCol) anchorEl = pc.cellEl;
      });
    }
    for (let c = originCol; c < originCol + colSpan; c += 1) {
      if (r === originRow && c === originCol) continue;
      const td = createEmptyCell('td');
      const row = table.rows[r];
      if (anchorEl) row.insertBefore(td, anchorEl.nextSibling);
      else row.insertBefore(td, row.firstChild);
      anchorEl = td;
    }
  }

  cellEl.colSpan = 1;
  cellEl.rowSpan = 1;
  return { success: true };
}

export function setCellBackground(cellEl, color) {
  if (!cellEl) return;
  cellEl.style.backgroundColor = color;
}

export function setCellBorder(table, { width = '1px', style = 'solid', color = '#cbd5e1' } = {}) {
  if (!table) return;
  table.style.borderCollapse = 'collapse';
  table.querySelectorAll('td, th').forEach((cell) => {
    cell.style.border = `${width} ${style} ${color}`;
  });
}

export function findAncestorTable(node) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el?.closest?.('table.rte-table, table') || null;
}

export function findAncestorCell(node) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el?.closest?.('td, th') || null;
}

export function getRowIndex(table, cellEl) {
  const row = cellEl.closest('tr');
  return Array.from(table.rows).indexOf(row);
}

export function getColIndex(table, cellEl) {
  const { grid, colCount } = buildGrid(table);
  const pos = findCellPosition(grid, colCount, cellEl);
  return pos ? pos.col : -1;
}

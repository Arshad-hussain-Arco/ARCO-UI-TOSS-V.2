/**
 * Table editing helpers for tables inside a free-layout text box.
 *
 * RoosterJS's table commands only work on tables it manages in its own
 * selection, so a table inside a text box (a nested editable region) is edited
 * with plain DOM operations instead. All functions are small and defensive:
 * unsupported merges/splits are skipped rather than corrupting the table.
 */

const CELL_BORDER = '1px solid #94a3b8';

export function buildTableHtml(rows, cols) {
  const r = Math.min(Math.max(parseInt(rows, 10) || 1, 1), 20);
  const c = Math.min(Math.max(parseInt(cols, 10) || 1, 1), 12);
  const cell = `<td style="border: ${CELL_BORDER}; padding: 4px; min-width: 24px;"><br></td>`;
  const row = `<tr>${cell.repeat(c)}</tr>`;
  return `<table style="border-collapse: collapse; width: 100%;"><tbody>${row.repeat(r)}</tbody></table><div><br></div>`;
}

/** 2-D map of the table: grid[r][c] -> the cell element covering that slot (spans expanded). */
export function buildGrid(table) {
  const grid = [];
  Array.from(table.rows).forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(tr.cells).forEach((cell) => {
      while (grid[r][c]) c += 1;
      const rs = cell.rowSpan || 1;
      const cs = cell.colSpan || 1;
      for (let i = 0; i < rs; i += 1) {
        grid[r + i] = grid[r + i] || [];
        for (let j = 0; j < cs; j += 1) grid[r + i][c + j] = cell;
      }
      c += cs;
    });
  });
  return grid;
}

export function locate(table, cell) {
  const grid = buildGrid(table);
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < (grid[r] || []).length; c += 1) {
      if (grid[r][c] === cell) return { grid, r, c };
    }
  }
  return { grid, r: 0, c: 0 };
}

const newCell = (doc, like) => {
  const td = doc.createElement('td');
  const st = like && like.getAttribute('style');
  if (st) td.setAttribute('style', st.replace(/background[^;]*;?/g, '').replace(/colspan|rowspan/g, ''));
  td.appendChild(doc.createElement('br'));
  return td;
};

export function insertRow(table, cell, below) {
  const doc = table.ownerDocument;
  const { grid, r } = locate(table, cell);
  const ref = r + (below ? (cell.rowSpan || 1) - 1 : 0);
  const refRow = table.rows[ref] || table.rows[r];
  const tr = doc.createElement('tr');
  const seen = new Set();
  (grid[ref] || []).forEach((c) => {
    if (seen.has(c)) return;
    seen.add(c);
    const spansPast = below ? ((c.parentElement.rowIndex + (c.rowSpan || 1) - 1) > ref) : (c.parentElement.rowIndex < ref);
    if (spansPast) { c.rowSpan = (c.rowSpan || 1) + 1; return; }
    for (let i = 0; i < (c.colSpan || 1); i += 1) tr.appendChild(newCell(doc, c));
  });
  refRow.parentNode.insertBefore(tr, below ? refRow.nextSibling : refRow);
  return tr;
}

export function insertColumn(table, cell, right) {
  const doc = table.ownerDocument;
  const { grid, c } = locate(table, cell);
  const col = right ? c + (cell.colSpan || 1) - 1 : c;
  grid.forEach((rowCells, r) => {
    const target = rowCells[col];
    if (!target) return;
    const origin = target.parentElement.rowIndex;
    if (origin !== r) return; // handled with its origin row
    const startsCol = grid[r].indexOf(target);
    const endsCol = startsCol + (target.colSpan || 1) - 1;
    const spansPast = right ? endsCol > col : startsCol < col;
    if (spansPast) { target.colSpan = (target.colSpan || 1) + 1; return; }
    const td = newCell(doc, target);
    target.parentNode.insertBefore(td, right ? target.nextSibling : target);
  });
}

export function deleteRow(table, cell) {
  const { r } = locate(table, cell);
  const tr = table.rows[r];
  if (!tr) return;
  if (table.rows.length === 1) { table.remove(); return; }
  buildGrid(table)[r].forEach((c) => {
    if (c.parentElement !== tr && (c.rowSpan || 1) > 1) c.rowSpan -= 1;
  });
  tr.remove();
}

export function deleteColumn(table, cell) {
  const { grid, c } = locate(table, cell);
  const cols = (grid[0] || []).length;
  if (cols <= 1) { table.remove(); return; }
  const seen = new Set();
  grid.forEach((rowCells) => {
    const t = rowCells[c];
    if (!t || seen.has(t)) return;
    seen.add(t);
    if ((t.colSpan || 1) > 1) t.colSpan -= 1; else t.remove();
  });
}

function moveContent(from, to) {
  const only = (n) => n.childNodes.length === 1 && n.firstChild.nodeName === 'BR';
  if (only(from)) return;
  if (only(to)) to.textContent = '';
  while (from.firstChild) to.appendChild(from.firstChild);
}

/** dir: 'right' | 'left' | 'below' | 'above'. Only merges neighbours that line up exactly. */
export function mergeCells(table, cell, dir) {
  const { grid, r, c } = locate(table, cell);
  const horizontal = dir === 'right' || dir === 'left';
  const nr = dir === 'below' ? r + (cell.rowSpan || 1) : dir === 'above' ? r - 1 : r;
  const nc = dir === 'right' ? c + (cell.colSpan || 1) : dir === 'left' ? c - 1 : c;
  const other = grid[nr] && grid[nr][nc];
  if (!other || other === cell) return false;
  if (horizontal && (other.rowSpan || 1) !== (cell.rowSpan || 1)) return false;
  if (!horizontal && (other.colSpan || 1) !== (cell.colSpan || 1)) return false;
  const keep = dir === 'left' || dir === 'above' ? other : cell;
  const drop = keep === cell ? other : cell;
  moveContent(drop, keep);
  if (horizontal) keep.colSpan = (keep.colSpan || 1) + (drop.colSpan || 1);
  else keep.rowSpan = (keep.rowSpan || 1) + (drop.rowSpan || 1);
  drop.remove();
  return true;
}

export function unmerge(table, cell) {
  const doc = table.ownerDocument;
  const { grid, r, c } = locate(table, cell);
  const rs = cell.rowSpan || 1;
  const cs = cell.colSpan || 1;
  if (rs === 1 && cs === 1) return false;
  cell.rowSpan = 1;
  cell.colSpan = 1;
  for (let i = 0; i < rs; i += 1) {
    for (let j = 0; j < cs; j += 1) {
      if (i === 0 && j === 0) continue;
      const td = newCell(doc, cell);
      const row = table.rows[r + i];
      if (!row) continue;
      // insert before the first existing cell located to the right of this slot
      let before = null;
      for (let k = c + j + 1; k < (grid[r + i] || []).length && !before; k += 1) {
        const cand = grid[r + i][k];
        if (cand && cand !== cell && cand.parentElement === row) before = cand;
      }
      row.insertBefore(td, before);
    }
  }
  return true;
}

/** Splits a cell into two columns ('vertical') or two rows ('horizontal'). */
export function splitCell(table, cell, mode) {
  const doc = table.ownerDocument;
  if (mode === 'vertical') {
    if ((cell.colSpan || 1) > 1) {
      const half = Math.floor(cell.colSpan / 2);
      cell.colSpan -= half;
      const td = newCell(doc, cell);
      td.colSpan = half;
      cell.parentNode.insertBefore(td, cell.nextSibling);
      return true;
    }
    const { r, c } = locate(table, cell);
    insertColumn(table, cell, true);
    // Other rows keep one wider cell instead of gaining a column.
    buildGrid(table).forEach((rowCells, i) => {
      if (i === r) return;
      const added = rowCells[c + 1];
      const left = rowCells[c];
      if (added && left && added !== left && added.parentElement.rowIndex === i && added.textContent === '') {
        added.remove();
        left.colSpan = (left.colSpan || 1) + 1;
      }
    });
    return true;
  }
  if ((cell.rowSpan || 1) > 1) {
    const half = Math.floor(cell.rowSpan / 2);
    cell.rowSpan -= half;
    const { r, c, grid } = locate(table, cell);
    const row = table.rows[r + cell.rowSpan];
    if (!row) return false;
    const td = newCell(doc, cell);
    td.rowSpan = half;
    let before = null;
    for (let k = c + 1; k < (grid[r + cell.rowSpan] || []).length && !before; k += 1) {
      const cand = grid[r + cell.rowSpan][k];
      if (cand && cand.parentElement === row) before = cand;
    }
    row.insertBefore(td, before);
    return true;
  }
  insertRow(table, cell, true);
  return true;
}

export function alignCell(cell, { v, h }) {
  if (v) cell.style.verticalAlign = v;
  if (h) cell.style.textAlign = h;
}

export function alignTable(table, how) {
  table.style.width = 'auto';
  table.style.marginLeft = how === 'left' ? '0' : 'auto';
  table.style.marginRight = how === 'right' ? '0' : 'auto';
  if (how === 'left') table.style.marginRight = 'auto';
  if (how === 'right') table.style.marginLeft = 'auto';
}

const sidesFor = (grid, r, c, mode) => {
  const rows = grid.length;
  const cols = (grid[0] || []).length;
  const top = r === 0;
  const bottom = r === rows - 1;
  const left = c === 0;
  const right = c === cols - 1;
  switch (mode) {
    case 'all': return { t: 1, r: 1, b: 1, l: 1 };
    case 'none': return { t: 0, r: 0, b: 0, l: 0 };
    case 'left': return { t: 0, r: 0, b: 0, l: left };
    case 'right': return { t: 0, r: right, b: 0, l: 0 };
    case 'top': return { t: top, r: 0, b: 0, l: 0 };
    case 'bottom': return { t: 0, r: 0, b: bottom, l: 0 };
    case 'inside': return { t: !top, r: !right, b: !bottom, l: !left };
    case 'outside': return { t: top, r: right, b: bottom, l: left };
    default: return null;
  }
};

/** mode: all | none | left | right | top | bottom | inside | outside. */
export function setBorders(table, mode, { color = '#94a3b8', width = '1px', style = 'solid' } = {}) {
  const grid = buildGrid(table);
  const seen = new Set();
  grid.forEach((rowCells, r) => {
    rowCells.forEach((cell, c) => {
      if (!cell || seen.has(cell)) return;
      seen.add(cell);
      const s = sidesFor(grid, r, c, mode);
      if (!s) return;
      const val = (on) => (on ? `${width} ${style} ${color}` : 'none');
      cell.style.borderTop = val(s.t);
      cell.style.borderRight = val(s.r);
      cell.style.borderBottom = val(s.b);
      cell.style.borderLeft = val(s.l);
    });
  });
}

/** Recolours / re-widths / re-styles every border that is currently drawn. */
export function restyleBorders(table, { color, width, style }) {
  Array.from(table.querySelectorAll('td, th')).forEach((cell) => {
    ['Top', 'Right', 'Bottom', 'Left'].forEach((side) => {
      const cur = cell.style[`border${side}Style`];
      if (!cur || cur === 'none') return;
      if (color) cell.style[`border${side}Color`] = color;
      if (width) cell.style[`border${side}Width`] = width;
      if (style) cell.style[`border${side}Style`] = style;
    });
  });
}

export function applyFormat(table, name) {
  const n = String(name || '');
  const dark = '#000000';
  const light = '#cccccc';
  if (/^Table Grid Light/i.test(n)) setBorders(table, 'all', { color: light });
  else if (/^Table Grid/i.test(n) || /^Grid Table/i.test(n)) setBorders(table, 'all', { color: dark });
  else if (/^List Table/i.test(n)) setBorders(table, 'inside', { color: light });
  else setBorders(table, 'none');
  const header = Array.from(table.rows[0] ? table.rows[0].cells : []);
  if (/Grid Table [23]|List Table [23]|Plain Table [2-5]/i.test(n)) header.forEach((c) => { c.style.fontWeight = '700'; });
  if (/Grid Table 2|List Table 2/i.test(n)) header.forEach((c) => { c.style.backgroundColor = '#e2e8f0'; });
}

export function toggleOption(table, option) {
  const rows = Array.from(table.rows);
  switch (option) {
    case 'Header Row': {
      const on = !(rows[0] && rows[0].dataset.rteHeader);
      rows.forEach((tr, i) => {
        Array.from(tr.cells).forEach((c) => { if (i === 0) { c.style.fontWeight = on ? '700' : ''; c.style.backgroundColor = on ? '#e2e8f0' : ''; } });
        if (i === 0) { if (on) tr.dataset.rteHeader = '1'; else delete tr.dataset.rteHeader; }
      });
      break;
    }
    case 'First Column':
      rows.forEach((tr) => { const c = tr.cells[0]; if (c) c.style.fontWeight = c.style.fontWeight === '700' ? '' : '700'; });
      break;
    case 'Banded Rows':
      rows.forEach((tr, i) => Array.from(tr.cells).forEach((c) => { c.style.backgroundColor = i % 2 ? '#f1f5f9' : ''; }));
      break;
    case 'Banded Columns':
      rows.forEach((tr) => Array.from(tr.cells).forEach((c, i) => { c.style.backgroundColor = i % 2 ? '#f1f5f9' : ''; }));
      break;
    default: break;
  }
}

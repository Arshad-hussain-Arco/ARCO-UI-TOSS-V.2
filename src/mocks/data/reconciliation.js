/**
 * Mock data and reconciliation engine for the File Reconciliation System wizard.
 * The existing transaction/filter constants are preserved below for backward compat.
 */

// ─── Legacy constants (used by old service, kept to avoid import errors) ──────

export const RECONCILIATION_SOURCES = {
  systemA: '2026-05-08 09:15',
  systemB: '2026-05-08 09:20',
};

export const RECONCILIATION_TRANSACTIONS = [
  { id: '1', date: '2026-05-08', reference: 'TXN-99201-X', description: 'Internal Settlement Transfer', sideA: { amount: 1250000, currency: 'USD', system: 'Ledger' }, sideB: { amount: 1250000, currency: 'USD', system: 'Swift' }, status: 'matched', difference: 0 },
  { id: '2', date: '2026-05-08', reference: 'TXN-99202-B', description: 'Client Disbursement #A88', sideA: { amount: 4500.5, currency: 'EUR', system: 'Ledger' }, sideB: { amount: 4500, currency: 'EUR', system: 'Swift' }, status: 'partial', difference: 0.5 },
  { id: '3', date: '2026-05-07', reference: 'TXN-99198-Y', description: 'Inter-bank Margin Call', sideA: { amount: 3200000, currency: 'GBP', system: 'Ledger' }, sideB: null, status: 'unmatched', difference: 3200000 },
  { id: '4', date: '2026-05-08', reference: 'TXN-99205-C', description: 'Custody Fee Payment', sideA: { amount: 1250, currency: 'USD', system: 'Ledger' }, sideB: { amount: 1250, currency: 'USD', system: 'Swift' }, status: 'matched', difference: 0 },
  { id: '5', date: '2026-05-08', reference: 'TXN-99206-D', description: 'FX Spot Trade - JPY/USD', sideA: { amount: 880200, currency: 'JPY', system: 'Ledger' }, sideB: { amount: 880200, currency: 'JPY', system: 'Swift' }, status: 'pending', difference: 0 },
  { id: '6', date: '2026-05-08', reference: 'TXN-99207-E', description: 'Dividend Credit - Equity Pool', sideA: { amount: 15400, currency: 'USD', system: 'Ledger' }, sideB: null, status: 'unmatched', difference: 15400 },
  { id: '7', date: '2026-05-08', reference: 'TXN-99208-F', description: 'Treasury Bond Redemption', sideA: { amount: 5000000, currency: 'USD', system: 'Ledger' }, sideB: { amount: 5000000, currency: 'USD', system: 'Swift' }, status: 'matched', difference: 0 },
];

export const RECONCILIATION_STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'matched', label: 'Matched' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'partial', label: 'Partial Match' },
  { value: 'pending', label: 'Pending' },
];

export const RECONCILIATION_DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
];

// ─── Wizard: mock column schemas & data ───────────────────────────────────────

/** Simulated columns for File 1 (source) */
export const MOCK_FILE1_COLUMNS = [
  'TradeID', 'TradeDate', 'SettlementDate', 'Instrument', 'ISIN', 'Quantity',
  'Price', 'Amount', 'Currency', 'Counterparty', 'Portfolio', 'Trader', 'Status',
];

/** Simulated columns for File 2 (target/destination) */
export const MOCK_FILE2_COLUMNS = [
  'TradeID', 'Trade_Date', 'Settlement_Date', 'Instrument', 'ISIN', 'Qty',
  'Price', 'NetAmount', 'Ccy', 'CounterpartyID', 'Portfolio', 'BookedBy', 'TradeStatus',
];

/** Generate N preview rows for either file */
export function generatePreviewRows(columns, n = 5) {
  const samples = {
    TradeID: (i) => `TRD-${10001 + i}`,
    Trade_Date: (i) => `2026-05-${(8 + i).toString().padStart(2, '0')}`,
    TradeDate: (i) => `2026-05-${(8 + i).toString().padStart(2, '0')}`,
    SettlementDate: (i) => `2026-05-${(10 + i).toString().padStart(2, '0')}`,
    Settlement_Date: (i) => `2026-05-${(10 + i).toString().padStart(2, '0')}`,
    Instrument: (i) => ['EQUITY', 'BOND', 'FX', 'DERIVATIVE', 'COMMODITY'][i % 5],
    ISIN: (i) => `US${String(100000000 + i * 11).padStart(9, '0')}X`,
    Quantity: (i) => String(1000 * (i + 1)),
    Qty: (i) => String(1000 * (i + 1)),
    Price: (i) => (100.25 + i * 0.5).toFixed(2),
    Amount: (i) => (100250 + i * 500).toFixed(2),
    NetAmount: (i) => (100250 + i * 500).toFixed(2),
    Currency: () => 'USD',
    Ccy: () => 'USD',
    Counterparty: (i) => `CP-${200 + i}`,
    CounterpartyID: (i) => `CP-${200 + i}`,
    Portfolio: (i) => ['TRADING', 'BANKING', 'HEDGE'][i % 3],
    Trader: (i) => ['A. Smith', 'J. Lee', 'M. Patel', 'R. Khan', 'L. Wang'][i % 5],
    BookedBy: (i) => ['A. Smith', 'J. Lee', 'M. Patel', 'R. Khan', 'L. Wang'][i % 5],
    Status: () => 'CONFIRMED',
    TradeStatus: () => 'CONFIRMED',
  };

  return Array.from({ length: n }, (_, i) => {
    const row = {};
    columns.forEach((col) => {
      row[col] = samples[col] ? samples[col](i) : `Value_${i + 1}`;
    });
    return row;
  });
}

// ─── Wizard: mock reconciliation engine ───────────────────────────────────────

/**
 * Runs a mock reconciliation given the column mapping configuration.
 * Returns realistic-looking results split into matched / mismatched / missing / duplicates.
 *
 * @param {Array<{src: string, dst: string, dataType: string, tolerance: string, exclude: boolean}>} colMappings
 * @returns {{ matched: object[], mismatched: object[], missingInDst: object[], missingInSrc: object[], dupSrc: object[], dupDst: object[], stats: object }}
 */
export function runMockReconciliation(colMappings) {
  const activeMappings = colMappings.filter((m) => m.dst && m.dst !== '__skip__' && !m.exclude);
  const totalRecords = 1000;
  const matchedCount = 847;
  const mismatchedCount = 98;
  const missingDstCount = 32;
  const missingSrcCount = 18;
  const dupSrcCount = 5;
  const dupDstCount = 4;

  // Build mismatched rows with difference column
  const mismatchedRows = Array.from({ length: Math.min(mismatchedCount, 20) }, (_, i) => {
    const row = { _key: `TRD-${10001 + i}` };
    const diffCols = [];
    activeMappings.slice(0, 3).forEach((m, mi) => {
      const srcVal = mi === 1 ? (100.25 + i * 0.5).toFixed(2) : `Val_${i}_SRC`;
      const dstVal = mi === 1 ? (99.75 + i * 0.5).toFixed(2) : `Val_${i}_DST`;
      row[`_src_${m.src}`] = srcVal;
      row[`_dst_${m.dst}`] = dstVal;
      if (mi === 1) diffCols.push(`${m.src}: "${srcVal}" → "${dstVal}"`);
    });
    row._differences = diffCols.join('; ') || `Amount: "100.25" → "99.75"`;
    return row;
  });

  // Matched rows
  const matchedRows = Array.from({ length: Math.min(matchedCount, 20) }, (_, i) => {
    const row = { _key: `TRD-${20001 + i}` };
    activeMappings.forEach((m) => {
      const val = `Match_${i + 1}`;
      row[`_src_${m.src}`] = val;
      row[`_dst_${m.dst}`] = val;
    });
    return row;
  });

  // Missing in destination
  const missingInDst = Array.from({ length: Math.min(missingDstCount, 15) }, (_, i) => {
    const row = { _key: `TRD-${30001 + i}` };
    activeMappings.forEach((m) => { row[m.src] = `SrcOnly_${i + 1}`; });
    return row;
  });

  // Missing in source
  const missingInSrc = Array.from({ length: Math.min(missingSrcCount, 10) }, (_, i) => {
    const row = { _key: `TRD-${40001 + i}` };
    activeMappings.forEach((m) => { row[m.dst] = `DstOnly_${i + 1}`; });
    return row;
  });

  // Duplicates in source
  const dupSrc = Array.from({ length: dupSrcCount }, (_, i) => ({
    _key: `TRD-${50001 + i}`,
    _count: 2 + (i % 2),
    TradeDate: `2026-05-${(8 + i).toString().padStart(2, '0')}`,
    Amount: (5000 + i * 100).toFixed(2),
  }));

  // Duplicates in destination
  const dupDst = Array.from({ length: dupDstCount }, (_, i) => ({
    _key: `TRD-${60001 + i}`,
    _count: 2,
    Trade_Date: `2026-05-${(9 + i).toString().padStart(2, '0')}`,
    NetAmount: (4800 + i * 100).toFixed(2),
  }));

  const matchRate = ((matchedCount / totalRecords) * 100).toFixed(1);

  return {
    matched: matchedRows,
    mismatched: mismatchedRows,
    missingInDst,
    missingInSrc,
    dupSrc,
    dupDst,
    stats: {
      total: totalRecords,
      matched: matchedCount,
      mismatched: mismatchedCount,
      missing: missingDstCount + missingSrcCount,
      duplicates: dupSrcCount + dupDstCount,
      matchRate: parseFloat(matchRate),
    },
    activeMappings,
  };
}

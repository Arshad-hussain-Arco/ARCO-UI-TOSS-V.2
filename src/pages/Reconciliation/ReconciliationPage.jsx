import { useCallback, useMemo, useState, useEffect } from 'react';
import { Check, ArrowUpRight, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '@components/feedback/Spinner/Spinner';

import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { reconciliationService } from '@services/reconciliationService';
import { MOCK_FILE1_COLUMNS } from '@mocks/data/reconciliation';

import { StepUpload } from './steps/StepUpload';
import { StepSelectKeys } from './steps/StepSelectKeys';
import { StepMapColumns } from './steps/StepMapColumns';
import { StepResults } from './steps/StepResults';
import { ROUTES } from '@constants/routes';
import './ReconciliationPage.css';

const STEPS = [
  { id: 1, label: 'Upload Files' },
  { id: 2, label: 'Select Keys' },
  { id: 3, label: 'Map Columns' },
  { id: 4, label: 'Results' },
];

function StepperBar({ currentStep }) {
  return (
    <nav className="rwiz-stepper" role="navigation" aria-label="Reconciliation steps">
      {STEPS.map((step, i) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        return (
          <div key={step.id} className="rwiz-stepper-item">
            <div
              className={[
                'rwiz-step-node',
                isActive ? 'rwiz-step-node--active' : '',
                isCompleted ? 'rwiz-step-node--done' : '',
              ]
                .join(' ')
                .trim()}
            >
              {isCompleted ? <Check size={11} strokeWidth={3} /> : <span>{step.id}</span>}
            </div>
            <span
              className={[
                'rwiz-step-label',
                isActive ? 'rwiz-step-label--active' : '',
                isCompleted ? 'rwiz-step-label--done' : '',
              ]
                .join(' ')
                .trim()}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`rwiz-step-connector${isCompleted ? ' rwiz-step-connector--done' : ''}`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function buildInitialMappings(srcCols, columnMeta = {}) {
  return srcCols.map((src) => {
    return {
      src,
      dst: '__skip__',
      dataType: columnMeta?.[src]?.dataType || 'Categorical',
      tolerance: '0.00',
      roundOff: 'None',
      exclude: false,
    };
  });
}

function normalizeRow(row, activeMappings, defaultKeyCols = []) {
  if (!row) return row;
  const normalized = { ...row };

  // Helper for case-insensitive lookup
  const getVal = (obj, key) => {
    if (obj[key] !== undefined) return obj[key];
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
    return foundKey ? obj[foundKey] : undefined;
  };

  // 1. Detect _key
  // 1. Detect _key
  if (normalized._key === undefined) {
    if (row.key !== undefined) {
      normalized._key = row.key;
    } else if (getVal(row, 'key') !== undefined) {
      normalized._key = getVal(row, 'key');
    } else if (getVal(row, '_id') !== undefined) {
      normalized._key = getVal(row, '_id');
    } else if (getVal(row, 'id') !== undefined) {
      normalized._key = getVal(row, 'id');
    } else {
      // Try to use key column from row1 (backend format)
      const keyCol = defaultKeyCols[0] || (activeMappings[0] ? activeMappings[0].src : null);

      if (keyCol) {
        normalized._key =
          row.row1?.[keyCol] ??
          getVal(row, `_src_${keyCol}`) ??
          getVal(row, keyCol) ??
          getVal(row, `Source_${keyCol}`) ??
          getVal(row, `File1_${keyCol}`) ??
          '—';
      } else {
        normalized._key = '—';
      }
    }
  }

  // 2. Detect differences
  if (normalized._differences === undefined) {
    normalized._differences = getVal(row, 'differences') ?? getVal(row, 'diff') ?? getVal(row, 'difference') ?? '';
  }

  // 3. Map values for Matched / Mismatched tables
  activeMappings.forEach((m) => {
    const src = m.src;
    const dst = m.dst;

    // Resolve source value
    if (normalized[`_src_${src}`] === undefined) {

      if (row.row1 && row.row1[src] !== undefined) {
        normalized[`_src_${src}`] = row.row1[src];
      }
      else if (getVal(row, `Source_${src}`) !== undefined)
        normalized[`_src_${src}`] = getVal(row, `Source_${src}`);
      else if (getVal(row, `File1_${src}`) !== undefined)
        normalized[`_src_${src}`] = getVal(row, `File1_${src}`);
      else if (getVal(row, `${src}_src`) !== undefined)
        normalized[`_src_${src}`] = getVal(row, `${src}_src`);
      else if (getVal(row, src) !== undefined)
        normalized[`_src_${src}`] = getVal(row, src);
    }

    // Resolve destination value (UI uses _dst_${src} as the key for rendering!)
    if (normalized[`_dst_${src}`] === undefined) {

      if (row.row2 && row.row2[dst] !== undefined) {
        normalized[`_dst_${src}`] = row.row2[dst];
      }
      else if (getVal(row, `_dst_${dst}`) !== undefined)
        normalized[`_dst_${src}`] = getVal(row, `_dst_${dst}`);
      else if (getVal(row, `Target_${dst}`) !== undefined)
        normalized[`_dst_${src}`] = getVal(row, `Target_${dst}`);
      else if (getVal(row, `Destination_${dst}`) !== undefined)
        normalized[`_dst_${src}`] = getVal(row, `Destination_${dst}`);
      else if (getVal(row, `File2_${dst}`) !== undefined)
        normalized[`_dst_${src}`] = getVal(row, `File2_${dst}`);
      else if (getVal(row, `${dst}_dst`) !== undefined)
        normalized[`_dst_${src}`] = getVal(row, `${dst}_dst`);
      else if (getVal(row, dst) !== undefined)
        normalized[`_dst_${src}`] = getVal(row, dst);
    }
  });

  return normalized;
}

export function ReconciliationPage() {
  useDocumentTitle('File Reconciliation');
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([null, null]);
  const [processingFiles, setProcessingFiles] = useState([false, false]);
  const [keyColumns, setKeyColumns] = useState({ file1: [], file2: [] });
  const [colMappings, setColMappings] = useState(() =>
    buildInitialMappings(MOCK_FILE1_COLUMNS, []),
  );
  const [results, setResults] = useState(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcilePhase, setReconcilePhase] = useState(0);
  const [reconcileError, setReconcileError] = useState(null);

  // Cycle through status messages while processing
  const STATUS_MESSAGES = [
    'Uploading files to server…',
    'Parsing and indexing records…',
    'Matching keys across files…',
    'Computing column-level differences…',
    'Generating reconciliation report…',
  ];

  useEffect(() => {
    if (!isReconciling) return;
    setReconcilePhase(0);
    const id = setInterval(() => {
      setReconcilePhase((p) => (p < STATUS_MESSAGES.length - 1 ? p + 1 : p));
    }, 1800);
    return () => clearInterval(id);
  }, [isReconciling]);

  const handleFilesChange = useCallback((updater) => {
    setFiles((prevFiles) => {
      const updated = typeof updater === 'function' ? updater(prevFiles) : updater;
      // Rebuild mappings only if file 1 was added or changed
      if (updated[0]?.columns && (!prevFiles[0] || prevFiles[0].name !== updated[0].name)) {
        setTimeout(() => {
          setColMappings(buildInitialMappings(updated[0].columns, updated[0].columnMeta));
        }, 0);
      }
      return updated;
    });
  }, []);

  const handleProcessingChange = useCallback((index, value) => {
    setProcessingFiles((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const goToStep2 = useCallback(() => setStep(2), []);
  const goToStep3 = useCallback(() => setStep(3), []);
  const runReconciliation = useCallback(async (page = 1) => {
    setIsReconciling(true);
    setReconcileError(null);
    try {
      const sourceFile = files[0];
      const destinationFile = files[1];

      const activeMappings = colMappings.filter((m) => !m.exclude && m.dst && m.dst !== '__skip__');

      const resultData = await reconciliationService.reconcileFiles({
        sourceFileId: sourceFile?.fileId ?? null,
        destinationFileId: destinationFile?.fileId ?? null,
        sourceFile: sourceFile?.fileObject ?? null,
        destinationFile: destinationFile?.fileObject ?? null,
        sourceKeyColumn: keyColumns.file1[0] ?? null,
        destinationKeyColumn: keyColumns.file2[0] ?? null,
        sourceCompositeColumns: keyColumns.file1.length > 1 ? keyColumns.file1 : [],
        destinationCompositeColumns: keyColumns.file2.length > 1 ? keyColumns.file2 : [],
        columnMappings: activeMappings.reduce((acc, m) => {
          acc[m.src] = m.dst;
          return acc;
        }, {}),
        columnMeta: colMappings.reduce((acc, m) => {
          acc[m.src] = {
            ...(files[0]?.columnMeta?.[m.src] || {}),
            dataType: m.dataType,
            tolerance: m.tolerance ? parseFloat(m.tolerance) : 0,
            roundOff: m.roundOff,
            excludeFromComparison: m.exclude || m.dst === '__skip__',
          };
          return acc;
        }, {}),
        columnPathMap1: files[0]?.columnPathMap ?? null,
        columnPathMap2: files[1]?.columnPathMap ?? null,
        page,
        pageSize: 50,
      });

      const transformedResults = {
        stats: {
          matched: resultData.matched?.total ?? 0,
          mismatched: resultData.mismatched?.total ?? 0,
          missing: (resultData.onlyInFile1?.total ?? 0) + (resultData.onlyInFile2?.total ?? 0),
          duplicates: (resultData.duplicatesInFile1?.total ?? 0) + (resultData.duplicatesInFile2?.total ?? 0),
          total: (resultData.totalFile1 ?? 0) + (resultData.totalFile2 ?? 0),
          matchRate: resultData.matchRate ?? 0,
        },
        matched: {
          ...resultData.matched,
          records: (resultData.matched?.records ?? []).map((r) => normalizeRow(r, activeMappings, keyColumns.file1))
        },
        mismatched: {
          ...resultData.mismatched,
          records: (resultData.mismatched?.records ?? []).map((r) => normalizeRow(r, activeMappings, keyColumns.file1))
        },
        missingInDst: {
          ...resultData.onlyInFile1,
          records: (resultData.onlyInFile1?.records ?? []).map((r) => normalizeRow(r, activeMappings, keyColumns.file1))
        },
        missingInSrc: {
          ...resultData.onlyInFile2,
          records: (resultData.onlyInFile2?.records ?? []).map((r) => normalizeRow(r, activeMappings, keyColumns.file2))
        },
        dupSrc: {
          ...resultData.duplicatesInFile1,
          records: (resultData.duplicatesInFile1?.records ?? []).map((r) => normalizeRow(r, activeMappings, keyColumns.file1))
        },
        dupDst: {
          ...resultData.duplicatesInFile2,
          records: (resultData.duplicatesInFile2?.records ?? []).map((r) => normalizeRow(r, activeMappings, keyColumns.file2))
        },
        activeMappings,
        rawResults: resultData,
      };

      setResults(transformedResults);
      setIsReconciling(false);
      toast.success(`Reconciliation complete — ${transformedResults.stats.matched} matched, ${transformedResults.stats.mismatched} mismatched.`);
      setStep(4);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        'Unable to reconcile the selected files.';
      setIsReconciling(false);
      setReconcileError(message);
      toast.error(message);
    }
  }, [colMappings, files, keyColumns, toast]);

  const reset = useCallback(() => {
    setStep(1);
    setFiles([null, null]);
    setKeyColumns({ file1: [], file2: [] });
    setColMappings(buildInitialMappings(MOCK_FILE1_COLUMNS, []));
    setResults(null);
    setReconcileError(null);
  }, []);

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return (
          <StepUpload
            files={files}
            processingFiles={processingFiles}
            onProcessingChange={handleProcessingChange}
            onFilesChange={handleFilesChange}
            onNext={goToStep2}
          />
        );
      case 2:
        return (
          <StepSelectKeys
            files={files}
            processingFiles={processingFiles}
            keyColumns={keyColumns}
            onKeyColumnsChange={setKeyColumns}
            onBack={() => setStep(1)}
            onNext={goToStep3}
          />
        );
      case 3:
        return (
          <StepMapColumns
            files={files}
            colMappings={colMappings}
            onColMappingsChange={setColMappings}
            onBack={() => setStep(2)}
            onRun={() => runReconciliation(1)}
            isReconciling={isReconciling}
            reconcileError={reconcileError}
            onClearError={() => setReconcileError(null)}
          />
        );
      case 4:
        return results ? (
          <StepResults
            results={results}
            file1Name={files[0]?.name || ''}
            file2Name={files[1]?.name || ''}
            onReset={reset}
            onPageChange={(page) => runReconciliation(page)}
          />
        ) : null;
      default:
        return null;
    }
  }, [
    step,
    files,
    keyColumns,
    colMappings,
    results,
    processingFiles,
    handleFilesChange,
    handleProcessingChange,
    goToStep2,
    goToStep3,
    runReconciliation,
    reset,
    isReconciling,
    reconcileError,
  ]);

  return (
    <div className="rwiz-page">
      {/* Top Bar / Header Breadcrumb */}
      <div className="rwiz-page-header">
        <div className="rwiz-page-title-wrap">
          <FileText className="rwiz-page-title-icon" size={24} />
          <h1 className="rwiz-page-title">File Reconciliation System</h1>
          <Link to={ROUTES.RECONCILIATION_USER_GUIDE} target="_blank" rel="noopener noreferrer" className="rwiz-page-guide-btn">
            <FileText size={14} />
            <span>User Guide</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      {/* Stepper (Outside Card) */}
      <StepperBar currentStep={step} />

      {/* Main Unified Content Container */}
      <div className="rwiz-step-card">{stepContent}</div>

      {/* Full-screen Processing Overlay */}
      {isReconciling && (
        <div className="rwiz-reconcile-overlay" role="status" aria-live="polite">
          <div className="rwiz-reconcile-card">
            <div className="rwiz-reconcile-spinner">
              <Spinner size="lg" className="rwiz-reconcile-spinner-icon" />
            </div>
            <h3 className="rwiz-reconcile-title">Running Reconciliation</h3>
            <p className="rwiz-reconcile-phase">{STATUS_MESSAGES[reconcilePhase]}</p>
            <p className="rwiz-reconcile-hint">Please wait, this may take a moment…</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReconciliationPage;

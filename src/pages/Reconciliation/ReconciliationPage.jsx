import { useCallback, useMemo, useState } from 'react';
import { Check, ArrowUpRight } from 'lucide-react';

import { useDocumentTitle } from '@hooks/useDocumentTitle';
import {
  MOCK_FILE1_COLUMNS,
  runMockReconciliation,
} from '@mocks/data/reconciliation';

import { StepUpload } from './steps/StepUpload';
import { StepSelectKeys } from './steps/StepSelectKeys';
import { StepMapColumns } from './steps/StepMapColumns';
import { StepResults } from './steps/StepResults';
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
              ].join(' ').trim()}
            >
              {isCompleted ? <Check size={11} strokeWidth={3} /> : <span>{step.id}</span>}
            </div>
            <span
              className={[
                'rwiz-step-label',
                isActive ? 'rwiz-step-label--active' : '',
                isCompleted ? 'rwiz-step-label--done' : '',
              ].join(' ').trim()}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`rwiz-step-connector${isCompleted ? ' rwiz-step-connector--done' : ''}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function buildInitialMappings(srcCols, dstCols) {
  return srcCols.map((src) => {
    const autoMatch = dstCols.find((d) => d.toLowerCase() === src.toLowerCase());
    return {
      src,
      dst: autoMatch ?? '__skip__',
      dataType: 'Categorical',
      tolerance: '0.00',
      roundOff: 'None',
      exclude: false,
    };
  });
}

export function ReconciliationPage() {
  useDocumentTitle('File Reconciliation');

  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([null, null]);
  const [keyColumns, setKeyColumns] = useState({ file1: [], file2: [] });
  const [colMappings, setColMappings] = useState(() =>
    buildInitialMappings(MOCK_FILE1_COLUMNS, []),
  );
  const [results, setResults] = useState(null);

  const handleFilesChange = useCallback((updated) => {
    setFiles(updated);
    if (updated[0]?.columns) {
      setColMappings(buildInitialMappings(updated[0].columns, updated[1]?.columns ?? []));
    }
  }, []);

  const goToStep2 = useCallback(() => setStep(2), []);
  const goToStep3 = useCallback(() => setStep(3), []);
  const runReconciliation = useCallback(() => {
    const resultData = runMockReconciliation(colMappings);
    setResults(resultData);
    setStep(4);
  }, [colMappings]);

  const reset = useCallback(() => {
    setStep(1);
    setFiles([null, null]);
    setKeyColumns({ file1: [], file2: [] });
    setColMappings(buildInitialMappings(MOCK_FILE1_COLUMNS, []));
    setResults(null);
  }, []);

  const stepContent = useMemo(() => {
    switch (step) {
      case 1:
        return (
          <StepUpload
            files={files}
            onFilesChange={handleFilesChange}
            onNext={goToStep2}
          />
        );
      case 2:
        return (
          <StepSelectKeys
            files={files}
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
            onRun={runReconciliation}
          />
        );
      case 4:
        return results ? <StepResults results={results} onReset={reset} /> : null;
      default:
        return null;
    }
  }, [step, files, keyColumns, colMappings, results, handleFilesChange, goToStep2, goToStep3, runReconciliation, reset]);

  return (
    <div className="rwiz-page">
      {/* Top Bar / Header Breadcrumb */}
      <div className="rwiz-page-header">
        <h1 className="rwiz-page-title">File Reconciliation System</h1>
        <button type="button" className="rwiz-page-guide-btn">
          User Guide <ArrowUpRight size={14} />
        </button>
      </div>

      {/* Stepper (Outside Card) */}
      <StepperBar currentStep={step} />

      {/* Main Unified Content Container */}
      <div className="rwiz-step-card">
        {stepContent}
      </div>
    </div>
  );
}

export default ReconciliationPage;

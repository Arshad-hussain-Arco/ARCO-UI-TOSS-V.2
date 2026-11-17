import React, { useMemo } from 'react';
import { Layers, Cpu, Activity, Server, User, ChevronRight, RotateCcw } from 'lucide-react';

export function ScopeNavigator({
  scope,
  onChangeScope,
  folders = [],
  allJobs = [],
  serverCapacity = null,
  waitingForSlot = false,
  startedBy = null,
}) {
  // Unique sorted folder names
  const folderNames = useMemo(() => {
    const set = new Set();
    for (const f of folders) {
      if (f.folder) set.add(f.folder);
      else if (f.name) set.add(f.name);
    }
    for (const j of allJobs) {
      if (j.group) set.add(j.group);
      if (j.folder) set.add(j.folder);
    }
    return Array.from(set).sort();
  }, [folders, allJobs]);

  // Jobs filtered by selected folder (if any) or all jobs
  const availableJobs = useMemo(() => {
    let list = allJobs;
    if (scope.type === 'workflow' && scope.folder) {
      list = list.filter((j) => (j.group || j.folder) === scope.folder);
    }
    const names = new Set(list.map((j) => j.name || j.job).filter(Boolean));
    return Array.from(names).sort();
  }, [allJobs, scope.type, scope.folder]);

  const handleTypeChange = (newType) => {
    if (newType === 'xml') {
      onChangeScope({ type: 'xml', folder: null, job: null });
    } else if (newType === 'workflow') {
      const defaultFolder = scope.folder || folderNames[0] || 'EOD-CORE';
      onChangeScope({ type: 'workflow', folder: defaultFolder, job: null });
    } else if (newType === 'job') {
      const defaultJob = scope.job || availableJobs[0] || '';
      onChangeScope({
        type: 'job',
        folder: scope.folder || null,
        job: defaultJob,
      });
    }
  };

  return (
    <div className="cr-scope-navigator">
      <div className="cr-scope-left">
        <div className="cr-scope-pill-group">
          {/* 1. Whole XML File */}
          <button
            type="button"
            className={`cr-scope-toggle-btn ${scope.type === 'xml' ? 'is-active' : ''}`}
            onClick={() => handleTypeChange('xml')}
          >
            <Layers size={13} />
            <span>Whole XML File</span>
          </button>

          {/* 2. Workflow / Folder */}
          <button
            type="button"
            className={`cr-scope-toggle-btn ${scope.type === 'workflow' ? 'is-active' : ''}`}
            onClick={() => handleTypeChange('workflow')}
          >
            <Cpu size={13} />
            <span>Workflow (Folder)</span>
          </button>

          {/* 3. Particular Job */}
          <button
            type="button"
            className={`cr-scope-toggle-btn ${scope.type === 'job' ? 'is-active' : ''}`}
            onClick={() => handleTypeChange('job')}
          >
            <Activity size={13} />
            <span>Particular Job</span>
          </button>
        </div>
      </div>

      <div className="cr-scope-right">
        {/* Scope Context Controls */}
        {scope.type === 'workflow' && (
          <div className="cr-scope-selector-box">
            <span className="cr-scope-context-label">Selected Workflow:</span>
            <select
              value={scope.folder || ''}
              onChange={(e) =>
                onChangeScope({ ...scope, folder: e.target.value, job: null })
              }
              className="cr-scope-select"
            >
              {folderNames.map((fn) => (
                <option key={fn} value={fn}>
                  {fn}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope.type === 'job' && (
          <div className="cr-scope-selector-box">
            {scope.folder && (
              <>
                <span className="cr-scope-context-label">Folder:</span>
                <span className="cr-scope-val-tag">{scope.folder}</span>
                <ChevronRight size={13} style={{ opacity: 0.5 }} />
              </>
            )}
            <span className="cr-scope-context-label">Selected Job:</span>
            <select
              value={scope.job || ''}
              onChange={(e) =>
                onChangeScope({ ...scope, job: e.target.value })
              }
              className="cr-scope-select"
            >
              {availableJobs.map((jn) => (
                <option key={jn} value={jn}>
                  {jn}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope.type !== 'xml' && (
          <button
            type="button"
            className="cr-btn sm outline cr-scope-reset-btn"
            onClick={() => onChangeScope({ type: 'xml', folder: null, job: null })}
            title="Reset scope to Whole XML File"
          >
            <RotateCcw size={12} />
            <span>Reset to Whole XML</span>
          </button>
        )}

        {/* Server Slots Pill replacing Target XML */}
        {serverCapacity?.display_label ? (
          <span
            className="cr-server-capacity-pill"
            style={{
              height: '28px',
              boxSizing: 'border-box',
              fontWeight: 600,
              fontSize: '12px',
              padding: '0 10px',
              borderRadius: '6px',
              backgroundColor: waitingForSlot || serverCapacity.any_full ? 'rgba(217, 119, 6, 0.1)' : '#f8fafc',
              color: waitingForSlot || serverCapacity.any_full ? '#b45309' : '#475569',
              border: `1px solid ${waitingForSlot || serverCapacity.any_full ? 'rgba(217, 119, 6, 0.35)' : '#cbd5e1'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.01em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
            title={
              serverCapacity.servers
                ?.map(
                  (s) =>
                    `${s.target_name}: ${s.in_use}/${s.limit ?? '∞'} in use${s.holders?.length ? ` (by: ${s.holders.join(', ')})` : ''}`
                )
                .join('\n') || serverCapacity.display_label
            }
          >
            <Server
              size={13}
              style={{ width: '13px', height: '13px', opacity: 0.85, flexShrink: 0 }}
            />
            <span
              className="cr-pill-label"
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                opacity: 0.75,
                fontWeight: 700,
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1,
              }}
            >
              Server Slots:
            </span>
            <span
              className="cr-pill-value"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1,
                fontWeight: 600,
              }}
            >
              {serverCapacity.display_label}
            </span>
          </span>
        ) : null}

        {/* Triggered by Pill (if run is active) */}
        {startedBy ? (
          <span
            className="cr-started-by-pill"
            style={{
              height: '28px',
              boxSizing: 'border-box',
              fontSize: '12px',
              padding: '0 10px',
              borderRadius: '6px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.01em',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
            title={`Triggered by: ${startedBy}`}
          >
            <User
              size={13}
              style={{ width: '13px', height: '13px', opacity: 0.85, flexShrink: 0 }}
            />
            <span
              className="cr-pill-label"
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                opacity: 0.75,
                fontWeight: 700,
                letterSpacing: '0.02em',
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1,
              }}
            >
              Triggered by:
            </span>
            <span
              className="cr-pill-value"
              style={{
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                lineHeight: 1,
              }}
            >
              {startedBy}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default ScopeNavigator;

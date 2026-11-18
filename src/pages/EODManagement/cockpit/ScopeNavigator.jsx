import React, { useMemo } from 'react';
import { Layers, Cpu, Server, User } from 'lucide-react';

export function ScopeNavigator({
  scope,
  onChangeScope,
  folders = [],
  allJobs = [],
  serverCapacity = null,
  waitingForSlot = false,
  startedBy = null,
  onOpenServersQueue = null,
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

  const handleTypeChange = (newType) => {
    if (newType === 'xml') {
      onChangeScope({ type: 'xml', folder: null, job: null });
    } else if (newType === 'workflow') {
      const defaultFolder = scope.folder || folderNames[0] || 'EOD-CORE';
      onChangeScope({ type: 'workflow', folder: defaultFolder, job: null });
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

        {/* Server Slots Pill replacing Target XML */}
        {serverCapacity?.display_label ? (
          <span
            role={onOpenServersQueue ? 'button' : undefined}
            tabIndex={onOpenServersQueue ? 0 : undefined}
            onClick={onOpenServersQueue || undefined}
            onKeyDown={(e) => {
              if (onOpenServersQueue && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenServersQueue();
              }
            }}
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
              cursor: onOpenServersQueue ? 'pointer' : 'default',
            }}
            title={
              (serverCapacity.servers
                ?.map(
                  (s) =>
                    `${s.target_name}: ${s.in_use}/${s.limit ?? '∞'} in use${s.holders?.length ? ` (by: ${s.holders.join(', ')})` : ''}`
                )
                .join('\n') || serverCapacity.display_label) +
              (onOpenServersQueue ? '\n\nClick to open Global Servers & Queue' : '')
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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Search, Copy, Check, RefreshCw,
  ChevronUp, ChevronDown, Download, WrapText,
  Maximize2, Minimize2, ExternalLink, FileText,
} from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';
import { eodService } from '../../../services/eodService';

// Splits a line into text segments — normal and matched — for inline highlighting
function splitLineByMatch(line, query) {
  if (!query) return [{ text: line, match: false }];
  const parts = [];
  const lower = line.toLowerCase();
  const lowerQ = query.toLowerCase();
  let cursor = 0;
  let idx;
  while ((idx = lower.indexOf(lowerQ, cursor)) !== -1) {
    if (idx > cursor) parts.push({ text: line.slice(cursor, idx), match: false });
    parts.push({ text: line.slice(idx, idx + query.length), match: true });
    cursor = idx + query.length;
  }
  if (cursor < line.length) parts.push({ text: line.slice(cursor), match: false });
  return parts;
}

const VIEW_OPTIONS = [
  { value: 'logs', label: 'Logs' },
  { value: 'answer', label: 'Answer' },
];

export function LogViewerModal({ isOpen, onClose, env }) {
  if (!isOpen || !env) return null;

  const [activeView, setActiveView] = useState('logs');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [logContent, setLogContent] = useState('');
  const [answerContent, setAnswerContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Find navigation
  const [matchIndices, setMatchIndices] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  const lineRefs = useRef({});
  const searchInputRef = useRef(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const allJobs = await eodService.getAllJobs(env.id);
        if (allJobs && allJobs.length > 0) {
          setJobs(allJobs);
          const running = allJobs.find(j => j.status === 'IN_PROGRESS');
          setSelectedJob(running ? running.jobName : allJobs[0].jobName);
        } else {
          setSelectedJob(env.runningJobName || 'JOB_PRE_CHECK');
        }
      } catch (err) {
        console.error('Failed to fetch jobs for log viewer', err);
      }
    };
    fetchJobs();
  }, [env.id]);

  useEffect(() => {
    const fetchLogContent = async () => {
      if (!selectedJob) return;
      setIsLoading(true);
      try {
        const result = await eodService.findJobLog(env.id, selectedJob);
        if (result) {
          setLogContent(result.logFile || '');
          setAnswerContent(result.answerFile || '');
        }
      } catch (err) {
        console.error('Failed to fetch log content', err);
        setLogContent('Error loading logs.');
        setAnswerContent('Error loading answers.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogContent();
    let interval;
    if (env.status === 'running') {
      interval = setInterval(fetchLogContent, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [env.id, selectedJob, env.status]);

  // Recompute match indices on query/content/view change
  useEffect(() => {
    if (!debouncedSearchQuery) {
      setMatchIndices([]);
      setCurrentMatchIdx(0);
      return;
    }
    const content = activeView === 'logs' ? logContent : answerContent;
    const lines = content ? content.split('\n') : [];
    const lowerQ = debouncedSearchQuery.toLowerCase();
    const hits = lines
      .map((line, i) => (line.toLowerCase().includes(lowerQ) ? i : -1))
      .filter(i => i !== -1);
    setMatchIndices(hits);
    setCurrentMatchIdx(0);
  }, [debouncedSearchQuery, logContent, answerContent, activeView]);

  // Scroll to active match
  useEffect(() => {
    if (matchIndices.length === 0) return;
    const lineIdx = matchIndices[currentMatchIdx];
    const el = lineRefs.current[lineIdx];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentMatchIdx, matchIndices]);

  const goNext = useCallback(() => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIdx(i => (i + 1) % matchIndices.length);
  }, [matchIndices]);

  const goPrev = useCallback(() => {
    if (matchIndices.length === 0) return;
    setCurrentMatchIdx(i => (i - 1 + matchIndices.length) % matchIndices.length);
  }, [matchIndices]);

  const onSearchKeyDown = (e) => {
    if (e.key === 'Enter') e.shiftKey ? goPrev() : goNext();
    if (e.key === 'Escape') setSearchQuery('');
  };

  // Copy current content to clipboard
  const handleCopy = () => {
    const content = activeView === 'logs' ? logContent : answerContent;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download current content as a .log or .txt file
  const handleDownload = () => {
    const content = activeView === 'logs' ? logContent : answerContent;
    if (!content) return;
    const ext = activeView === 'logs' ? 'log' : 'txt';
    const filename = `${env.name}_${selectedJob}_${activeView}.${ext}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open raw content in a new browser tab
  const handleOpenRaw = () => {
    const content = activeView === 'logs' ? logContent : answerContent;
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Note: blob URL is alive as long as the tab is open; we don't revoke it here
  };

  const currentContent = activeView === 'logs' ? logContent : answerContent;
  const lines = currentContent ? currentContent.split('\n') : [];
  const totalMatches = matchIndices.length;
  const activeMatchLine = matchIndices[currentMatchIdx];
  const gutterWidth = `${String(lines.length).length + 1}ch`;

  const getLineColor = (line) => {
    if (line.includes('SUCCESS') || line.includes('✓') || line.toLowerCase().includes('done')) return '#4ade80';
    if (line.includes('ERROR') || line.includes('FAILED') || line.includes('Exception')) return '#f87171';
    if (line.includes('WARN')) return '#facc15';
    if (line.includes('INFO')) return '#60a5fa';
    return 'var(--border-secondary)';
  };

  const iconBtn = {
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#ccc',
    cursor: 'pointer',
    padding: '6px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    transition: 'background 0.15s, color 0.15s',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isFullscreen ? '0' : '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: isFullscreen ? '100vw' : '100%',
          maxWidth: isFullscreen ? '100vw' : '1100px',
          height: isFullscreen ? '100vh' : '88vh',
          backgroundColor: '#141414',
          borderRadius: isFullscreen ? '0' : '12px',
          border: isFullscreen ? 'none' : '1px solid #333',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', backgroundColor: '#1f1f1f', borderBottom: '1px solid #2a2a2a',
            flexShrink: 0,
          }}
        >
          {/* Left: title + view dropdown + job dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--surface-primary)', fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {env.name} Logs
            </span>

            {/* View selector (Logs / Answer) as dropdown */}
            <select
              value={activeView}
              onChange={(e) => setActiveView(e.target.value)}
              style={{
                backgroundColor: '#0d0d0d', border: '1px solid #444', borderRadius: '6px',
                padding: '5px 10px', color: '#e0e0e0', fontSize: '12px',
                outline: 'none', cursor: 'pointer',
              }}
            >
              {VIEW_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Job selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#666', fontSize: '11px' }}>Job:</span>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                style={{
                  backgroundColor: '#0d0d0d', border: '1px solid #444', borderRadius: '6px',
                  padding: '5px 10px', color: '#e0e0e0', fontSize: '12px',
                  outline: 'none', minWidth: '160px', cursor: 'pointer',
                }}
              >
                {jobs.map((j, idx) => (
                  <option key={idx} value={j.jobName}>
                    {j.serial}. {j.jobName}
                    {j.status === 'COMPLETED' ? ' ✓' : j.status === 'IN_PROGRESS' ? ' ◉' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isLoading && <RefreshCw size={13} className="eod-spin" style={{ color: '#888' }} />}

            {/* Wrap lines toggle */}
            <button
              onClick={() => setWrapLines(w => !w)}
              title="Toggle wrap lines"
              style={{
                ...iconBtn,
                color: wrapLines ? '#a5b4fc' : '#888',
                borderColor: wrapLines ? '#6366f1' : '#444',
                backgroundColor: wrapLines ? 'rgba(99,102,241,0.12)' : '#2a2a2a',
              }}
            >
              <WrapText size={13} />
              <span>Wrap</span>
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              disabled={!currentContent}
              title="Copy to clipboard"
              style={{ ...iconBtn, color: copied ? 'var(--c-success)' : '#ccc', opacity: currentContent ? 1 : 0.4 }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={!currentContent}
              title="Download as file"
              style={{ ...iconBtn, opacity: currentContent ? 1 : 0.4 }}
            >
              <Download size={13} />
              <span>Download</span>
            </button>

            {/* Raw — open in new tab */}
            <button
              onClick={handleOpenRaw}
              disabled={!currentContent}
              title="View raw in new tab"
              style={{ ...iconBtn, opacity: currentContent ? 1 : 0.4 }}
            >
              <ExternalLink size={13} />
              <span>Raw</span>
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
              style={iconBtn}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              title="Close"
              style={{ ...iconBtn, border: 'none', backgroundColor: 'transparent', color: '#888' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Find toolbar ────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 16px', backgroundColor: '#181818',
            borderBottom: '1px solid #2a2a2a', flexShrink: 0,
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '280px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', color: '#888', pointerEvents: 'none' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Find in logs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              style={{ paddingRight: '32px', 
                width: '100%', backgroundColor: '#0d0d0d',
                border: `1px solid ${searchQuery && totalMatches === 0 ? '#f87171' : searchQuery ? '#6366f1' : '#333'}`,
                borderRadius: '6px', padding: '5px 28px 5px 30px',
                color: 'var(--surface-primary)', fontSize: '12px', outline: 'none', transition: 'border-color 0.2s',
              }}
            />
      {searchQuery && (
        <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
          <X size={14} />
        </button>
      )}
            {searchQuery && (
              <X
                size={11}
                style={{ position: 'absolute', right: '9px', color: '#888', cursor: 'pointer' }}
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>

          {/* Match count + prev / next */}
          {searchQuery && (
            <>
              <span style={{ fontSize: '11px', color: totalMatches === 0 ? '#f87171' : 'var(--text-tertiary)', minWidth: '68px', whiteSpace: 'nowrap' }}>
                {totalMatches === 0 ? 'No results' : `${currentMatchIdx + 1} of ${totalMatches}`}
              </span>
              <button
                onClick={goPrev} disabled={totalMatches === 0}
                title="Previous match (Shift+Enter)"
                style={{ ...iconBtn, padding: '4px 7px', opacity: totalMatches > 0 ? 1 : 0.4 }}
              >
                <ChevronUp size={13} />
              </button>
              <button
                onClick={goNext} disabled={totalMatches === 0}
                title="Next match (Enter)"
                style={{ ...iconBtn, padding: '4px 7px', opacity: totalMatches > 0 ? 1 : 0.4 }}
              >
                <ChevronDown size={13} />
              </button>
              <span style={{ fontSize: '10px', color: '#555', marginLeft: '4px' }}>
                Enter ↓ · Shift+Enter ↑ · Esc to clear
              </span>
            </>
          )}

          {/* Line count badge on the right */}
          {lines.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#555' }}>
              {lines.length} lines
            </span>
          )}
        </div>

        {/* ── Log body ─────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1, overflowY: 'auto', overflowX: wrapLines ? 'hidden' : 'auto',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12px', lineHeight: '1.65', color: '#e0e0e0',
            backgroundColor: '#0a0a0a', padding: '12px 0',
          }}
        >
          {isLoading && lines.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
              <RefreshCw size={20} className="eod-spin" style={{ marginRight: '8px' }} /> Loading…
            </div>
          ) : !currentContent && !isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontStyle: 'italic', flexDirection: 'column', gap: '8px' }}>
              <FileText size={28} style={{ opacity: 0.4 }} />
              <span>No content available for this {activeView} file.</span>
            </div>
          ) : (
            <>
              {lines.map((line, idx) => {
                const isActiveLine = idx === activeMatchLine;
                const isMatchLine  = matchIndices.includes(idx);
                const segments     = splitLineByMatch(line, debouncedSearchQuery);

              return (
                <div
                  key={idx}
                  ref={(el) => { lineRefs.current[idx] = el; }}
                  style={{
                    display: 'flex',
                    backgroundColor: isActiveLine
                      ? 'rgba(99,102,241,0.18)'
                      : isMatchLine
                        ? 'rgba(99,102,241,0.07)'
                        : 'transparent',
                  }}
                >
                  {/* Gutter — line number */}
                  <span
                    style={{
                      flexShrink: 0,
                      width: gutterWidth,
                      textAlign: 'right',
                      paddingLeft: '12px',
                      paddingRight: '10px',
                      color: isActiveLine ? '#6366f1' : '#444',
                      fontSize: '11px',
                      userSelect: 'none',
                      borderRight: isActiveLine ? '2px solid #6366f1' : '2px solid transparent',
                    }}
                  >
                    {idx + 1}
                  </span>

                  {/* Content */}
                  <span
                    style={{
                      flex: 1,
                      paddingLeft: '12px',
                      paddingRight: '16px',
                      color: getLineColor(line),
                      wordBreak: wrapLines ? 'break-all' : 'normal',
                      whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                    }}
                  >
                    {segments.map((seg, si) =>
                      seg.match ? (
                        <mark
                          key={si}
                          style={{
                            backgroundColor: isActiveLine ? 'var(--c-warning)' : '#6366f1',
                            color: 'var(--surface-primary)',
                            borderRadius: '2px',
                            padding: '0 1px',
                            fontWeight: 700,
                          }}
                        >
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={si}>{seg.text}</span>
                      )
                    )}
                  </span>
                </div>
              );
            })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Copy, Check, FileText, Code, RefreshCw } from 'lucide-react';
import { eodService } from '../../../services/eodService';

export function LogViewerModal({ isOpen, onClose, env }) {
  if (!isOpen || !env) return null;

  const [activeTab, setActiveTab] = useState('logs');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [logContent, setLogContent] = useState('');
  const [answerContent, setAnswerContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const contentRef = useRef(null);

  useEffect(() => {
    // Fetch jobs list
    const fetchJobs = async () => {
      try {
        const allJobs = await eodService.getAllJobs(env.id);
        if (allJobs && allJobs.length > 0) {
          setJobs(allJobs);
          // Set selected job to currently running or first available
          const running = allJobs.find(j => j.status === 'IN_PROGRESS');
          if (running) {
            setSelectedJob(running.jobName);
          } else {
            setSelectedJob(allJobs[0].jobName);
          }
        } else {
          // Fallback if no jobs file exists yet
          setSelectedJob(env.runningJobName || 'JOB_PRE_CHECK');
        }
      } catch (err) {
        console.error('Failed to fetch jobs for log viewer', err);
      }
    };
    fetchJobs();
  }, [env.id]);

  useEffect(() => {
    // Fetch log content based on selected job
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
    
    // Set up auto-refresh if env is running
    let interval;
    if (env.status === 'running') {
      interval = setInterval(fetchLogContent, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [env.id, selectedJob, env.status]);

  const handleCopy = () => {
    const contentToCopy = activeTab === 'logs' ? logContent : answerContent;
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentContent = activeTab === 'logs' ? logContent : answerContent;
  
  const filteredLines = currentContent
    ? currentContent.split('\n').filter(line => 
        searchQuery ? line.toLowerCase().includes(searchQuery.toLowerCase()) : true
      )
    : [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '960px',
          height: '85vh',
          backgroundColor: '#141414',
          borderRadius: '12px',
          border: '1px solid #333',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            backgroundColor: '#1f1f1f',
            borderBottom: '1px solid #333',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>
              {env.name} Logs
            </div>
            
            {/* Tabs */}
            <div style={{ display: 'flex', backgroundColor: '#0d0d0d', borderRadius: '8px', padding: '4px' }}>
              <button
                onClick={() => setActiveTab('logs')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'logs' ? '#2a2a2a' : 'transparent',
                  color: activeTab === 'logs' ? '#fff' : '#888',
                  fontSize: '12px',
                  fontWeight: activeTab === 'logs' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <FileText size={14} /> Logs
              </button>
              <button
                onClick={() => setActiveTab('answer')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'answer' ? '#2a2a2a' : 'transparent',
                  color: activeTab === 'answer' ? '#fff' : '#888',
                  fontSize: '12px',
                  fontWeight: activeTab === 'answer' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Code size={14} /> Answer
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#888', fontSize: '12px' }}>Job:</span>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                style={{
                  backgroundColor: '#0d0d0d',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '6px 24px 6px 10px',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  outline: 'none',
                  minWidth: '150px',
                  appearance: 'auto', // Native dropdown arrow
                }}
              >
                {jobs.map((j, idx) => (
                  <option key={idx} value={j.jobName}>
                    {j.serial}. {j.jobName} {j.status === 'COMPLETED' ? '(Done)' : j.status === 'IN_PROGRESS' ? '(Running)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '8px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 20px',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #333',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: '#888' }} />
            <input
              type="text"
              placeholder="Filter lines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0d0d0d',
                border: '1px solid #333',
                borderRadius: '6px',
                padding: '6px 10px 6px 32px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <X 
                size={12} 
                style={{ position: 'absolute', right: '10px', color: '#888', cursor: 'pointer' }} 
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isLoading && <RefreshCw size={14} className="eod-spin" style={{ color: '#888' }} />}
            
            <button
              onClick={handleCopy}
              disabled={!currentContent}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '6px',
                padding: '6px 12px',
                color: copied ? '#10b981' : '#ccc',
                fontSize: '12px',
                cursor: currentContent ? 'pointer' : 'not-allowed',
                opacity: currentContent ? 1 : 0.5,
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            padding: '16px 20px',
            overflowY: 'auto',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            color: '#e0e0e0',
            backgroundColor: '#0a0a0a',
          }}
        >
          {!currentContent && !isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontStyle: 'italic', flexDirection: 'column', gap: '8px' }}>
              <FileText size={32} style={{ opacity: 0.5 }} />
              <span>No content available for this {activeTab === 'logs' ? 'log' : 'answer'} file.</span>
            </div>
          ) : filteredLines.length === 0 && searchQuery ? (
            <div style={{ color: '#666', fontStyle: 'italic' }}>No matching lines found.</div>
          ) : (
            filteredLines.map((line, idx) => {
              // Basic highlighting
              let color = '#d1d5db';
              if (line.includes('SUCCESS') || line.includes('✓') || line.toLowerCase().includes('done')) {
                color = '#4ade80';
              } else if (line.includes('ERROR') || line.includes('FAILED') || line.includes('Exception')) {
                color = '#f87171';
              } else if (line.includes('WARN')) {
                color = '#facc15';
              } else if (line.includes('INFO')) {
                color = '#60a5fa';
              }
              
              return (
                <div
                  key={idx}
                  style={{
                    padding: '2px 0',
                    color,
                    wordBreak: 'break-all',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {line}
                </div>
              );
            })
          )}
          <div ref={contentRef} />
        </div>
      </div>
    </div>
  );
}

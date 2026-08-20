import { useEffect, useState } from 'react';
import { Clock, Database, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import { settingsService } from '@services/settingsService';

export function UploadTimestampDisplay({ fileKey, label, configs, useRawTime }) {
  const items = configs || [{ fileKey, label }];
  const keysStr = items.map(i => i.fileKey).join(',');
  const [data, setData] = useState({});

  useEffect(() => {
    const fetchTimestamps = async () => {
      if (!keysStr) return;
      try {
        const res = await settingsService.getUploadTimestamp(keysStr);
        if (res) {
          setData(res);
        }
      } catch (err) {
        console.error('Failed to fetch upload timestamps for', keysStr, err);
      }
    };
    fetchTimestamps();
  }, [keysStr]);

  if (Object.keys(data).length === 0) return null;

  return (
    <>
      {items.map(item => {
        const uploadedAt = data[item.fileKey]?.uploadedAt || data.uploadedAt; // fallback for backwards compat if backend didn't change for single key
        if (!uploadedAt) return null;

        let Icon = Clock;
        let colorClass = 'var(--text-secondary, #6b7280)';
        let bgClass = 'var(--bg-tertiary, #f3f4f6)';
        let iconColor = 'var(--text-secondary, #6b7280)';
        let borderColor = 'transparent';

        if (item.fileKey === 'runTimeFilePath') {
          Icon = Database;
          colorClass = '#0369a1';
          bgClass = '#e0f2fe';
          iconColor = '#0ea5e9';
          borderColor = '#bae6fd';
        } else if (item.fileKey === 'wofilePath') {
          Icon = FileText;
          colorClass = '#4338ca';
          bgClass = '#e0e7ff';
          iconColor = '#6366f1';
          borderColor = '#c7d2fe';
        } else if (item.fileKey === 'crfilePath') {
          Icon = FileSpreadsheet;
          colorClass = '#15803d';
          bgClass = '#dcfce7';
          iconColor = '#22c55e';
          borderColor = '#bbf7d0';
        }

        const dateObj = new Date(uploadedAt);
        const pad = (n) => n.toString().padStart(2, '0');
        const customFormattedTime = `${pad(dateObj.getDate())}-${pad(dateObj.getMonth() + 1)}-${dateObj.getFullYear()} ${pad(dateObj.getHours())}-${pad(dateObj.getMinutes())}-${pad(dateObj.getSeconds())}`;

        const displayLabel = item.label.trim().endsWith(':') ? item.label : `${item.label}:`;

        return (
          <div 
            key={item.fileKey}
            title={`Data for ${item.label} was last updated on ${customFormattedTime}`}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '11px', 
              fontWeight: 600,
              color: colorClass,
              backgroundColor: bgClass,
              padding: '3px 8px',
              borderRadius: '6px',
              border: `1px solid ${borderColor}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            <Icon size={12} color={iconColor} style={{ flexShrink: 0 }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{displayLabel}</span>
              <span style={{ fontWeight: 700 }}>{useRawTime ? uploadedAt : customFormattedTime}</span>
            </span>
            <CheckCircle2 size={12} color={iconColor} style={{ marginLeft: '2px', opacity: 0.8 }} />
          </div>
        );
      })}
    </>
  );
}

export default UploadTimestampDisplay;

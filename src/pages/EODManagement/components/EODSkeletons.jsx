import { Skeleton } from '@components/feedback/Skeleton/Skeleton';

export function OverviewSkeleton() {
  return (
    <div className="eod-section">
      {/* 4 Stat Cards Skeleton */}
      <div className="eod-stat-strip" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: '220px', background: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Skeleton height={40} width={40} style={{ borderRadius: '8px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <Skeleton height={24} width="30%" />
              <Skeleton height={12} width="80%" />
            </div>
          </div>
        ))}
      </div>

      {/* Live Run Banner Skeleton */}
      <div className="eod-live-banner" style={{ background: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="eod-live-banner-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-secondary)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Skeleton height={16} width={16} />
            <Skeleton height={20} width={150} />
          </div>
          <Skeleton height={20} width={80} />
        </div>
        <div className="eod-live-banner-body" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Skeleton height={16} width={80} />
          <Skeleton height={12} width="100%" style={{ flex: 1, borderRadius: '4px' }} />
          <Skeleton height={16} width={40} />
        </div>
        <div style={{ display: 'flex', gap: '20px', padding: '0 10px' }}>
          <Skeleton height={14} width={120} />
        </div>
      </div>

      {/* Table Section Skeleton */}
      <div className="eod-section-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '16px' }}>
        <Skeleton height={24} width={120} />
        <Skeleton height={32} width={100} style={{ borderRadius: '6px' }} />
      </div>

      <div className="eod-env-table-wrap">
        <table className="eod-env-table">
          <thead>
            <tr className="eod-env-thead">
              <th className="eod-env-th eod-th-env">Environment</th>
              <th className="eod-env-th eod-th-status">Status</th>
              <th className="eod-env-th eod-th-progress">Progress</th>
              <th className="eod-env-th eod-th-date">Last Run</th>
              <th className="eod-env-th eod-th-date">Next Run</th>
              <th className="eod-env-th eod-th-dur">Duration</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="eod-env-row">
                <td className="eod-env-td eod-td-env"><Skeleton height={20} width="80%" /></td>
                <td className="eod-env-td eod-td-status"><Skeleton height={24} width={80} style={{ borderRadius: '12px' }} /></td>
                <td className="eod-env-td eod-td-progress"><Skeleton height={12} width="90%" style={{ borderRadius: '4px' }} /></td>
                <td className="eod-env-td eod-td-date"><Skeleton height={16} width="70%" /></td>
                <td className="eod-env-td eod-td-date"><Skeleton height={16} width="70%" /></td>
                <td className="eod-env-td eod-td-dur"><Skeleton height={16} width="50%" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConfigSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton height={40} width="200px" style={{ marginBottom: '24px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton height={60} width="100%" style={{ borderRadius: '8px' }} />
        <Skeleton height={60} width="100%" style={{ borderRadius: '8px' }} />
        <Skeleton height={60} width="100%" style={{ borderRadius: '8px' }} />
        <Skeleton height={60} width="100%" style={{ borderRadius: '8px' }} />
      </div>
    </div>
  );
}

export function SchedulesSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Skeleton height={40} width="250px" />
        <Skeleton height={40} width="120px" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton height={80} width="100%" style={{ borderRadius: '8px' }} />
        <Skeleton height={80} width="100%" style={{ borderRadius: '8px' }} />
        <Skeleton height={80} width="100%" style={{ borderRadius: '8px' }} />
      </div>
    </div>
  );
}

export function ControlSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
      <Skeleton height={400} width="100%" style={{ borderRadius: '12px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton height={100} width="100%" style={{ borderRadius: '12px' }} />
        <Skeleton height={100} width="100%" style={{ borderRadius: '12px' }} />
        <Skeleton height={100} width="100%" style={{ borderRadius: '12px' }} />
      </div>
    </div>
  );
}

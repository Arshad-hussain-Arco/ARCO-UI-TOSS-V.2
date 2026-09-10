import { Skeleton } from '@components/feedback/Skeleton/Skeleton';

export function OverviewSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <Skeleton height={140} width="100%" style={{ borderRadius: '12px' }} />
        <Skeleton height={140} width="100%" style={{ borderRadius: '12px' }} />
        <Skeleton height={140} width="100%" style={{ borderRadius: '12px' }} />
        <Skeleton height={140} width="100%" style={{ borderRadius: '12px' }} />
      </div>
      <Skeleton height={400} width="100%" style={{ borderRadius: '12px' }} />
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

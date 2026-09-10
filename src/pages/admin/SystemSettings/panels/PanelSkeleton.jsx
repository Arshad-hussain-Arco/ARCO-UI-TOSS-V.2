import { Skeleton } from '@components/feedback/Skeleton/Skeleton';

export function PanelSkeleton() {
  return (
    <div className="ss-form-card" style={{ padding: '24px' }}>
      <Skeleton height={28} width="250px" style={{ marginBottom: '24px' }} />
      <Skeleton height={20} width="60%" style={{ marginBottom: '32px' }} />
      <Skeleton height={44} width="100%" style={{ marginBottom: '16px', borderRadius: '6px' }} />
      <Skeleton height={44} width="100%" style={{ marginBottom: '16px', borderRadius: '6px' }} />
      <Skeleton height={44} width="100%" style={{ marginBottom: '32px', borderRadius: '6px' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Skeleton height={36} width="120px" style={{ borderRadius: '6px' }} />
      </div>
    </div>
  );
}

import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button } from '@components/ui/Button/Button';

/**
 * Shown for the last minute before the idle timeout signs the user out
 * (see hooks/useIdleTimeout). Closing it any way counts as "stay signed in".
 */
export function IdleWarningModal({ secondsLeft, onStaySignedIn, onSignOut }) {
  return (
    <AdminModal
      title="Are you still there?"
      isOpen={secondsLeft !== null}
      onClose={onStaySignedIn}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onSignOut}>
            Sign out
          </Button>
          <Button onClick={onStaySignedIn}>Stay signed in</Button>
        </>
      }
    >
      <p>
        You&apos;ve been inactive for a while. For your security you&apos;ll be signed out in{' '}
        <strong>{secondsLeft}</strong> second{secondsLeft === 1 ? '' : 's'}.
      </p>
    </AdminModal>
  );
}

export default IdleWarningModal;

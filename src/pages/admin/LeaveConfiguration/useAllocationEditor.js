import { useCallback, useState } from 'react';

/** Fields the editor recalculates `totalAvailable` from. */
const ALLOCATION_FIELDS = ['carryOver', 'compOff', 'weekendWork'];

/**
 * Inline-edit state for one consultant's leave allocation at a time.
 *
 * Extracted from the page so the page deals with layout and the hook owns the
 * edit lifecycle: which row is open, its draft values, and how the derived total
 * is recomputed.
 *
 * @param {(payload: { teamId: string, consultantId: string, metrics: Object }) => Promise<void>} onSave
 */
export function useAllocationEditor(onSave) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = useCallback((consultant) => {
    setEditingId(consultant.id);
    setDraft({ ...consultant.metrics });
  }, []);

  const cancel = useCallback(() => {
    setEditingId(null);
    setDraft(null);
  }, []);

  /** Coerces to a non-negative integer so the inputs can never hold NaN. */
  const changeField = useCallback((field, value) => {
    const parsed = Number.parseInt(value, 10);
    const safe = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);

    setDraft((current) => (current ? { ...current, [field]: safe } : current));
  }, []);

  const save = useCallback(
    async (teamId, consultantId) => {
      if (!draft) return;

      const metrics = {
        ...draft,
        totalAvailable: ALLOCATION_FIELDS.reduce((sum, field) => sum + draft[field], 0),
      };

      setIsSaving(true);
      try {
        await onSave({ teamId, consultantId, metrics });
        setEditingId(null);
        setDraft(null);
      } finally {
        setIsSaving(false);
      }
    },
    [draft, onSave],
  );

  return { editingId, draft, isSaving, startEditing, cancel, changeField, save };
}

export default useAllocationEditor;

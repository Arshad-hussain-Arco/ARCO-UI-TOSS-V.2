import { ConfirmationModal } from '@components/common';

export function DeleteCategoryModal({ category, onClose, onConfirm }) {
  return (
    <ConfirmationModal
      isOpen={!!category}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Confirm Deletion"
      description={
        <>
          Are you sure you want to delete the category <strong>{category?.name}</strong>?
          <br />
          <span className="murex-delete-category-hint">All scripts within this category will become uncategorized.</span>
        </>
      }
      confirmLabel="Delete"
      confirmVariant="danger"
    />
  );
}

export default DeleteCategoryModal;

import { Minus, Plus, Search } from 'lucide-react';

import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button, IconButton, Input, Textarea } from '@components/common';

export function CategoryFormModal({
  isOpen,
  onClose,
  editingCategory,
  categoryFormName,
  setCategoryFormName,
  categoryFormDescription,
  setCategoryFormDescription,
  availableSearch,
  setAvailableSearch,
  categorySearch,
  setCategorySearch,
  renderedAvailableScripts,
  renderedAssignedScripts,
  toggleScriptAssignment,
  onSave,
}) {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCategory ? 'Edit Category' : 'Create a New Category'}
      size={editingCategory ? 'lg' : 'md'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave}>
            {editingCategory ? 'Save Changes' : 'Create Category'}
          </Button>
        </>
      }
    >
      <div className={`murex-category-form-grid ${editingCategory ? 'two-col' : ''}`}>
        <Input
          label="Category Name"
          required
          value={categoryFormName}
          onChange={e => setCategoryFormName(e.target.value)}
        />
        <Textarea
          label="Description"
          rows={3}
          value={categoryFormDescription}
          onChange={e => setCategoryFormDescription(e.target.value)}
        />
      </div>

      {editingCategory && (
        <div className="murex-dual-list-container">
          <div className="murex-script-list-pane">
            <h4 className="murex-script-list-title">Available Scripts ({renderedAvailableScripts.length})</h4>
            <Input
              icon={Search}
              placeholder="Search available scripts..."
              value={availableSearch}
              onChange={(e) => setAvailableSearch(e.target.value)}
            />
            <div className="murex-script-list-scroll">
              {renderedAvailableScripts.length === 0 ? (
                <div className="murex-script-list-empty">No scripts found</div>
              ) : (
                renderedAvailableScripts.map(script => (
                  <div key={script.id} className="murex-script-list-row">
                    <span>{script.script_name}</span>
                    <IconButton
                      icon={Plus}
                      label={`Add ${script.script_name}`}
                      variant="success"
                      size="sm"
                      onClick={() => toggleScriptAssignment(script.script_name, true)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="murex-script-list-pane">
            <h4 className="murex-script-list-title">Category Scripts ({renderedAssignedScripts.length})</h4>
            <Input
              icon={Search}
              placeholder="Search category scripts..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
            />
            <div className="murex-script-list-scroll assigned">
              {renderedAssignedScripts.length === 0 ? (
                <div className="murex-script-list-empty">No scripts assigned</div>
              ) : (
                renderedAssignedScripts.map(script => (
                  <div key={script.id} className="murex-script-list-row assigned">
                    <span>{script.script_name}</span>
                    <IconButton
                      icon={Minus}
                      label={`Remove ${script.script_name}`}
                      variant="danger"
                      size="sm"
                      onClick={() => toggleScriptAssignment(script.script_name, false)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminModal>
  );
}

export default CategoryFormModal;

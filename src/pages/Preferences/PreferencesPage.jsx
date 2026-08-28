import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListOrdered, ShieldCheck, Settings, ArrowLeft } from 'lucide-react';

import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { Button } from '@components/ui/Button/Button';

import { MySidebarLayoutPanel } from './panels/MySidebarLayoutPanel';
import { RoleSidebarDefaultsPanel } from './panels/RoleSidebarDefaultsPanel';
import './PreferencesPage.css';

/**
 * User's own account preferences, reached from the header profile menu
 * (not the sidebar). "Sidebar Layout" (personal order) is open to every
 * user; "Sidebar Layout Defaults" (per-role default order) is admin-only
 * since it edits a role-wide setting. Future phases add more tabs here.
 */
export function PreferencesPage() {
  useDocumentTitle('Preferences');
  const { user } = useAuth();
  const navigate = useNavigate();

  const TABS = useMemo(
    () => [
      { id: 'my-sidebar-layout', label: 'Sidebar Layout', icon: ListOrdered },
      ...(user?.isAdmin
        ? [{ id: 'role-sidebar-defaults', label: 'Sidebar Layout Defaults', icon: ShieldCheck }]
        : []),
    ],
    [user?.isAdmin],
  );

  const [activeTab, setActiveTab] = useState(TABS[0]?.id ?? null);

  return (
    <div className="pf-container">
      <div className="pf-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            leadingIcon={ArrowLeft}
            style={{ color: 'var(--text-secondary)', marginRight: '8px' }}
          >
            Back
          </Button>
          <Settings size={22} className="pf-header-icon" style={{ color: 'var(--c-primary, #006633)' }} />
          <h2 className="pf-title">Preferences</h2>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          Manage your personal account settings and layout preferences.
        </p>
      </div>

      <div className="pf-tabs-container" role="tablist" aria-label="Preferences Navigation">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`pf-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="pf-tab-icon" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="pf-main-content">
        {activeTab === 'my-sidebar-layout' ? <MySidebarLayoutPanel /> : null}
        {activeTab === 'role-sidebar-defaults' ? <RoleSidebarDefaultsPanel /> : null}
      </div>
    </div>
  );
}

export default PreferencesPage;

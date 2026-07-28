import { memo } from 'react';
import { Settings, Shield, Users } from 'lucide-react';

/** Role `iconKey` → icon component. */
const ROLE_ICONS = {
  shield: Shield,
  settings: Settings,
  users: Users,
};

/**
 * Selectable list of roles.
 *
 * Each card is a real button so the list is keyboard-navigable; the original used
 * a click-only div.
 *
 * @param {Object} props
 * @param {{ id: string, name: string, permissions: number, iconKey: string }[]} props.roles
 * @param {string} props.selectedRoleId
 * @param {(roleId: string) => void} props.onSelect
 */
function RoleListComponent({ roles, selectedRoleId, onSelect }) {
  return (
    <div className="rm-roles-list">
      {roles.map((role) => {
        const Icon = ROLE_ICONS[role.iconKey] ?? Users;
        const isActive = selectedRoleId === role.id;

        return (
          <button
            key={role.id}
            type="button"
            className={`rm-role-card ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(role.id)}
            aria-pressed={isActive}
          >
            <div className="rm-role-icon">
              <Icon size={16} aria-hidden="true" />
            </div>
            <div className="rm-role-info">
              <div className="rm-role-name">{role.name}</div>
              <div className="rm-role-perms">{role.permissions} policies attached</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const RoleList = memo(RoleListComponent);
export default RoleList;

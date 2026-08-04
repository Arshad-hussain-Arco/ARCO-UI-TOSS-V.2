import { memo } from 'react';

import { cn } from '@utils/cn';

import styles from './Tabs.module.css';

export const Tabs = memo(function Tabs({ tabs, activeTab, onChange, className }) {
  return (
    <div className={cn(styles.tabs, className)} role="tablist">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={styles.tab}
            data-active={isActive}
          >
            {Icon && <Icon className={styles.tabIcon} />}
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
});

export default Tabs;

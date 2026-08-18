const fs = require('fs');

const cssClassesMap = {
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\components\\ui\\AdminModal\\AdminModal.css': ['.admin-modal-shell'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\Consultants\\ConsultantProfileModal.css': ['.cp-profile-modal'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\Dashboard\\sections\\PendingApprovalsActionSection.css': ['.dc-pa-modal'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\Documents\\DocumentsPage.css': ['.doc-modal-container'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\EODManagement\\EODManagementPage.css': ['.eod-modal', '.eod-confirm-modal'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\ImportantLinks\\ImportantLinksPage.css': ['.il-modal'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\ProjectMonitoring\\ProjectMonitoringPage.css': ['.pm-modal-panel'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\Reconciliation\\ReconciliationPage.css': ['.rrs-modal'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\admin\\RoleManagement\\RoleManagementPage.css': ['.rm-modal-card'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\pages\\CapacityPlanning\\CapacityPlanningPage.css': ['.cp-modal-card'],
  'C:\\Users\\AfrinDuvvuru\\Desktop\\Arco-github\\ARCO-UI-TOSS-V.2\\src\\components\\dashboard\\ApprovalRow.css': ['.approval-modal-content']
};

for (const [file, classes] of Object.entries(cssClassesMap)) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  for (const cls of classes) {
    const regexStr = cls.replace('.', '\\.') + '\\s*\\{([^}]*)\\}';
    const regex = new RegExp(regexStr, 'g');
    
    content = content.replace(regex, (match, inner) => {
      let newInner = inner;
      
      if (!newInner.includes('background: var(--surface-primary)')) {
        if (/background\s*:/.test(newInner)) {
           newInner = newInner.replace(/background\s*:[^;]+;/, 'background: var(--surface-primary);');
        } else {
           newInner = '\n  background: var(--surface-primary);' + newInner;
        }
      }
      
      if (!newInner.includes('border: 1px solid var(--border-secondary)')) {
        if (/border\s*:/.test(newInner)) {
           newInner = newInner.replace(/border\s*:[^;]+;/, 'border: 1px solid var(--border-secondary);');
        } else {
           newInner = '\n  border: 1px solid var(--border-secondary);' + newInner;
        }
      }
      
      return cls + ' {' + newInner + '}';
    });

    const darkThemeStr = '[data-theme="dark"] ' + cls;
    if (!content.includes(darkThemeStr)) {
      const appendStr = '\n\n[data-theme="dark"] ' + cls + ' {\n  background: var(--surface-secondary);\n  border-color: rgba(255, 255, 255, 0.1);\n}';
      content += appendStr;
    } else {
      const dtRegex = new RegExp('\\[data-theme="dark"\\]\\s*' + cls.replace('.', '\\.') + '\\s*\\{([^}]*)\\}', 'g');
      content = content.replace(dtRegex, (match, inner) => {
         let newInner = inner;
         if (!newInner.includes('background: var(--surface-secondary)')) {
            if (/background\s*:/.test(newInner)) {
               newInner = newInner.replace(/background\s*:[^;]+;/, 'background: var(--surface-secondary);');
            } else {
               newInner = '\n  background: var(--surface-secondary);' + newInner;
            }
         }
         if (!newInner.includes('border-color: rgba(255, 255, 255, 0.1)')) {
            if (/border-color\s*:/.test(newInner)) {
               newInner = newInner.replace(/border-color\s*:[^;]+;/, 'border-color: rgba(255, 255, 255, 0.1);');
            } else {
               newInner += '\n  border-color: rgba(255, 255, 255, 0.1);';
            }
         }
         return '[data-theme="dark"] ' + cls + ' {' + newInner + '}';
      });
    }
  }

  if (content !== fs.readFileSync(file, 'utf8')) {
     fs.writeFileSync(file, content, 'utf8');
     console.log('Updated', file);
  }
}

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

import { Button } from '@components/ui/Button/Button';

import styles from './ExportButton.module.css';

/**
 * Single standardized export control: an "Export" button with a dropdown
 * arrow that reveals Excel / PDF choices. Use everywhere export actions exist
 * so the app has exactly one export affordance instead of separate per-format
 * buttons.
 *
 * @param {Object} props
 * @param {() => void} [props.onExportExcel]
 * @param {() => void} [props.onExportPdf]
 * @param {string} [props.label='Export']
 * @param {boolean} [props.disabled=false]
 */
export function ExportButton({ onExportExcel, onExportPdf, label = 'Export', disabled = false }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (fn) => {
    setOpen(false);
    fn?.();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" leadingIcon={Download} trailingIcon={ChevronDown} disabled={disabled}>
          {label}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} align="end" sideOffset={4}>
          {onExportExcel ? (
            <button type="button" className={styles.item} onClick={() => handleSelect(onExportExcel)}>
              <FileSpreadsheet size={14} />
              Export to Excel
            </button>
          ) : null}
          {onExportPdf ? (
            <button type="button" className={styles.item} onClick={() => handleSelect(onExportPdf)}>
              <FileText size={14} />
              Export to PDF
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default ExportButton;

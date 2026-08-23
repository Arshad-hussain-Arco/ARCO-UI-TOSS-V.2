import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import './ExportButton.css';

export function ExportButton({
  excel = false,
  pdf = false,
  onExcelExport,
  onPdfExport,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  if (!excel && !pdf) return null;

  const handleExcelClick = (e) => {
    e.stopPropagation();

    if (onExcelExport) {
      onExcelExport();
    }

    setIsOpen(false);
  };

  const handlePdfClick = (e) => {
    e.stopPropagation();

    if (onPdfExport) {
      onPdfExport();
    }

    setIsOpen(false);
  };

  const handleButtonClick = (e) => {
    e.stopPropagation();

    if (disabled) return;

    setIsOpen(!isOpen);
  };

  return (
    <div className="common-export-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="common-export-button"
        onClick={handleButtonClick}
        disabled={disabled}
      >
        {/* Inline SVG Export / Download Icon */}
        <svg className="common-export-icon-download" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
          <path d="M0 0h24v24H0z" fill="none" />
          <path fill="currentColor" fillRule="evenodd" d="M15 2h5.75c.69 0 1.25.56 1.25 1.25V9h-1.5V4.56l-9.22 9.22l-1.06-1.06l9.22-9.22H15zm2.25 17.5c.69 0 1.25-.56 1.25-1.25V12H20v6.25A2.755 2.755 0 0 1 17.25 21H5.75A2.755 2.755 0 0 1 3 18.25V6.75A2.755 2.755 0 0 1 5.75 4H12v1.5H5.75c-.69 0-1.25.56-1.25 1.25v11.5c0 .69.56 1.25 1.25 1.25z" clipRule="evenodd" />
        </svg>


        <span className="common-export-label">
          Export
        </span>

        <ChevronDown
          className="common-export-icon-chevron"
          size={16}
        />
      </button>

      {isOpen && (
        <div className="common-export-dropdown">
          {excel && (
            <button
              type="button"
              className="common-export-dropdown-item"
              onClick={handleExcelClick}
            >
              <FileSpreadsheet
                className="common-export-dropdown-icon excel"
                size={16}
              />

              <span className="common-export-dropdown-label">
                Excel
              </span>
            </button>
          )}

          {pdf && (
            <button
              type="button"
              className="common-export-dropdown-item"
              onClick={handlePdfClick}
            >
              <FileText
                className="common-export-dropdown-icon pdf"
                size={16}
              />

              <span className="common-export-dropdown-label">
                PDF
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ExportButton;
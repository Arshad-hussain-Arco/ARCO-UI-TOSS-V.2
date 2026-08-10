import { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, RefreshCw, Trash2 } from 'lucide-react';

import './ImageUpload.css';

/**
 * Reusable Image Upload component with visual preview.
 *
 * @param {Object} props
 * @param {File|null} props.file - Currently selected file.
 * @param {(file: File|null) => void} props.onChange - Handler when file is added or removed.
 * @param {string} [props.accept] - Accepted file types.
 * @param {string} [props.hint] - Helper text.
 */
export function ImageUpload({
  file,
  onChange,
  accept = 'image/png, image/jpeg, image/svg+xml',
  hint = 'PNG, JPG or SVG. Max 2MB.',
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);

  // Generate object URL for preview
  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreview(null);
    return undefined;
  }, [file]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave' || e.type === 'drop') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onChange(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onChange(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="ui-image-upload-wrapper">
      <div
        className="ui-image-upload-zone"
        role="button"
        tabIndex={0}
        data-drag={isDragging}
        onClick={() => {
          if (!preview) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !preview) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {preview ? (
          <>
            <img src={preview} alt="Upload preview" className="ui-image-upload-preview" />
            <div className="ui-image-upload-overlay">
              <button
                type="button"
                className="action-icon-btn edit"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <RefreshCw size={12} /> Replace
              </button>
              <button
                type="button"
                className="action-icon-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </>
        ) : (
          <>
            <ImageIcon size={24} className="ui-image-upload-icon" />
            <div>
              <p className="ui-image-upload-text">
                <strong>Click to upload</strong> or drag &amp; drop
              </p>
              {hint && <p className="ui-image-upload-hint">{hint}</p>}
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
}

export default ImageUpload;

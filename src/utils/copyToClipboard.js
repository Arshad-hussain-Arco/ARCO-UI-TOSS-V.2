import { toast } from "react-hot-toast";

/**
 * Detects whether a string looks like a file system path.
 * Supports: UNC (\\server\share), Windows (C:\path), Unix (/usr/bin).
 */
function getCopyLabel(text) {
  if (!text) return "Text";
  const t = text.trim();
  if (/^\\\\/.test(t) || /^\/\/[^/]/.test(t)) return "Path";
  if (/^[a-zA-Z]:[/\\]/.test(t)) return "Path";
  if (/^\/[^/ ]+\//.test(t)) return "Path";
  return "Text";
}

/**
 * Copies text to the clipboard and fires "Path copied!" or "Text copied!"
 * depending on the content type.
 */
export function copyWithToast(text) {
  const label = getCopyLabel(text);

  const doFallbackCopy = () => {
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try { document.execCommand("copy"); } catch (err) {}
    document.body.removeChild(tempInput);
    toast.success(`${label} copied!`);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied!`))
      .catch(doFallbackCopy);
  } else {
    doFallbackCopy();
  }
}

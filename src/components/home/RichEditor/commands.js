import { getBlocksInRange, applyInlineStyleOrPending, restoreCapturedRange } from './SelectionManager';

const INLINE_EXEC_COMMANDS = new Set([
  'bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'removeFormat',
]);

/** Pure inline toggles — still reliable cross-browser (incl. Safari) via execCommand. */
export function execInline(command) {
  if (!INLINE_EXEC_COMMANDS.has(command)) return;
  document.execCommand(command, false, null);
}

function isBlockTag(el, tag) {
  return el && el.tagName === tag.toUpperCase();
}

/** Sets the block format (p, h1-h6) for every block the range covers. */
export function formatBlock(range, editableEl, tag) {
  const blocks = getBlocksInRange(range, editableEl);
  if (blocks.length === 0) return;

  // Swapping a block's tag moves its existing children into a new
  // element (see restoreCapturedRange's doc comment for why that still
  // loses the live selection) — capture the caret's node/offset first so
  // it can be reapplied once the swap is done, otherwise the very next
  // keystroke lands somewhere else entirely instead of continuing in the
  // text the user just changed the style of.
  const { startContainer, startOffset, endContainer, endOffset } = range;

  blocks.forEach((block) => {
    if (!block || block.nodeType !== Node.ELEMENT_NODE) return;
    if (isBlockTag(block, tag)) return;
    const replacement = document.createElement(tag);
    while (block.firstChild) replacement.appendChild(block.firstChild);
    block.replaceWith(replacement);
  });

  restoreCapturedRange(startContainer, startOffset, endContainer, endOffset);
}

export function setAlignment(range, editableEl, alignment) {
  const blocks = getBlocksInRange(range, editableEl);
  blocks.forEach((block) => {
    if (block?.nodeType === Node.ELEMENT_NODE) block.style.textAlign = alignment;
  });
}

export function applyFontSize(range, editableEl, fontSize, pendingSpanRef) {
  applyInlineStyleOrPending(range, editableEl, { fontSize }, pendingSpanRef);
}

export function applyFontColor(range, editableEl, color, pendingSpanRef) {
  applyInlineStyleOrPending(range, editableEl, { color }, pendingSpanRef);
}

export function applyHighlight(range, editableEl, color, pendingSpanRef) {
  applyInlineStyleOrPending(range, editableEl, { backgroundColor: color }, pendingSpanRef);
}

/** Toggles a bullet/numbered list for the blocks the range covers. */
export function toggleList(range, editableEl, listTag) {
  const blocks = getBlocksInRange(range, editableEl);
  if (blocks.length === 0) return;
  const { startContainer, startOffset, endContainer, endOffset } = range;

  const allSameList = blocks.every(
    (b) => b?.tagName === 'LI' && b.parentElement?.tagName === listTag.toUpperCase()
  );

  if (allSameList) {
    // Toggle off — unwrap each <li> back into a <p>.
    const list = blocks[0].parentElement;
    const replacements = [];
    Array.from(list.children).forEach((li) => {
      const p = document.createElement('p');
      while (li.firstChild) p.appendChild(li.firstChild);
      replacements.push(p);
    });
    replacements.forEach((p) => list.parentNode.insertBefore(p, list));
    list.remove();
    restoreCapturedRange(startContainer, startOffset, endContainer, endOffset);
    return;
  }

  const list = document.createElement(listTag);
  blocks.forEach((block) => {
    const li = document.createElement('li');
    if (block.tagName === 'LI') {
      while (block.firstChild) li.appendChild(block.firstChild);
    } else {
      while (block.firstChild) li.appendChild(block.firstChild);
    }
    list.appendChild(li);
  });
  blocks[0].parentNode.insertBefore(list, blocks[0]);
  blocks.forEach((block) => block.remove());
  restoreCapturedRange(startContainer, startOffset, endContainer, endOffset);
}

const CHECKBOX_MARKUP = '<span class="rte-checkbox" contenteditable="false"></span>';

/** Checklist = <ul class="rte-checklist"> with a non-editable checkbox marker prepended to each <li>. */
export function toggleChecklist(range, editableEl) {
  const blocks = getBlocksInRange(range, editableEl);
  if (blocks.length === 0) return;
  const { startContainer, startOffset, endContainer, endOffset } = range;

  const allChecklist = blocks.every(
    (b) => b?.tagName === 'LI' && b.parentElement?.classList.contains('rte-checklist')
  );

  if (allChecklist) {
    const list = blocks[0].parentElement;
    const replacements = [];
    Array.from(list.children).forEach((li) => {
      const p = document.createElement('p');
      const checkbox = li.querySelector('.rte-checkbox');
      checkbox?.remove();
      while (li.firstChild) p.appendChild(li.firstChild);
      replacements.push(p);
    });
    replacements.forEach((p) => list.parentNode.insertBefore(p, list));
    list.remove();
    restoreCapturedRange(startContainer, startOffset, endContainer, endOffset);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'rte-checklist';
  blocks.forEach((block) => {
    const li = document.createElement('li');
    li.className = 'rte-checklist-item';
    li.dataset.checked = 'false';
    li.insertAdjacentHTML('afterbegin', CHECKBOX_MARKUP);
    while (block.firstChild) li.appendChild(block.firstChild);
    list.appendChild(li);
  });
  blocks[0].parentNode.insertBefore(list, blocks[0]);
  blocks.forEach((block) => block.remove());
  restoreCapturedRange(startContainer, startOffset, endContainer, endOffset);
}

const INDENT_STEP_PX = 24;
const MAX_INDENT_LEVEL = 5;

export function indent(range, editableEl) {
  const li = closestElement(range?.startContainer, 'li');
  if (li) {
    const list = li.parentElement;
    const prev = li.previousElementSibling;
    if (!prev) return; // first item in a list can't nest under nothing
    let nested = prev.querySelector(`:scope > ${list.tagName.toLowerCase()}`);
    if (!nested) {
      nested = document.createElement(list.tagName);
      prev.appendChild(nested);
    }
    nested.appendChild(li);
    return;
  }

  const blocks = getBlocksInRange(range, editableEl);
  blocks.forEach((block) => {
    if (block?.nodeType !== Node.ELEMENT_NODE) return;
    const current = parseInt(block.style.marginLeft || '0', 10) / INDENT_STEP_PX;
    if (current < MAX_INDENT_LEVEL) {
      block.style.marginLeft = `${(current + 1) * INDENT_STEP_PX}px`;
    }
  });
}

export function outdent(range, editableEl) {
  const li = closestElement(range?.startContainer, 'li');
  if (li) {
    const nestedList = li.parentElement;
    const parentLi = nestedList.parentElement?.closest('li');
    if (!parentLi) return;
    const outerList = parentLi.parentElement;
    outerList.insertBefore(li, parentLi.nextSibling);
    if (!nestedList.children.length) nestedList.remove();
    return;
  }

  const blocks = getBlocksInRange(range, editableEl);
  blocks.forEach((block) => {
    if (block?.nodeType !== Node.ELEMENT_NODE) return;
    const current = parseInt(block.style.marginLeft || '0', 10) / INDENT_STEP_PX;
    if (current > 0) {
      block.style.marginLeft = current - 1 > 0 ? `${(current - 1) * INDENT_STEP_PX}px` : '';
    }
  });
}

export function toggleBlockquote(range, editableEl) {
  const blocks = getBlocksInRange(range, editableEl);
  if (blocks.length === 0) return;
  const { startContainer, startOffset, endContainer, endOffset } = range;

  const allQuote = blocks.every((b) => b?.tagName === 'BLOCKQUOTE');
  if (allQuote) {
    blocks.forEach((bq) => {
      Array.from(bq.children).forEach((child) => bq.parentNode.insertBefore(child, bq));
      bq.remove();
    });
    restoreCapturedRange(startContainer, startOffset, endContainer, endOffset);
    return;
  }

  const blockquote = document.createElement('blockquote');
  blocks[0].parentNode.insertBefore(blockquote, blocks[0]);
  blocks.forEach((block) => blockquote.appendChild(block));
  restoreCapturedRange(startContainer, startOffset, endContainer, endOffset);
}

export function insertHorizontalRule(range) {
  if (!range) return;
  range.deleteContents();
  const hr = document.createElement('hr');
  range.insertNode(hr);
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  hr.parentNode.insertBefore(p, hr.nextSibling);

  const newRange = document.createRange();
  newRange.setStart(p, 0);
  newRange.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function closestElement(node, selector) {
  if (!node) return null;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el?.closest?.(selector) || null;
}

/** Creates/edits/removes a link. Never uses execCommand('createLink') — it can't set target/rel. */
export function applyLink(range, { href, openInNewTab = false }) {
  if (!range) return;
  const existingLink = closestElement(range.startContainer, 'a');

  if (existingLink && range.collapsed) {
    existingLink.setAttribute('href', href);
    if (openInNewTab) {
      existingLink.setAttribute('target', '_blank');
      existingLink.setAttribute('rel', 'noopener noreferrer');
    } else {
      existingLink.removeAttribute('target');
      existingLink.removeAttribute('rel');
    }
    return;
  }

  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  if (openInNewTab) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }

  if (range.collapsed) {
    anchor.textContent = href;
    range.insertNode(anchor);
  } else {
    const contents = range.extractContents();
    anchor.appendChild(contents);
    range.insertNode(anchor);
  }
}

export function removeLink(range) {
  const link = closestElement(range?.startContainer, 'a');
  if (!link) return;
  link.replaceWith(...link.childNodes);
}

export function getActiveLink(range) {
  return closestElement(range?.startContainer, 'a');
}

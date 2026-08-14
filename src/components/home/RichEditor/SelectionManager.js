/**
 * Pure Selection/Range helpers shared by Toolbar, EditableArea and the
 * command layer. Holds a single module-level "saved range" so toolbar
 * controls that must steal focus (color pickers, table grid, link dialog)
 * can restore the user's editing position before applying a command.
 */

let savedRange = null;

export function saveSelection(editableEl) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (editableEl && !editableEl.contains(range.commonAncestorContainer)) return null;
  savedRange = range.cloneRange();
  return savedRange;
}

export function getSavedSelection() {
  return savedRange;
}

export function restoreSelection(editableEl, range = savedRange) {
  if (!range) return;
  editableEl.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  savedRange = range;
}

export function isSelectionCollapsed(range = savedRange) {
  return !range || range.collapsed;
}

/** Returns the nearest ancestor element of a range boundary matching a selector. */
export function closestFromRange(range, selector) {
  if (!range) return null;
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest?.(selector) || null;
}

/**
 * Finds every top-level block element (direct-or-nearest child of
 * editableEl) that the range intersects. Used by heading/paragraph,
 * alignment, list, indent, and blockquote commands.
 */
export function getBlocksInRange(range, editableEl) {
  if (!range || !editableEl) return [];

  // A Range boundary can legitimately point AT editableEl itself rather
  // than a descendant — e.g. after Ctrl+A/selectNodeContents, whose
  // startContainer/endContainer is editableEl with an offset into its
  // childNodes. Resolve that to the actual child at that offset first,
  // otherwise the walk-up below immediately returns null and every
  // block-level command silently no-ops on a "select all" selection.
  const resolveBoundaryNode = (container, offset) => {
    if (container === editableEl) {
      const { childNodes } = editableEl;
      if (!childNodes.length) return null;
      return childNodes[Math.min(offset, childNodes.length - 1)];
    }
    return container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
  };

  const getTopBlock = (container, offset) => {
    let el = resolveBoundaryNode(container, offset);
    while (el && el.parentElement !== editableEl && el !== editableEl) {
      el = el.parentElement;
    }
    return el === editableEl ? null : el;
  };

  const startBlock = getTopBlock(range.startContainer, range.startOffset);
  const endBlock = getTopBlock(range.endContainer, range.endOffset);
  if (!startBlock) return [];

  let blocks;
  if (startBlock === endBlock) {
    blocks = [startBlock];
  } else {
    blocks = [];
    let node = startBlock;
    let guard = 0;
    while (node && guard < 5000) {
      if (node.nodeType === Node.ELEMENT_NODE) blocks.push(node);
      if (node === endBlock) break;
      node = node.nextSibling;
      guard += 1;
    }
    if (!blocks.length) blocks = [startBlock];
  }

  // A resolved top-level "block" can itself be a <ul>/<ol> — its <li>
  // children are one level deeper than editableEl's direct children, so
  // the walk-up above stops at the list container. Expand it to its
  // items so callers (toggleList/toggleChecklist in particular) see the
  // same shape they'd see for a selection confined to one <li>, instead
  // of treating the whole list as a single foreign block to re-wrap.
  return blocks.flatMap((block) =>
    block.tagName === 'UL' || block.tagName === 'OL' ? Array.from(block.children) : [block]
  );
}

/**
 * Applies inline CSS to every fully-covered text run in `range` by
 * splitting boundary text nodes and wrapping the covered text in a new
 * <span style="...">. Used for font family/size/color/highlight — avoids
 * execCommand('fontName'/'fontSize'), which emits legacy <font> tags and
 * behaves inconsistently across block boundaries.
 */
export function applyInlineStyle(range, styleProps, editableEl) {
  if (!range || range.collapsed) return;

  const startContainer = range.startContainer;
  const endContainer = range.endContainer;

  // Split boundary text nodes so only fully-covered nodes remain in scope.
  if (endContainer.nodeType === Node.TEXT_NODE && range.endOffset < endContainer.length) {
    endContainer.splitText(range.endOffset);
  }
  if (startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    const newStart = startContainer.splitText(range.startOffset);
    range.setStart(newStart, 0);
  }

  // A TreeWalker only visits DESCENDANTS of its root. Whenever the
  // selection exactly spans one whole text node — select-all, triple-
  // click, or dragging from the very start to the very end of a run —
  // range.commonAncestorContainer resolves to that TEXT NODE itself
  // (not its parent element), so a walker rooted there finds nothing and
  // silently no-ops. Root the walk at the nearest element instead.
  const walkRoot = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentNode
    : range.commonAncestorContainer;

  const walker = document.createTreeWalker(
    walkRoot,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return range.intersectsNode(node) && node.nodeValue.trim().length >= 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    }
  );

  const textNodes = [];
  let current = walker.nextNode();
  while (current) {
    if (range.intersectsNode(current)) textNodes.push(current);
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    if (!textNode.nodeValue) return;
    const span = document.createElement('span');
    Object.assign(span.style, styleProps);
    textNode.parentNode.insertBefore(span, textNode);
    span.appendChild(textNode);
  });

  mergeAdjacentSpans(editableEl);
}

/** Merges adjacent sibling <span> elements that share identical inline style. */
function mergeAdjacentSpans(editableEl) {
  if (!editableEl) return;
  const spans = editableEl.querySelectorAll('span[style]');
  spans.forEach((span) => {
    const next = span.nextSibling;
    if (
      next &&
      next.nodeType === Node.ELEMENT_NODE &&
      next.tagName === 'SPAN' &&
      next.getAttribute('style') === span.getAttribute('style')
    ) {
      while (next.firstChild) span.appendChild(next.firstChild);
      next.remove();
    }
  });
}

// Real-but-invisible character so a freshly-created "pending style" span
// isn't literally empty — an empty inline element is routinely discarded
// by the browser the moment focus/selection moves, which would silently
// drop the style before the user ever gets to type into it.
const PENDING_STYLE_MARKER = '​';

/**
 * Removes a previously-created pending-style span if the caret has since
 * moved away from it AND the user never actually typed real content into
 * it (still just the zero-width marker) — otherwise it would linger in
 * the saved HTML as an invisible, pointless empty span forever. Safe to
 * call unconditionally; no-ops if there's nothing to clean up.
 */
export function cleanupPendingStyleSpan(pendingSpanRef) {
  const span = pendingSpanRef.current;
  if (!span) return;
  if (!span.isConnected) {
    pendingSpanRef.current = null;
    return;
  }
  const sel = window.getSelection();
  const stillInside = sel.rangeCount > 0 && span.contains(sel.getRangeAt(0).startContainer);
  if (stillInside) return;

  if (span.textContent === PENDING_STYLE_MARKER) {
    span.remove();
  }
  pendingSpanRef.current = null;
}

/**
 * Applies inline CSS at the caret for text about to be typed (Word/Docs-
 * style "set the format, then keep typing"), for the collapsed-selection
 * case that applyInlineStyle intentionally ignores (there's no text run
 * to wrap yet). Creates one <span style="..."> containing a zero-width
 * marker, parks the caret inside it, and reuses/merges into that same
 * span for further style changes made before the user types anything —
 * so setting font size then color then continuing to type doesn't nest
 * three separate spans. `pendingSpanRef` is a ref shared with the caller
 * (RichEditorContext) so it survives across separate toolbar interactions.
 */
export function applyPendingCaretStyle(range, editableEl, styleProps, pendingSpanRef) {
  cleanupPendingStyleSpan(pendingSpanRef);

  const existing = pendingSpanRef.current;
  if (existing && existing.isConnected) {
    Object.assign(existing.style, styleProps);
    const caretRange = document.createRange();
    caretRange.selectNodeContents(existing);
    caretRange.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(caretRange);
    return;
  }

  const span = document.createElement('span');
  Object.assign(span.style, styleProps);
  const marker = document.createTextNode(PENDING_STYLE_MARKER);
  span.appendChild(marker);

  range.deleteContents();
  range.insertNode(span);

  const caretRange = document.createRange();
  caretRange.setStart(marker, marker.length);
  caretRange.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(caretRange);

  pendingSpanRef.current = span;
}

/**
 * Entry point for font size/color/highlight commands: wraps the selected
 * text run when there's a real (non-collapsed) selection, or parks a
 * pending caret style for text about to be typed when there isn't.
 */
export function applyInlineStyleOrPending(range, editableEl, styleProps, pendingSpanRef) {
  if (!range) return;
  if (!range.collapsed) {
    applyInlineStyle(range, styleProps, editableEl);
    return;
  }
  applyPendingCaretStyle(range, editableEl, styleProps, pendingSpanRef);
}

/**
 * Serializes a Range's position as a path of child-node indices from
 * editableEl down to the leaf, plus a text offset. Needed because Range
 * objects die across an innerHTML swap (undo/redo, external value change).
 */
export function captureSelectionPath(editableEl) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editableEl.contains(range.startContainer)) return null;

  const path = [];
  let node = range.startContainer;
  while (node && node !== editableEl) {
    const parent = node.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, node));
    node = parent;
  }
  return { path, offset: range.startOffset };
}

export function restoreSelectionFromPath(editableEl, saved) {
  if (!saved) return;
  try {
    let node = editableEl;
    for (const idx of saved.path) {
      if (!node.childNodes[idx]) return;
      node = node.childNodes[idx];
    }
    const range = document.createRange();
    const maxOffset = node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length;
    range.setStart(node, Math.min(saved.offset, maxOffset));
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Best-effort — if the DOM shape changed enough that the path is
    // invalid, leave the caret wherever the browser puts it by default.
  }
}

/**
 * Inserts block-level content (images/video/PDF/attachment cards — all
 * rendered as `display: block` elements, e.g. centered/floated media) at
 * the caret, splitting the containing paragraph in two around it rather
 * than dropping the block node in as an inline sibling of the surrounding
 * text. Without this, inserting an image mid-sentence produces an invalid
 * "block element inside a <p>" shape that browsers render as a jarring
 * line-break in the middle of the paragraph — reading as if the image
 * landed somewhere unrelated to the cursor. Plain (non-block) paste still
 * goes through the simpler insertHtmlAtSelection in ClipboardManager.js.
 */
export function insertBlockAtSelection(html, editableEl) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents(); // collapse to a caret, removing any selected text first

  let block = range.startContainer.nodeType === Node.TEXT_NODE
    ? range.startContainer.parentElement
    : range.startContainer;
  while (block && block.parentElement !== editableEl && block !== editableEl) {
    block = block.parentElement;
  }

  const fragment = range.createContextualFragment(html);
  const insertedNodes = Array.from(fragment.childNodes);
  if (insertedNodes.length === 0) return;

  if (!block || block === editableEl) {
    // Caret sits directly in the editable root (e.g. a freshly-emptied
    // editor) — nothing to split, just insert in place.
    range.insertNode(fragment);
  } else {
    // Move everything from the caret to the end of the current block into
    // a same-tag clone, insert the new nodes between the (now truncated)
    // original block and that clone.
    const afterRange = document.createRange();
    afterRange.setStart(range.startContainer, range.startOffset);
    afterRange.setEndAfter(block.lastChild ?? block);
    const afterFragment = afterRange.extractContents();

    let anchor = block;
    insertedNodes.forEach((node) => {
      block.parentNode.insertBefore(node, anchor.nextSibling);
      anchor = node;
    });

    const hasAfterContent = Array.from(afterFragment.childNodes).some(
      (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0)
    );
    if (hasAfterContent) {
      const afterBlock = block.cloneNode(false);
      afterBlock.appendChild(afterFragment);
      block.parentNode.insertBefore(afterBlock, anchor.nextSibling);
    }

    if (!block.textContent.trim() && block.querySelectorAll('img, video, embed, table, hr').length === 0) {
      block.remove();
    }
  }

  const lastInserted = insertedNodes[insertedNodes.length - 1];
  const newRange = document.createRange();
  newRange.setStartAfter(lastInserted);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/**
 * Re-applies a Range built from previously-captured boundary node/offset
 * pairs. Commands like formatBlock/toggleList/toggleBlockquote move a
 * block's existing child nodes into a brand-new wrapper element (so text
 * node references stay valid — they're relocated, not recreated) but
 * still call `oldBlock.replaceWith(newBlock)`, and browsers routinely
 * drop the live selection when an ancestor of the caret is detached like
 * that, even though the caret's actual text node is still attached
 * (just under a new parent) and perfectly valid to reselect. Call this
 * right after such a swap with the pre-mutation boundary points to put
 * the caret back where the user actually left it — otherwise the next
 * keystroke lands wherever the browser's post-mutation default happens
 * to be, not back in the text just formatted.
 */
export function restoreCapturedRange(startContainer, startOffset, endContainer, endOffset) {
  if (!startContainer || !endContainer) return;
  try {
    if (!startContainer.isConnected || !endContainer.isConnected) return;
    const maxStart = startContainer.nodeType === Node.TEXT_NODE ? startContainer.length : startContainer.childNodes.length;
    const maxEnd = endContainer.nodeType === Node.TEXT_NODE ? endContainer.length : endContainer.childNodes.length;
    const range = document.createRange();
    range.setStart(startContainer, Math.min(startOffset, maxStart));
    range.setEnd(endContainer, Math.min(endOffset, maxEnd));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Best-effort — if the node was actually removed/recreated (shouldn't
    // happen for these commands, which move rather than clone), leave the
    // caret wherever the browser's default lands.
  }
}

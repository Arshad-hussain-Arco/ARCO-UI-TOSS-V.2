import { useDocumentTitle } from '@hooks/useDocumentTitle';
import './HomeManagementUserGuidePage.css';

export function HomeManagementUserGuidePage() {
  useDocumentTitle('Home Content Management Guide');

  return (
    <div className="hmu-guide-page">
      <div className="hmu-guide-document">
        <h1 className="hmu-doc-title">HTML Fragment Widget — User Guide</h1>
        <p className="hmu-doc-subtitle">
          A guide for writing tables, buttons, icons, and emoji-based widgets inside the &quot;Rich Text Editor&quot; tab of a Home Card
        </p>

        <section className="hmu-doc-section">
          <h2>1. What This Editor Accepts</h2>
          <p>
            The content you write in the Rich Text Editor tab is injected as an HTML <strong>fragment</strong> into an
            existing container on the homepage — it is not loaded as a standalone document. Because of that, a normal,
            full HTML page will not work here.
          </p>
          <ul>
            <li>No <code>&lt;!DOCTYPE&gt;</code>, <code>&lt;html&gt;</code>, <code>&lt;head&gt;</code>, <code>&lt;body&gt;</code>, <code>&lt;meta&gt;</code>, or <code>&lt;title&gt;</code> — everything outside a body is discarded anyway.</li>
            <li>No <code>&lt;style&gt;</code> blocks. A sanitizer strips them the moment content is pasted or saved. Use inline <code>style=&quot;...&quot;</code> on every element instead.</li>
            <li>No <code>&lt;script&gt;</code>, ever — always stripped, no exceptions. The only interactivity available is the <code>data-copy-text</code> hook (Section 4).</li>
          </ul>
        </section>

        <section className="hmu-doc-section">
          <h2>2. Allowed Tags &amp; Attributes</h2>
          <br />
          <h3>2.1 Allowed tags</h3>
          <table className="hmu-doc-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Text / structure</td>
                <td><code>p, br, span, div, h1–h6, strong, b, em, i, u, s, sup, sub, blockquote, hr</code></td>
              </tr>
              <tr>
                <td>Lists</td>
                <td><code>ul, ol, li</code></td>
              </tr>
              <tr>
                <td>Tables</td>
                <td><code>table, thead, tbody, tfoot, tr, td, th, colgroup, col</code></td>
              </tr>
              <tr>
                <td>Media</td>
                <td><code>a, img, video, source, embed</code></td>
              </tr>
              <tr>
                <td>Other</td>
                <td><code>button, figure, figcaption, svg, path, rect, circle</code> (icons only)</td>
              </tr>
            </tbody>
          </table>

          <h3>2.2 Allowed attributes</h3>
          <p>
            <code>href, target, rel, src, alt, title, style, class, colspan, rowspan, width, height, border,
            cellpadding, cellspacing, align, valign, scope, headers, aria-label, data-copy-text</code>
          </p>

          <h3>2.3 Always stripped</h3>
          <ul>
            <li>Tags: <code>script, style, iframe, object, form, input, textarea, select</code></li>
            <li>Attributes: any <code>on*</code> handler (<code>onclick</code>, <code>onerror</code>, <code>onload</code>, <code>onmouseover</code>, <code>onfocus</code>, etc.) and <code>javascript:</code> URLs</li>
          </ul>
        </section>

        <section className="hmu-doc-section">
          <h2>3. Styling Rules</h2>
          <p>
            Since <code>&lt;style&gt;</code> blocks are stripped, every visual rule must live in an inline{' '}
            <code>style</code> attribute on the element itself:
          </p>
          <pre><code>{`<td style="border:1px solid #e2e5e9;padding:14px 16px;">Project Files</td>`}</code></pre>

          <h3>3.1 Dark mode</h3>
          <p>
            Avoid hardcoding <code>color:</code> values where possible. The homepage auto-adapts near-black / grey /
            blue text colors for dark mode, but only for colors it can confidently classify. Prefer leaving{' '}
            <code>color</code> unset (it inherits the theme-aware default) unless you specifically need a fixed
            brand color, e.g. a status dot or an accent border.
          </p>
          <div className="hmu-doc-callout">
            <strong>Rule of thumb:</strong> keep <code>border</code>, <code>background</code> accents, and icon
            strokes explicit; leave body text color alone.
          </div>
        </section>

        <section className="hmu-doc-section">
          <h2>4. Interactivity: data-copy-text</h2>
          <p>
            This is the <strong>only</strong> supported way to make an element interactive without JavaScript. Add{' '}
            <code>data-copy-text=&quot;some value&quot;</code> to any element (typically a <code>&lt;button&gt;</code>) and
            clicking it copies that value to the clipboard. The app automatically flashes the element green with
            &quot;Copied!&quot; for 1.5 seconds — do not try to recreate that flash yourself, and do not add an{' '}
            <code>onclick</code> handler; it will be stripped.
          </p>
          <pre><code>{`<button data-copy-text="\\\\server01\\shared\\project-files"
        style="border:1px solid #c7cbd1;padding:8px 20px;
               border-radius:4px;cursor:pointer;">
  Copy
</button>`}</code></pre>
          <p>
            There is currently no other interactive hook available — no tabs, accordions, or modals. Anything beyond
            copy-to-clipboard requires a real product feature, not raw HTML.
          </p>
        </section>

        <section className="hmu-doc-section">
          <h2>5. Images, Video, and Attachments</h2>
          <p>
            Never hand-write an <code>&lt;img src=&quot;...&quot;&gt;</code> tag for an uploaded file. Use the editor&apos;s Image /
            Video / PDF / File toolbar buttons instead — they upload to the backend and stamp the required{' '}
            <code>data-src</code>, <code>data-filename</code>, <code>data-media-id</code>, etc. attributes that the
            render pipeline depends on. A manually written <code>&lt;img&gt;</code> pointing at a raw path will not
            get token or rewrite handling.
          </p>
          <p>
            Icons are the one exception: build them directly with inline <code>svg</code>, <code>path</code>,{' '}
            <code>circle</code>, <code>rect</code> elements and inline styles (see Section 7.4).
          </p>
        </section>

        <section className="hmu-doc-section">
          <h2>6. Step-by-Step: Building a Widget</h2>
          <ul>
            <li><strong>Plan the layout</strong> — sketch it as a table, a stack of divs, or a mix of both. Avoid relying on <code>flex</code> inside table cells; it renders inconsistently. Use <code>vertical-align:middle</code> on inline elements within a <code>&lt;td&gt;</code> instead.</li>
            <li><strong>Write structure first, style second</strong> — get the tags right (table/tr/td, or div/span), then add <code>style=&quot;...&quot;</code> to each element individually.</li>
            <li><strong>Add borders and spacing</strong> with <code>border</code>, <code>padding</code>, <code>border-radius</code> on table cells or divs — there is no shared stylesheet to fall back on.</li>
            <li><strong>Drop in emoji</strong> directly as unicode characters — no markup needed, and they render identically in light and dark mode.</li>
            <li><strong>Add icons</strong> only via inline <code>&lt;svg&gt;</code> with <code>&lt;circle&gt;</code>/<code>&lt;path&gt;</code>/<code>&lt;rect&gt;</code>, sized around 18–24px, with explicit stroke colors so they stay visible on both themes.</li>
            <li><strong>Wire up copy buttons</strong> with <code>data-copy-text</code> wherever a user might want to copy a path, link, or email — never with <code>onclick</code>.</li>
            <li><strong>Leave text color unset</strong> unless it is a fixed brand/status color, so dark mode can adapt it automatically.</li>
            <li><strong>Test by pasting</strong> into the editor and checking that nothing silently disappeared (a stripped tag/attribute fails silently, not with an error).</li>
          </ul>
        </section>

        <section className="hmu-doc-section">
          <h2>7. Worked Examples</h2>

          <h3>7.1 A simple table with a copy button</h3>
          <pre><code>{`<table style="width:100%;border-collapse:collapse;">
  <thead>
    <tr>
      <th style="border:1px solid #e2e5e9;padding:12px 14px;text-align:left;">Name</th>
      <th style="border:1px solid #e2e5e9;padding:12px 14px;text-align:left;">Path</th>
      <th style="border:1px solid #e2e5e9;padding:12px 14px;"></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #e2e5e9;padding:12px 14px;">Project Files</td>
      <td style="border:1px solid #e2e5e9;padding:12px 14px;font-family:Consolas,monospace;font-size:13px;">
        \\\\server01\\shared\\project-files
      </td>
      <td style="border:1px solid #e2e5e9;padding:12px 14px;">
        <button data-copy-text="\\\\server01\\shared\\project-files"
                style="border:1px solid #c7cbd1;padding:6px 16px;border-radius:4px;cursor:pointer;">
          Copy
        </button>
      </td>
    </tr>
  </tbody>
</table>`}</code></pre>

          <h3>7.2 Icon + link row without flex</h3>
          <p>
            Use <code>vertical-align:middle</code> on an inline <code>&lt;span&gt;</code> wrapper and the{' '}
            <code>&lt;a&gt;</code> tag, rather than <code>display:flex</code> on the <code>&lt;td&gt;</code>, so icon
            and text line up correctly inside the table cell.
          </p>
          <pre><code>{`<td style="border:1px solid #e2e5e9;padding:16px 18px;">
  <span style="display:inline-block;vertical-align:middle;margin-right:14px;">
    <svg width="22" height="22" viewBox="0 0 20 20" style="vertical-align:middle;">
      <circle cx="10" cy="10" r="9" style="fill:none;stroke:#3b82f6;stroke-width:2;" />
      <path d="M6 10 L9 13 L14 7" style="fill:none;stroke:#3b82f6;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" />
    </svg>
  </span>
  <a href="https://example.com/vpn-setup" target="_blank" rel="noopener"
     style="vertical-align:middle;text-decoration:none;font-size:15px;">
    VPN Setup Guide
  </a>
</td>`}</code></pre>

          <h3>7.3 Emoji stat cards</h3>
          <pre><code>{`<div style="display:flex;gap:16px;flex-wrap:wrap;">
  <div style="flex:1;min-width:140px;border:1px solid #e2e5e9;border-radius:8px;padding:16px;text-align:center;">
    <div style="font-size:28px;">🚀</div>
    <div style="font-size:22px;font-weight:700;">12</div>
    <div style="opacity:0.7;font-size:13px;">Completed</div>
  </div>
</div>`}</code></pre>
          <p>
            Note: <code>display:flex</code> is fine on plain <code>&lt;div&gt;</code> containers — the inconsistency
            only shows up when applying it to a <code>&lt;td&gt;</code>.
          </p>

          <h3>7.4 An SVG smiley (icon-only elements)</h3>
          <pre><code>{`<svg width="120" height="120" viewBox="0 0 160 160">
  <circle cx="80" cy="80" r="70" style="fill:#ffd93b;stroke:#e0a800;stroke-width:3;" />
  <circle cx="55" cy="65" r="8" style="fill:#3a3a3a;" />
  <circle cx="105" cy="65" r="8" style="fill:#3a3a3a;" />
  <path d="M 45 95 Q 80 130 115 95" style="fill:none;stroke:#3a3a3a;stroke-width:6;stroke-linecap:round;" />
</svg>`}</code></pre>
        </section>

        <section className="hmu-doc-section">
          <h2>8. Pre-Submit Checklist</h2>
          <ul className="hmu-doc-checklist">
            <li>No <code>&lt;!DOCTYPE&gt;</code>, <code>&lt;html&gt;</code>, <code>&lt;head&gt;</code>, <code>&lt;body&gt;</code>, <code>&lt;meta&gt;</code>, or <code>&lt;title&gt;</code></li>
            <li>No <code>&lt;style&gt;</code> block anywhere — every rule is inline</li>
            <li>No <code>&lt;script&gt;</code> and no <code>on*</code> attributes (<code>onclick</code>, <code>onload</code>, etc.)</li>
            <li>No raw <code>&lt;img src=&quot;...&quot;&gt;</code> for uploaded media — use the toolbar upload buttons</li>
            <li>Every interactive element uses <code>data-copy-text</code>, not JavaScript</li>
            <li>Text color left unset unless it is an intentional fixed accent</li>
            <li>Icons built from inline <code>svg</code> / <code>circle</code> / <code>path</code> / <code>rect</code> only</li>
            <li>Layout inside table cells uses <code>vertical-align</code>, not flex</li>
          </ul>
        </section>

        <section className="hmu-doc-section">
          <h2>9. Common Mistakes</h2>
          <table className="hmu-doc-table">
            <thead>
              <tr>
                <th>Mistake</th>
                <th>Fix</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pasting a full HTML page with <code>&lt;head&gt;</code>/<code>&lt;body&gt;</code></td>
                <td>Strip everything down to the fragment that would sit inside the body</td>
              </tr>
              <tr>
                <td>Using a <code>&lt;style&gt;</code> block</td>
                <td>Move every rule into inline <code>style=&quot;...&quot;</code> on each element</td>
              </tr>
              <tr>
                <td>Adding <code>onclick=&quot;...&quot;</code> to a button</td>
                <td>Replace with <code>data-copy-text=&quot;...&quot;</code> and let the app handle the click</td>
              </tr>
              <tr>
                <td><code>display:flex</code> on a <code>&lt;td&gt;</code></td>
                <td>Use <code>vertical-align:middle</code> on inline-block spans / links instead</td>
              </tr>
              <tr>
                <td>Hardcoding black/white text color</td>
                <td>Leave <code>color</code> unset so dark mode can adapt it automatically</td>
              </tr>
              <tr>
                <td>Writing <code>&lt;img src=&quot;/uploads/...&quot;&gt;</code> by hand</td>
                <td>Use the editor&apos;s Image upload button instead</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default HomeManagementUserGuidePage;

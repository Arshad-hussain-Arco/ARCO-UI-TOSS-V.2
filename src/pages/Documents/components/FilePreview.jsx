import { File as FileIcon } from 'lucide-react';

function PdfPreview({ file }) {
  return (
    <div className="doc-pdf-viewer">
      <div className="doc-pdf-page">
        <div className="doc-pdf-content">
          <h2 className="doc-pdf-doc-title">{file.name.replace('.pdf', '')}</h2>
          <div className="doc-pdf-section">
            <h3>Executive Summary</h3>
            <p>
              This document outlines the comprehensive capacity planning strategy for
              fiscal year 2026, covering infrastructure, human resources, and
              technology investments required to support projected business growth.
            </p>
          </div>
          <div className="doc-pdf-section">
            <h3>Current State Analysis</h3>
            <p>
              Our current infrastructure supports approximately 2,500 concurrent users
              with an average response time of 250ms. Database utilization stands at
              68% with storage consumption at 12TB.
            </p>
            <p>
              The engineering team comprises 45 full-time employees distributed across
              6 cross-functional squads, with an additional 12 contractors supporting
              specialized workstreams.
            </p>
          </div>
          <div className="doc-pdf-section">
            <h3>Growth Projections</h3>
            <p>
              Based on Q4 2025 performance metrics and market analysis, we anticipate
              a 40% increase in user base, translating to approximately 3,500
              concurrent users by Q3 2026.
            </p>
            <ul>
              <li>Infrastructure scaling: Additional 8 compute nodes required</li>
              <li>Storage expansion: Estimated 18TB additional capacity</li>
              <li>
                Team expansion: 12 new engineering hires across backend, frontend, and
                DevOps
              </li>
            </ul>
          </div>
          <div className="doc-pdf-section">
            <h3>Investment Requirements</h3>
            <p>
              Total estimated budget for capacity expansion: ₹4.2 Cr, distributed
              across infrastructure (45%), personnel (40%), and tooling/software
              licenses (15%).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocxPreview({ file }) {
  return (
    <div className="doc-docx-viewer">
      <div className="doc-docx-page">
        <div className="doc-docx-content">
          <h1 className="doc-docx-title">{file.name.replace('.docx', '')}</h1>
          <p className="doc-docx-meta">Owner: {file.owner} | Last Modified: {file.lastModified}</p>

          <h3>1. Project Scope & Purpose</h3>
          <p>
            This project document serves as the master blueprint for the Q1 releases lifecycle. The primary objectives are to optimize platform execution speeds, standardize client dashboard pages, and deploy automated reconciliation flows.
          </p>

          <h3>2. Key Delivery Milestones</h3>
          <ul>
            <li><strong>Milestone A:</strong> Complete refactoring of client role authentication checks (Target: Jan 20).</li>
            <li><strong>Milestone B:</strong> Implement leaves balance settings UI overrides with complete mobile scrolling grids (Target: Feb 2).</li>
            <li><strong>Milestone C:</strong> Staging verification and consultant analytics dashboard launch (Target: Feb 18).</li>
          </ul>

          <h3>3. Operations & Team Alignment</h3>
          <p>
            Squad leaders are requested to sync daily on pending pull requests. Design frameworks must adhere closely to established CSS tokens to maintain layout integrity. Please report index compilation issues to DB Admins immediately.
          </p>
        </div>
      </div>
    </div>
  );
}

function XlsxPreview() {
  return (
    <div className="doc-xlsx-viewer">
      <div className="doc-xlsx-grid-wrapper">
        <div className="doc-xlsx-sheet-header">
          <span className="doc-xlsx-sheet-title">Sheet1</span>
          <span className="doc-xlsx-sheet-plus">+</span>
        </div>
        <table className="doc-xlsx-table">
          <thead>
            <tr>
              <th className="row-number-th"></th>
              <th>A</th>
              <th>B</th>
              <th>C</th>
              <th>D</th>
              <th>E</th>
              <th>F</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="row-number-td">1</td>
              <td className="doc-xlsx-cell header-cell" colSpan={6} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e2e8f0' }}>Budget & Resource Scaling Forecast</td>
            </tr>
            <tr>
              <td className="row-number-td">2</td>
              <td className="doc-xlsx-cell label-cell"><strong>Item Description</strong></td>
              <td className="doc-xlsx-cell label-cell"><strong>Category</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>Q1</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>Q2</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>Q3</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>Total</strong></td>
            </tr>
            <tr>
              <td className="row-number-td">3</td>
              <td className="doc-xlsx-cell">Compute Cloud Nodes</td>
              <td className="doc-xlsx-cell">Infrastructure</td>
              <td className="doc-xlsx-cell number-cell">₹1.2 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹1.2 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹0.8 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹3.2 Cr</td>
            </tr>
            <tr>
              <td className="row-number-td">4</td>
              <td className="doc-xlsx-cell">Database Storage Cluster</td>
              <td className="doc-xlsx-cell">Infrastructure</td>
              <td className="doc-xlsx-cell number-cell">₹0.6 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹0.6 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹0.4 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹1.6 Cr</td>
            </tr>
            <tr>
              <td className="row-number-td">5</td>
              <td className="doc-xlsx-cell">Engineering Personnel</td>
              <td className="doc-xlsx-cell">Staffing</td>
              <td className="doc-xlsx-cell number-cell">₹1.8 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹1.8 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹1.8 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹5.4 Cr</td>
            </tr>
            <tr>
              <td className="row-number-td">6</td>
              <td className="doc-xlsx-cell">Software Licensing & Dev Tools</td>
              <td className="doc-xlsx-cell">Licenses</td>
              <td className="doc-xlsx-cell number-cell">₹0.4 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹0.2 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹0.2 Cr</td>
              <td className="doc-xlsx-cell number-cell">₹0.8 Cr</td>
            </tr>
            <tr className="total-row">
              <td className="row-number-td">7</td>
              <td className="doc-xlsx-cell"><strong>Total Estimated Budget</strong></td>
              <td className="doc-xlsx-cell"><strong>All Categories</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>₹4.0 Cr</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>₹3.8 Cr</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>₹3.2 Cr</strong></td>
              <td className="doc-xlsx-cell number-cell"><strong>₹11.0 Cr</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PngPreview() {
  return (
    <div className="doc-png-viewer">
      <div className="doc-png-canvas">
        <span className="doc-png-canvas-title">System Architecture Blueprint</span>
        <svg width="100%" height="260" viewBox="0 0 600 260" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="30" y="90" width="100" height="50" rx="6" fill="#F8FAFC" stroke="#0f766e" strokeWidth="2" />
          <text x="80" y="120" textAnchor="middle" fill="#0f766e" fontSize="12" fontWeight="600">Client Apps</text>

          <path d="M130 115H170" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
          <polygon points="170,111 178,115 170,119" fill="#94A3B8" />

          <rect x="180" y="90" width="100" height="50" rx="6" fill="#E6F4ED" stroke="#115E59" strokeWidth="2" />
          <text x="230" y="120" textAnchor="middle" fill="#115E59" fontSize="12" fontWeight="600">API Gateway</text>

          <path d="M280 115H320" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
          <polygon points="320,111 328,115 320,119" fill="#94A3B8" />

          <rect x="330" y="90" width="100" height="50" rx="6" fill="#F8FAFC" stroke="#0f766e" strokeWidth="2" />
          <text x="380" y="120" textAnchor="middle" fill="#0f766e" fontSize="12" fontWeight="600">Services Layer</text>

          <path d="M430 115H470" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
          <polygon points="470,111 478,115 470,119" fill="#94A3B8" />

          <rect x="480" y="70" width="90" height="90" rx="6" fill="#F0FDF4" stroke="#15803D" strokeWidth="2" />
          <text x="525" y="110" textAnchor="middle" fill="#15803D" fontSize="12" fontWeight="600">Database</text>
          <text x="525" y="130" textAnchor="middle" fill="#6B7280" fontSize="10">Cluster (Postgres)</text>
        </svg>
        <div className="doc-png-legend">
          <span className="legend-item"><span className="legend-dot green"></span>Secure Gateway</span>
          <span className="legend-item"><span className="legend-dot teal"></span>Auth & Route APIs</span>
        </div>
      </div>
    </div>
  );
}

/** Dispatches to a format-specific mock preview renderer based on file type. */
export function FilePreview({ file }) {
  switch (file.type) {
    case 'pdf':
      return <PdfPreview file={file} />;
    case 'docx':
      return <DocxPreview file={file} />;
    case 'xlsx':
      return <XlsxPreview file={file} />;
    case 'png':
      return <PngPreview file={file} />;
    default:
      return (
        <div className="doc-preview-placeholder">
          <FileIcon size={48} className="doc-preview-placeholder-icon" />
          <p className="doc-preview-placeholder-text">Preview not available for this file type</p>
        </div>
      );
  }
}

export default FilePreview;

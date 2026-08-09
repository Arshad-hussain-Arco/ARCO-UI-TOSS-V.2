import React from 'react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import './ReconciliationUserGuidePage.css';

export function ReconciliationUserGuidePage() {
  useDocumentTitle('Reconciliation Guide');

  return (
    <div className="ru-guide-page">
      <div className="ru-guide-document">
        <h1 className="ru-doc-title">FILE RECONCILIATION SYSTEM - USER GUIDE</h1>

        <section className="ru-doc-section">
          <h2>Overview:</h2>
          <p>
            The File Reconciliation System is a powerful tool that compares two data files to identify matches, 
            mismatches, missing records, and duplicates. It supports multiple file formats and provides detailed 
            reporting capabilities.
          </p>
        </section>

        <section className="ru-doc-section">
          <h2>Supported File Formats:</h2>
          <ul>
            <li><strong>CSV</strong> (Comma-Separated Values)</li>
            <li><strong>Excel</strong> (.xlsx, .xls)</li>
            <li><strong>XML</strong> (Extensible Markup Language)</li>
            <li><strong>JSON</strong> (JavaScript Object Notation)</li>
          </ul>
          <div className="ru-doc-note">
            <strong>Note:</strong> You can upload any combination of supported file types (e.g., XML and CSV).
          </div>
        </section>

        <section className="ru-doc-section">
          <h2>Step-by-Step Guide:</h2>
          
          <h3>Step 1: Upload Files</h3>
          <h4>How to Upload:</h4>
          <ol>
            <li>Click <strong>"Browse File"</strong> or <strong>drag and drop</strong> your file into the upload area.</li>
            <li>
              Upload both:
              <ul>
                <li><strong>File 1 (Source):</strong> Your primary/reference file</li>
                <li><strong>File 2 (Target/Destination):</strong> The file to compare against</li>
              </ul>
            </li>
          </ol>
          <img src="/docs/images/image1.jpeg" className="ru-doc-image" alt="Upload Files Area" />

          <h4>After Upload, You'll See:</h4>
          <ul>
            <li>File name</li>
            <li>Total number of records</li>
            <li>File size</li>
          </ul>
          <img src="/docs/images/image2.jpeg" className="ru-doc-image" alt="Uploaded Files View" />

          <div className="ru-doc-note">
            <strong>Important Notes:</strong>
            <ul>
              <li>Any combination of supported formats can be reconciled.</li>
              <li>Large files are supported.</li>
              <li>You can replace a file anytime by uploading a new one.</li>
            </ul>
          </div>

          <h3>Step 2: Select Key Columns</h3>
          <p>
            Key columns are selected fields from each file that together form a <strong>temporary key</strong> used 
            during reconciliation.
          </p>
          <p>
            This key acts as a <strong>reference identifier</strong> to match and compare records between the two files.
          </p>

          <h4>Key Selection Modes:</h4>
          <ul>
            <li>
              <strong>Select exactly 1 column</strong> in each file<br />
              <em>Example: Employee_ID in both files</em>
            </li>
            <li>
              <strong>Composite Key Mode:</strong><br />
              Select <strong>multiple columns</strong> (2 or more) in each file.<br />
              <strong>Must select the same number</strong> of columns in both files.<br />
              <em>Example: First_Name + Last_Name + Department</em>
            </li>
          </ul>

          <h4>Notes:</h4>
          <ul>
            <li>Selecting <strong>one column</strong> in each file creates a <strong>single key</strong>.</li>
            <li>Selecting <strong>multiple columns</strong> (with the same count in both files) creates a <strong>composite key</strong>.</li>
            <li>The temporary key exists <strong>only during reconciliation</strong> and does not modify the original files.</li>
          </ul>
          
          <div className="ru-doc-highlight">
            Choosing the correct key columns is critical for accurate reconciliation results.
          </div>

          <h4>How to Select:</h4>
          <ol>
            <li>Check the boxes next to column names.</li>
            <li>Ensure the same number of columns are selected on both sides.</li>
            <li>Preview shows the first 5 rows to help you identify the right columns.</li>
          </ol>

          <h4>Validation:</h4>
          <ul>
            <li>The "Next" button activates only when valid key columns are selected</li>
            <li>Counter shows: Selected: X column(s)</li>
          </ul>
          <img src="/docs/images/image3.jpeg" className="ru-doc-image" alt="Select Key Columns" />

          <h3>Step 3: Map Columns</h3>
          <p>Map columns from <strong>File 1</strong> to their corresponding columns in <strong>File 2</strong> to compare their values.</p>
          
          <ol type="a">
            <li>
              <strong>Auto-Mapping:</strong>
              <ul>
                <li>Click <strong>"Auto-Map Matching Columns"</strong> to automatically map columns with identical names. Case-insensitive matching (e.g., 'Name' matches 'name')</li>
              </ul>
            </li>
            <li>
              <strong>Manual Mapping:</strong>
              <ul>
                <li>Use dropdowns to map each Source column to a Destination column</li>
                <li>Select <strong>"-- Skip --"</strong> to exclude a column from comparison</li>
              </ul>
            </li>
          </ol>

          <h4>Column Configuration:</h4>
          <p><strong>Data Type:</strong> (Auto-detected, but you can override)</p>
          <ul>
            <li><strong>Numerical:</strong> Numbers, integers, decimals</li>
            <li><strong>Categorical:</strong> Text, strings, categories</li>
            <li><strong>Date:</strong> Date values (YYYY-MM-DD)</li>
            <li><strong>Time:</strong> Time values (HH:MM:SS)</li>
            <li><strong>Timestamp:</strong> Date + Time combined</li>
          </ul>
          <div className="ru-doc-highlight">Unmapped columns are highlighted for visibility.</div>

          <h4>Comparison Settings (For Numerical columns only):</h4>
          <ol type="i">
            <li>
              <strong>Tolerance:</strong>
              <ul>
                <li>Acceptable difference between values</li>
                <li>Example: Tolerance of <strong>0.01</strong> means <strong>100.00</strong> matches <strong>100.01</strong></li>
                <li>Default: <strong>0.00</strong> (exact match)</li>
              </ul>
            </li>
            <li>
              <strong>Round Off:</strong>
              <ul>
                <li>Decimal places for rounding before comparison</li>
                <li>Options: None, 0, 1, 2, 3, 4</li>
                <li>Example: Rounding to <strong>2</strong> places means <strong>3.14159</strong> becomes <strong>3.14</strong></li>
              </ul>
            </li>
          </ol>

          <h4>Exclude from Comparison:</h4>
          <ul>
            <li>Check this box to include the column in results but skip value comparison</li>
            <li>Useful for metadata or reference columns</li>
          </ul>

          <h4>Run Reconciliation:</h4>
          <ul>
            <li>Starts the reconciliation process using the selected key columns, column mappings, and comparison settings, and generates the final reconciliation results.</li>
          </ul>

          <h4>Unmapped Columns:</h4>
          <ul>
            <li>Columns that don't have a mapping will be included in the results but not compared</li>
            <li>Highlighted in coloured boxes for visibility</li>
          </ul>

          <h4>Reset All Settings (button):</h4>
          <ul>
            <li>Resets all column mappings, data type selections, and comparison settings, and allows users to start the mapping process from scratch.</li>
          </ul>
          <img src="/docs/images/image4.jpeg" className="ru-doc-image" alt="Map Columns" />
          
          <div className="ru-doc-highlight">
            If all the columns are mapped successfully and no columns are left in either of the files (e.g., extra columns), then you’ll see something like:
          </div>
          <img src="/docs/images/image5.jpeg" className="ru-doc-image" alt="All columns mapped" />

          <h3>Step 4: View Results</h3>
          <p>After reconciliation completes, you'll see:</p>
          
          <h4>Summary Statistics:</h4>
          <ul>
            <li><strong>Matched</strong> - Records found in both files with matching values</li>
            <li><strong>Mismatched</strong> - Records found in both files but with different values</li>
            <li><strong>Missing</strong> - Records present in only one file</li>
            <li><strong>Duplicates</strong> - Records with duplicate keys in either file</li>
            <li><strong>Match Rate</strong> - Percentage of exact matches</li>
          </ul>
          <div className="ru-doc-highlight">
            Summary statistics such as match rate and record counts are displayed for quick insight.
          </div>

          <h4>Detailed Results Tabs Exploration:</h4>
          <p>Users can:</p>
          <ul>
            <li>Switch between result categories using tabs</li>
            <li>Inspect individual records and differences</li>
            <li>View side-by-side comparisons for mismatched records</li>
            <li>Navigate missing and duplicate records using subtabs</li>
          </ul>

          <h4>Matched Records:</h4>
          <ul>
            <li>Shows all records that matched perfectly</li>
          </ul>

          <h4>Mismatched Records:</h4>
          <ul>
            <li>Shows records where values differ</li>
            <li><strong>The differences column</strong> highlights exactly which fields differ</li>
            <li>Format: Column: <strong>"Source Value" → "Destination Value"</strong></li>
          </ul>

          <h4>Missing Records:</h4>
          <ul>
            <li><strong>Missing in Destination (Only in Source):</strong> Records present only in File 1.</li>
            <li><strong>Missing in Source (Only in Destination):</strong> Records present only in File 2.</li>
            <li>Use sub-tabs to switch between views.</li>
          </ul>

          <h4>Duplicate Records:</h4>
          <ul>
            <li><strong>Duplicates in Source:</strong> Shows duplicate keys in File 1.</li>
            <li><strong>Duplicates in Destination:</strong> Shows duplicate keys in File 2.</li>
            <li>Includes duplicate count for each key.</li>
          </ul>
          <img src="/docs/images/image6.jpeg" className="ru-doc-image" alt="Detailed Results" />

          <h4>Exporting Results:</h4>
          <ol type="a">
            <li>Click the <strong>"Export Report"</strong> button</li>
          </ol>
          <img src="/docs/images/image7.jpeg" className="ru-doc-image" alt="Export Report Button" />
          <ol type="a" start="2">
            <li>
              Optionally customize column prefixes in the modal:
              <ul>
                <li>This can be applied to distinguish source and target columns.</li>
                <li>Default: Columns suffixed with <code>_SRC</code> and <code>_DST</code></li>
                <li>Custom: Enter your own prefixes (e.g., <code>_PROD</code>, <code>_UAT</code>)</li>
              </ul>
            </li>
            <li>Click <strong>"Export Report"</strong> to download</li>
          </ol>
          <img src="/docs/images/image8.jpeg" className="ru-doc-image" alt="Export Modal" />

          <div className="ru-doc-highlight">Excel Report Contains:</div>
          
          <h4>Sheet 1: Summary:</h4>
          <ul>
            <li>File names</li>
            <li>Total records in each file</li>
            <li>Count of matched, mismatched, missing, and duplicate records</li>
            <li>Match rates</li>
          </ul>

          <h4>Sheet 2: Matched Records:</h4>
          <ul>
            <li>All matched records with source and destination columns side-by-side.</li>
            <li>Column separator (<code>||</code>) for easy reading</li>
          </ul>

          <h4>Sheet 3: Mismatched Records:</h4>
          <ul>
            <li>All mismatched records</li>
            <li>Additional "Differences" column showing field-level changes</li>
          </ul>

          <h4>Sheet 4: Missing Records</h4>
          <ul>
            <li>
              Two sections:
              <ul>
                <li>Records missing in Destination</li>
                <li>Records missing in Source</li>
              </ul>
            </li>
          </ul>

          <h4>Sheet 5: Duplicate Records</h4>
          <ul>
            <li>
              Two sections with duplicate counts:
              <ul>
                <li>Duplicates in Source</li>
                <li>Duplicates in Destination</li>
              </ul>
            </li>
          </ul>

          <div className="ru-doc-highlight">Match Rate:</div>
          <p>
            Match Rate represents the <strong>percentage of records that exist in both files</strong>, including records 
            that match exactly and records that have differences.
          </p>
          <p>It shows how many records could be successfully paired between the two files.</p>

          <div className="ru-doc-highlight">Exact Match Rate:</div>
          <p>
            Exact Match Rate represents the <strong>percentage of records that match perfectly</strong> between the 
            two files, with no differences in the compared columns.
          </p>
          <p>It indicates the overall <strong>data consistency and accuracy</strong> between the files.</p>

          <div className="ru-doc-highlight">Mathematical Equation:</div>
          
          <div className="ru-math-equation">
            <span className="ru-math-label">Match Rate(%) =</span>
            <div className="ru-math-fraction">
              <span className="ru-math-numerator">Records present in both the files</span>
              <span className="ru-math-denominator">Total unique records across both the files</span>
            </div>
            <span className="ru-math-multiplier">* 100</span>
          </div>

          <div className="ru-math-equation">
            <span className="ru-math-label">Exact Match Rate(%) =</span>
            <div className="ru-math-fraction">
              <span className="ru-math-numerator">Exactly matched records</span>
              <span className="ru-math-denominator">Total unique records across both the files</span>
            </div>
            <span className="ru-math-multiplier">* 100</span>
          </div>
          
          <h4>Example:</h4>
          <ul>
            <li>Total unique records: <strong>1,000</strong></li>
            <li>Records present in both files: <strong>800</strong></li>
            <li>Exactly matched records: <strong>650</strong></li>
          </ul>
          <p>Match Rate = (800/1000) * 100 = <strong>80%</strong></p>
          <p>Exact Match Rate = (650/1000) * 100 = <strong>65%</strong></p>

          <div className="ru-doc-highlight">Starting a New Reconciliation:</div>
          <p>After completing a reconciliation:</p>
          <ol type="a">
            <li>Click <strong>Start New Reconciliation</strong></li>
            <li>Upload new files and repeat the workflow</li>
          </ol>
          <img src="/docs/images/image9.jpeg" className="ru-doc-image" alt="Start New Reconciliation" />
        </section>

        <section className="ru-doc-section">
          <div className="ru-doc-highlight">Tips & Best Practices:</div>
          
          <h4>File Preparation:</h4>
          <ul>
            <li>Ensure column headers are in the first row</li>
            <li>Remove empty rows and columns</li>
            <li>Use consistent data formats (dates, numbers)</li>
            <li>Avoid special characters in column names.</li>
          </ul>

          <h4>Key Column Selection:</h4>
          <ul>
            <li>Choose columns that uniquely identify each record</li>
            <li>For composite keys, maintain the same order in both files</li>
            <li>Common keys: ID, Employee Number, Transaction ID, Account Number</li>
          </ul>

          <h4>Data Type Configuration:</h4>
          <ul>
            <li>Let the system auto-detect types first</li>
            <li>Override only if detection is incorrect</li>
            <li>Use tolerance for financial data with rounding differences</li>
          </ul>

          <h4>Performance:</h4>
          <ul>
            <li>Large files (10,000+ records) may take longer to process</li>
            <li>JSON files show a preview of the first 5 rows, but process the entire file</li>
            <li>XML files are processed on the server for better performance</li>
          </ul>

          <h4>Troubleshooting:</h4>
          <ul>
            <li><strong>"Please select the same number of key columns"</strong> - Ensure equal key columns on both sides</li>
            <li><strong>File type mismatch error</strong> - Upload files of the same format</li>
            <li><strong>No records found</strong> - Check if file has proper headers and data</li>
          </ul>
        </section>

        <section className="ru-doc-section">
          <div className="ru-doc-highlight">Support:</div>
          <p>If you encounter issues:</p>
          <ol>
            <li>Check that your files meet the format requirements</li>
            <li>Verify key columns are correctly selected</li>
          </ol>
        </section>

        <section className="ru-doc-section">
          <div className="ru-doc-highlight">Frequently Asked Questions (FAQ)</div>
          
          <p><strong>Q: Can I reconcile files with different column names?</strong></p>
          <p>A: Yes! Use the column mapping feature in Step 3 to map columns with different names.</p>

          <p><strong>Q: What happens to unmapped columns?</strong></p>
          <p>A: They are included in the export report but not compared during reconciliation.</p>

          <p><strong>Q: Can I use multiple keys for matching?</strong></p>
          <p>A: Yes! Select multiple columns (same count on both sides) to create a composite key.</p>

          <p><strong>Q: Can I export results multiple times?</strong></p>
          <p>A: Yes! You can export as many times as needed with different prefix settings.</p>

          <div className="ru-doc-highlight" style={{ marginTop: '24px' }}>
            For additional assistance, please contact your system administrator.
          </div>
          
          <h3 className="ru-doc-thankyou">Thank You</h3>
        </section>

      </div>
    </div>
  );
}

export default ReconciliationUserGuidePage;

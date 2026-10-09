import React from 'react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import './DocumentsUserGuidePage.css';
import { withBase } from '@config/env';

export function DocumentsUserGuidePage() {
  useDocumentTitle('Documents Guide');

  return (
    <div className="du-guide-page">
      <div className="du-guide-document">
        <h1 className="du-doc-title">Document Management System - User Guide</h1>

        <section className="du-doc-section">
          <h2>Quick Tips</h2>
          <ul>
            <li>Always provide a Document Title as it is mandatory for all files and folders.</li>
            <li>Use descriptive titles and add descriptions when possible to enhance searchability.</li>
            <li>To open a folder, click on the folder name in the Workspace Navigation sidebar on the right. Similarly, to open a subfolder or view a document, click it once.</li>
          </ul>
        </section>

        <section className="du-doc-section">
          <h2>1. Searching for Content</h2>
          <img src={withBase("/docs/images/doc_guide_1.png")} className="du-doc-image" alt="Search Bar" />
          <p>
            Use the search bar located at the top of the right sidebar to locate files or folders within the
            system. Entering keywords will instantly filter the items in the Workspace Navigation tree based
            on their titles.
          </p>
        </section>

        <section className="du-doc-section">
          <h2>2. Workspace Navigation and Empty State</h2>
          <img src={withBase("/docs/images/doc_guide_2.png")} className="du-doc-image" alt="Workspace Navigation and Empty State" />
          <p>
            When you first open the Documents page, the main area will display an empty state instructing
            you to <span className="du-doc-highlight">"Select a file from the sidebar to view details"</span>. The right sidebar contains the Workspace
            Navigation where you can see the hierarchical tree structure of all your root folders, subfolders,
            and files.
          </p>
        </section>

        <section className="du-doc-section">
          <h2>3. Creating Folders</h2>
          <img src={withBase("/docs/images/doc_guide_3.png")} className="du-doc-image" alt="Create New Folder Dialog" />
          <p className="du-doc-highlight" style={{ display: 'block', width: 'fit-content' }}>To add a new folder:</p>
          <ol>
            <li>First, select the folder in the Workspace Navigation where you want the new folder to
            reside. If you want it at the root level, select "Root Folder" or ensure nothing is selected.</li>
            <li>Click the <strong>+ Folder</strong> button located at the top right of the sidebar.</li>
            <li>A <span className="du-doc-highlight">"Create New Folder"</span> dialog box will appear.</li>
            <li><strong>Folder Name:</strong> Enter a name for the folder (Mandatory).</li>
            <li><strong>Description:</strong> Optionally, provide a description for the folder's contents.</li>
            <li>Click <strong>Create Folder</strong> to save.</li>
          </ol>
        </section>

        <section className="du-doc-section">
          <h2>4. Uploading Files</h2>
          <img src={withBase("/docs/images/doc_guide_4.png")} className="du-doc-image" alt="Upload Document File Dialog" />
          <p className="du-doc-highlight" style={{ display: 'block', width: 'fit-content' }}>To upload a document:</p>
          <ol>
            <li>Select the destination folder in the Workspace Navigation.</li>
            <li>Click the <strong>Upload File</strong> button next to the + Folder button.</li>
            <li>An <span className="du-doc-highlight">"Upload Document File"</span> dialog will appear.</li>
            <li>Drag and drop your file into the designated area, or click to browse your device and
            select a file.</li>
            <li><strong>Display Title:</strong> You can optionally enter a custom title. If left blank, it defaults to the
            uploaded file's name.</li>
            <li><strong>Description:</strong> Add any relevant descriptions or comments.</li>
            <li>Click <strong>Upload File</strong>.</li>
          </ol>
        </section>

        <section className="du-doc-section">
          <h2>5. Viewing and Managing Documents</h2>
          <img src={withBase("/docs/images/doc_guide_5.png")} className="du-doc-image" alt="Document Viewer" />
          <p>
            When you click on a file in the Workspace Navigation, it will load in the main viewing area. For
            supported file types (such as PDFs), you will see the full document content directly within the
            application, complete with options to zoom in/out, download, and print.
          </p>
        </section>

        <section className="du-doc-section">
          <h2>6. Editing a Document</h2>
          <img src={withBase("/docs/images/doc_guide_6.png")} className="du-doc-image" alt="Update Folder/File Dialog" />
          <p className="du-doc-highlight" style={{ display: 'block', width: 'fit-content' }}>You can update a document's details or replace the file entirely:</p>
          <ol>
            <li>Hover over a file or folder in the Workspace Navigation and click the Edit (Edit) icon
            next to it.</li>
            <li>An <strong>Update File</strong> (or <strong>Update Folder</strong>) dialog will appear.</li>
            <li>You can modify the Title / Name and Description.</li>
            <li>For files, you can also use the <span className="du-doc-highlight">Replace File option to upload</span> a new version without losing
            the file's original location.</li>
            <li>Click <strong>Save Changes</strong>.</li>
          </ol>
        </section>

        <section className="du-doc-section">
          <h2>7. Deleting a Document</h2>
          <img src={withBase("/docs/images/doc_guide_7.png")} className="du-doc-image" alt="Confirm Deletion Dialog" />
          <p className="du-doc-highlight" style={{ display: 'block', width: 'fit-content' }}>To delete a file or folder:</p>
          <ol>
            <li>Hover over the item in the Workspace Navigation and click the Delete (trash can) icon.</li>
            <li>A <strong>Confirm Deletion</strong> dialog will appear.</li>
            <li>Review the item name and <span className="du-doc-highlight">click Delete to confirm</span>. Please note that this action cannot be
            undone.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}

export default DocumentsUserGuidePage;

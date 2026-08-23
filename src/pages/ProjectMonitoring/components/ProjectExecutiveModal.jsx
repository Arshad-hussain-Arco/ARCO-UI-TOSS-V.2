import React, { useState } from 'react';
import { X, Download, Search, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExportButton } from '@components/ui/ExportButton';

export default function ProjectExecutiveModal({ title = 'Project Drill-down Details', records = [], isCR = false, isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredRecords = records.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const code = (r.Ipm_Number || r.code || r.ipmNumber || '').toLowerCase();
    const summary = (r.Summary || r.summary || '').toLowerCase();
    const status = (r.Status || r.status || r.stage || '').toLowerCase();
    const itdl = (r.IT_Delivery_Lead || r.itdl || '').toLowerCase();
    const po = (r.Product_Owner || r.po || '').toLowerCase();
    const dev = (r.Assigned_Developer || r.assignedDeveloper || '').toLowerCase();

    return code.includes(term) || summary.includes(term) || status.includes(term) || itdl.includes(term) || po.includes(term) || dev.includes(term);
  });

  const handleExportExcel = () => {
    if (!filteredRecords.length) return;
    const exportData = filteredRecords.map((r) => {
      if (isCR) {
        return {
          'CR ID': r.Id || r.id || '',
          'WO ID': r.Wo_Id || r.woId || '',
          'IPM Number': r.Ipm_Number || r.code || '',
          'Summary': r.Summary || r.summary || '',
          'Status': r.Status || r.status || '',
          'Assigned Developer': r.Assigned_Developer || r.assignedDeveloper || '',
          'Additional Developers': r.Additional_Developers || r.additionalDevelopers || '',
          'Start Date': r.Start_Date || r.startDate || '',
          'End Date': r.End_Date || r.endDate || '',
          'Effort (MDs)': r.Effort_in_MDs || r.effortInMDs || '',
        };
      }
      return {
        'WO ID': r.Wo_Id || r.id || '',
        'IPM Number': r.Ipm_Number || r.code || '',
        'Summary': r.Summary || r.summary || '',
        'Work Order Type': r.Work_Order_Type || r.workOrderType || '',
        'Status': r.Status || r.status || r.stage || '',
        'IT Delivery Lead': r.IT_Delivery_Lead || r.itdl || '',
        'Product Owner': r.Product_Owner || r.po || '',
        'Backup ITDL': r.Backup_IT_Delivery_Lead || r.backupItdl || '',
        'Start Date': r.Start_Date || r.startDate || '',
        'Due Date': r.Due_Date || r.endDate || r.dueDate || '',
        'Planned Dev Completion': r.Planned_DEV_completion_Date || r.plannedDevDate || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Details');
    XLSX.writeFile(workbook, `${title.replace(/[^a-zA-Z0-9]/g, '_')}_Export.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl text-slate-200 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <span>{title}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                {filteredRecords.length} records
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Interactive drill-down table representation</p>
          </div>

          <div className="flex items-center gap-3">
            <ExportButton
              excel={true}
              onExcelExport={handleExportExcel}
            />
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search in drill-down details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/60 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs text-left text-slate-300 border-collapse">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/80 sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">IPM Code</th>
                <th className="py-3 px-4">Summary</th>
                <th className="py-3 px-4">Status</th>
                {isCR ? (
                  <>
                    <th className="py-3 px-4">Assigned Developer</th>
                    <th className="py-3 px-4">Additional Devs</th>
                    <th className="py-3 px-4">Start Date</th>
                    <th className="py-3 px-4">End Date</th>
                    <th className="py-3 px-4">Effort (MDs)</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-4">ITDL</th>
                    <th className="py-3 px-4">Product Owner</th>
                    <th className="py-3 px-4">Start Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Planned Dev</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isCR ? 9 : 9} className="py-8 text-center text-slate-500">
                    No matching records found in drill-down details.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, index) => (
                  <tr key={r.Wo_Id || r.Id || r.id || index} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-500">{index + 1}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-emerald-400">
                      {r.Ipm_Number || r.code || '-'}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-200 max-w-[260px] truncate" title={r.Summary || r.summary}>
                      {r.Summary || r.summary || '-'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-medium">
                        {r.Status || r.status || r.stage || '-'}
                      </span>
                    </td>
                    {isCR ? (
                      <>
                        <td className="py-2.5 px-4">{r.Assigned_Developer || r.assignedDeveloper || '-'}</td>
                        <td className="py-2.5 px-4 max-w-[150px] truncate">{r.Additional_Developers || r.additionalDevelopers || '-'}</td>
                        <td className="py-2.5 px-4">{r.Start_Date || r.startDate || '-'}</td>
                        <td className="py-2.5 px-4">{r.End_Date || r.endDate || '-'}</td>
                        <td className="py-2.5 px-4 font-mono">{r.Effort_in_MDs || r.effortInMDs || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-4">{r.IT_Delivery_Lead || r.itdl || '-'}</td>
                        <td className="py-2.5 px-4">{r.Product_Owner || r.po || '-'}</td>
                        <td className="py-2.5 px-4">{r.Start_Date || r.startDate || '-'}</td>
                        <td className="py-2.5 px-4">{r.Due_Date || r.endDate || r.dueDate || '-'}</td>
                        <td className="py-2.5 px-4">{r.Planned_DEV_completion_Date || r.plannedDevDate || '-'}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-900/80 sticky bottom-0 text-xs text-slate-400">
          <span>Showing {filteredRecords.length} of {records.length} records</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-colors"
          >
            Close Modal
          </button>
        </div>
      </div>
    </div>
  );
}

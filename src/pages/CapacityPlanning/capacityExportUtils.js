import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(groupedTeams, filename = 'Capacity_Planning_Report.xlsx') {
  const data = [];
  
  // Headers
  data.push([
    'Consultant', 'Team', 'Role',
    'Next 7 Days (Occupied)', 'Next 7 Days (Available)',
    'Next 30 Days (Occupied)', 'Next 30 Days (Available)',
    'Next 90 Days (Occupied)', 'Next 90 Days (Available)'
  ]);
  
  groupedTeams.forEach(team => {
    // Add Team Subheader Row
    data.push([`--- ${team.name} ---`, '', '', '', '', '', '', '', '']);
    
    team.consultants.forEach(c => {
      data.push([
        c.name,
        c.teamName || team.name,
        c.role,
        c.next7Days.occupied.toFixed(1),
        c.next7Days.available.toFixed(1),
        c.next30Days.occupied.toFixed(1),
        c.next30Days.available.toFixed(1),
        c.next90Days.occupied.toFixed(1),
        c.next90Days.available.toFixed(1)
      ]);
    });
  });
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Capacity Planning');
  XLSX.writeFile(wb, filename);
}

export function exportToPDF(groupedTeams, filename = 'Capacity_Planning_Report.pdf') {
  const doc = new jsPDF('landscape');
  
  // Page title
  doc.setFontSize(16);
  doc.text('Capacity Planning Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 21);
  
  const headers = [
    ['Consultant', 'Team', 'Role', '7d Occ', '7d Avail', '30d Occ', '30d Avail', '90d Occ', '90d Avail']
  ];
  
  const body = [];
  groupedTeams.forEach(team => {
    // Push team subheader
    body.push([
      { content: team.name, colSpan: 9, styles: { fillColor: [230, 244, 237], fontStyle: 'bold', textColor: [0, 104, 56] } }
    ]);
    
    team.consultants.forEach(c => {
      body.push([
        c.name,
        c.teamName || team.name,
        c.role,
        c.next7Days.occupied.toFixed(1),
        c.next7Days.available.toFixed(1),
        c.next30Days.occupied.toFixed(1),
        c.next30Days.available.toFixed(1),
        c.next90Days.occupied.toFixed(1),
        c.next90Days.available.toFixed(1)
      ]);
    });
  });
  
  autoTable(doc, {
    head: headers,
    body: body,
    startY: 25,
    theme: 'grid',
    headStyles: { fillColor: [0, 104, 56], textColor: [255, 255, 255] },
    styles: { fontSize: 9 }
  });
  
  doc.save(filename);
}

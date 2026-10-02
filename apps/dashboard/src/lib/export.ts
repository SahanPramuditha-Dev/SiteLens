import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Assessment } from '@sitelens/shared-types';

export const exportToPdf = (assessment: Assessment) => {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('SiteLens Security Assessment Report', 14, 22);

  doc.setFontSize(11);
  doc.text(`Target URL: ${assessment.url}`, 14, 32);
  doc.text(`Date: ${new Date(assessment.createdAt).toLocaleString()}`, 14, 38);
  doc.text(`Checks Completed: ${assessment.checksCompleted}/${assessment.checksTotal}`, 14, 44);

  const tableData = assessment.findings.map(finding => [
    finding.title,
    finding.category,
    finding.status,
    finding.observation.substring(0, 50) + '...'
  ]);

  autoTable(doc, {
    startY: 50,
    head: [['Title', 'Category', 'Status', 'Description']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [4, 120, 87] } // emerald-700
  });

  doc.save(`sitelens-report.pdf`);
};

export const exportToSarif = (assessment: Assessment) => {
  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "SiteLens",
            informationUri: "https://github.com/SahanPramuditha-Dev/SiteLens",
            rules: assessment.findings.map(f => ({
              id: f.id || f.title.replace(/[^a-zA-Z0-9]/g, ''),
              name: f.title,
              shortDescription: { text: f.title },
              fullDescription: { text: f.observation }
            }))
          }
        },
        results: assessment.findings.filter(f => f.status === 'potential_weakness').map(f => ({
          ruleId: f.id || f.title.replace(/[^a-zA-Z0-9]/g, ''),
          level: 'warning',
          message: { text: f.observation },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: assessment.url
                }
              }
            }
          ]
        }))
      }
    ]
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sarif, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute('href', dataStr);
  dlAnchorElem.setAttribute(
    'download',
    `sitelens.sarif`
  );
  dlAnchorElem.click();
};

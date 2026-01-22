import { ChangeOrder } from '@/types';

interface GenerateChangeOrderPdfParams {
  changeOrder: ChangeOrder;
  project: any;
  client: any;
  company: any;
}

export function generateChangeOrderHtml(params: GenerateChangeOrderPdfParams): string {
  const { changeOrder, project, client, company } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
      font-size: 12px;
      color: #1f2937;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 30px;
    }
    .company-info h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 10px 0;
    }
    .document-title {
      font-size: 20px;
      fontWeight: 700;
      text-align: center;
      margin: 30px 0;
      color: #2563eb;
    }
    .info-section {
      margin-bottom: 30px;
    }
    .info-label {
      font-weight: 600;
      margin-bottom: 5px;
    }
    .amount-section {
      background-color: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
    }
    .amount {
      font-size: 24px;
      font-weight: 700;
      color: #10b981;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 15px;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }
    .status-approved {
      background-color: #d1fae5;
      color: #065f46;
    }
    .status-pending {
      background-color: #fef3c7;
      color: #92400e;
    }
    .status-rejected {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #6b7280;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      <h1>${company?.name || 'Company Name'}</h1>
      ${company?.email ? `<p>${company.email}</p>` : ''}
      ${company?.phone ? `<p>${company.phone}</p>` : ''}
      ${company?.address ? `<p>${company.address}</p>` : ''}
    </div>
    <div class="document-info">
      <p><strong>Change Order #:</strong> ${changeOrder.id}</p>
      <p><strong>Date:</strong> ${new Date(changeOrder.date).toLocaleDateString()}</p>
      <p><strong>Status:</strong>
        <span class="status-badge status-${changeOrder.status}">
          ${changeOrder.status}
        </span>
      </p>
    </div>
  </div>

  <div class="document-title">CHANGE ORDER</div>

  <div class="info-section">
    <div class="info-label">Project:</div>
    <p>${project?.name || 'N/A'}</p>
  </div>

  <div class="info-section">
    <div class="info-label">Client:</div>
    <p>${client?.name || 'N/A'}</p>
    ${client?.email ? `<p>${client.email}</p>` : ''}
    ${client?.phone ? `<p>${client.phone}</p>` : ''}
  </div>

  <div class="info-section">
    <div class="info-label">Description of Work:</div>
    <p>${changeOrder.description}</p>
  </div>

  ${changeOrder.notes ? `
    <div class="info-section">
      <div class="info-label">Notes:</div>
      <p>${changeOrder.notes}</p>
    </div>
  ` : ''}

  <div class="amount-section">
    <div class="info-label">Change Order Amount:</div>
    <div class="amount">$${changeOrder.amount.toFixed(2)}</div>
  </div>

  ${changeOrder.status === 'approved' && changeOrder.approvedDate ? `
    <div class="info-section">
      <div class="info-label">Approval Information:</div>
      <p>Approved on ${new Date(changeOrder.approvedDate).toLocaleDateString()}</p>
    </div>
  ` : ''}

  <div class="footer">
    <p>This change order represents additional work beyond the original contract scope.</p>
    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
  </div>
</body>
</html>
  `;
}

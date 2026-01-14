import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import { Platform, Alert } from 'react-native';
import { Estimate, Client, Project, Company } from '@/types';
import { CustomPriceListItem } from '@/mocks/priceList';

interface SendEstimateParams {
  estimateId: string;
  estimates: Estimate[];
  clients: Client[];
  projects: Project[];
  company: Company | null;
  customPriceListItems: CustomPriceListItem[];
  updateEstimate: (id: string, updates: Partial<Estimate>) => void;
  clientId?: string; // Optional - if not provided, will use estimate's clientId
}

export async function sendEstimate(params: SendEstimateParams): Promise<boolean> {
  const {
    estimateId,
    estimates,
    clients,
    projects,
    company,
    customPriceListItems,
    updateEstimate,
    clientId,
  } = params;

  const estimate = estimates.find(e => e.id === estimateId);
  if (!estimate) {
    console.error('[SendEstimate] Estimate not found:', estimateId);
    return false;
  }

  // Use provided clientId or get from estimate
  const targetClientId = clientId || estimate.clientId;
  const client = clients.find(c => c.id === targetClientId);
  if (!client) {
    console.error('[SendEstimate] Client not found for estimate');
    return false;
  }

  try {
    console.log('[SendEstimate] Starting estimate send with PDF generation...');

    // 1. Fetch complete estimate data with items from database
    console.log('[SendEstimate] Fetching complete estimate data...');
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const getEstimateResponse = await fetch(`${baseUrl}/api/get-estimate?estimateId=${estimateId}`);
    const getEstimateResult = await getEstimateResponse.json();

    if (!getEstimateResult.success || !getEstimateResult.estimate) {
      throw new Error(getEstimateResult.error || 'Failed to load estimate data');
    }

    const fullEstimate = getEstimateResult.estimate;
    console.log('[SendEstimate] Loaded estimate with', fullEstimate.items?.length || 0, 'items');

    // 2. Update estimate status to 'sent' in database
    console.log('[SendEstimate] Updating estimate status to sent...');
    const updateResponse = await fetch(`${baseUrl}/api/update-estimate-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estimateId: estimateId,
        status: 'sent',
      }),
    });

    const updateResult = await updateResponse.json();
    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update estimate status');
    }

    console.log('[SendEstimate] Estimate status updated successfully');

    // Update local state
    updateEstimate(estimateId, { status: 'sent' });

    // 3. Get client info for the estimate
    const estimateClient = clients.find(c => c.id === fullEstimate.clientId) || client;
    // Also check if there's a project linked to this estimate
    const project = projects.find(p => p.estimateId === estimateId);

    // 4. Calculate line items with details
    const lineItems = (fullEstimate.items || []).map((item: any) => {
      if (item.isSeparator) {
        return {
          isSeparator: true,
          label: item.separatorLabel || '---',
        };
      }

      // Get price list item details if available
      const priceListItem = item.priceListItemId ?
        customPriceListItems.find(p => p.id === item.priceListItemId) : null;

      const name = item.customName || priceListItem?.name || 'Custom Item';
      const unit = item.customUnit || priceListItem?.unit || 'unit';
      const category = item.customCategory || priceListItem?.category || 'Miscellaneous';

      return {
        isSeparator: false,
        category,
        name,
        quantity: item.quantity || 0,
        unit,
        unitPrice: item.customPrice || item.unitPrice || 0,
        total: item.total || 0,
        notes: item.notes || '',
      };
    });

    // Group items by category
    const groupedItems: { [key: string]: any[] } = {};
    lineItems.forEach((item: any) => {
      if (item.isSeparator) {
        const separatorKey = `__SEPARATOR__${item.label}`;
        if (!groupedItems[separatorKey]) {
          groupedItems[separatorKey] = [];
        }
      } else {
        if (!groupedItems[item.category]) {
          groupedItems[item.category] = [];
        }
        groupedItems[item.category].push(item);
      }
    });

    // 5. Generate HTML for PDF
    const html = generateEstimateHtml({
      fullEstimate,
      client,
      project,
      company,
      groupedItems,
    });

    // 6. Platform-specific PDF handling
    const emailSubject = `Estimate: ${fullEstimate.name}`;
    const emailBody = `Hi ${client.name.split(' ')[0]},\n\nPlease find attached your estimate for ${fullEstimate.name}.\n\nProject: ${project?.name || 'Your Project'}\nEstimate Total: $${fullEstimate.total.toFixed(2)}\n\nPlease review and let us know if you have any questions.\n\nBest regards,\n${company?.name || 'Legacy Prime Construction'}`;

    if (Platform.OS === 'web') {
      console.log('[SendEstimate] Web platform - opening print dialog and email client...');

      // Open print dialog in new window
      if (typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();

          // Wait for content to load, then trigger print
          printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
          };

          console.log('[SendEstimate] Print dialog opened');
        }

        // Open email client after brief delay
        setTimeout(() => {
          console.log('[SendEstimate] Opening email client...');
          // Only include email if client has one
          const recipientEmail = client.email || '';
          const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
          window.location.href = mailtoUrl;
        }, 1000);

        // Show success message
        setTimeout(() => {
          Alert.alert(
            'Estimate Sent!',
            'Print dialog and email client opened.\n\nSave the PDF and attach it to the email.',
            [{ text: 'OK' }]
          );
        }, 1500);
      }
    } else {
      // Mobile: Generate PDF file and open email composer with attachment
      console.log('[SendEstimate] Mobile platform - generating PDF file...');

      const { uri } = await Print.printToFileAsync({ html });
      console.log('[SendEstimate] PDF generated at:', uri);

      // Open email composer with PDF attachment
      const canSendMail = await MailComposer.isAvailableAsync();
      if (canSendMail) {
        await MailComposer.composeAsync({
          recipients: client.email ? [client.email] : [],
          subject: emailSubject,
          body: emailBody,
          attachments: [uri],
        });
        console.log('[SendEstimate] Email composer opened with PDF attachment');
      } else {
        Alert.alert('Error', 'Email is not available on this device');
      }

      Alert.alert('Success', 'Estimate PDF generated and email prepared!');
    }

    console.log('[SendEstimate] Estimate send process completed successfully');
    return true;

  } catch (error: any) {
    console.error('[SendEstimate] Error sending estimate:', error);
    Alert.alert('Error', error.message || 'Failed to send estimate. Please try again.');
    return false;
  }
}

interface GenerateHtmlParams {
  fullEstimate: any;
  client: Client;
  project: Project | undefined;
  company: Company | null;
  groupedItems: { [key: string]: any[] };
}

function generateEstimateHtml(params: GenerateHtmlParams): string {
  const { fullEstimate, client, project, company, groupedItems } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estimate - ${fullEstimate.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #1f2937;
      background: white;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }

    .company-info h1 {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .company-info p {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.5;
    }

    .estimate-info {
      text-align: right;
    }

    .estimate-info h2 {
      font-size: 20px;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 8px;
    }

    .estimate-info p {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .project-details {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }

    .project-details h3 {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 10px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 11px;
    }

    .detail-label {
      color: #6b7280;
      font-weight: 500;
    }

    .detail-value {
      color: #1f2937;
      font-weight: 600;
    }

    .line-items {
      margin-bottom: 25px;
    }

    .category-header {
      background: #2563eb;
      color: white;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 15px;
      margin-bottom: 8px;
      border-radius: 4px;
    }

    .separator-row {
      background: #f3f4f6;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      margin: 10px 0;
      border-left: 3px solid #9ca3af;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }

    thead {
      background: #f3f4f6;
    }

    th {
      padding: 8px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    th:last-child,
    td:last-child {
      text-align: right;
    }

    tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }

    tbody tr:last-child {
      border-bottom: none;
    }

    td {
      padding: 8px;
      font-size: 11px;
      color: #1f2937;
    }

    .item-name {
      font-weight: 500;
    }

    .item-notes {
      font-size: 10px;
      color: #6b7280;
      font-style: italic;
      margin-top: 2px;
    }

    .totals-section {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    }

    .totals-table {
      margin-left: auto;
      width: 300px;
    }

    .totals-table tr {
      border-bottom: none;
    }

    .totals-table td {
      padding: 6px 8px;
      font-size: 12px;
    }

    .totals-table .label {
      text-align: right;
      color: #6b7280;
      font-weight: 500;
    }

    .totals-table .value {
      text-align: right;
      color: #1f2937;
      font-weight: 600;
      width: 120px;
    }

    .total-row {
      border-top: 2px solid #e5e7eb;
      font-size: 14px !important;
    }

    .total-row .label {
      color: #1f2937;
      font-weight: 700;
    }

    .total-row .value {
      color: #2563eb;
      font-weight: 700;
      font-size: 16px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
    }

    @media print {
      body {
        padding: 0;
      }

      .container {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company?.name || 'Legacy Prime Construction'}</h1>
        <p>${company?.email || 'info@legacyprime.com'}</p>
        <p>${company?.phone || '(555) 123-4567'}</p>
      </div>
      <div class="estimate-info">
        <h2>ESTIMATE</h2>
        <p><strong>Estimate #:</strong> ${fullEstimate.id.slice(0, 8).toUpperCase()}</p>
        <p><strong>Date:</strong> ${new Date(fullEstimate.createdDate).toLocaleDateString()}</p>
        <p><strong>Status:</strong> Sent</p>
      </div>
    </div>

    <div class="project-details">
      <h3>Project Information</h3>
      <div class="detail-row">
        <span class="detail-label">Client:</span>
        <span class="detail-value">${client.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Project:</span>
        <span class="detail-value">${project?.name || 'Unnamed Project'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Estimate Name:</span>
        <span class="detail-value">${fullEstimate.name}</span>
      </div>
    </div>

    <div class="line-items">
      ${Object.entries(groupedItems).map(([category, items]) => {
        if (category.startsWith('__SEPARATOR__')) {
          const label = category.replace('__SEPARATOR__', '');
          return `<div class="separator-row">${label}</div>`;
        }

        return `
          <div class="category-header">${category}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Item</th>
                <th style="width: 15%;">Quantity</th>
                <th style="width: 15%;">Unit Price</th>
                <th style="width: 25%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>
                    <div class="item-name">${item.name}</div>
                    ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                  </td>
                  <td>${item.quantity} ${item.unit}</td>
                  <td>$${item.unitPrice.toFixed(2)}</td>
                  <td>$${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }).join('')}
    </div>

    <div class="totals-section">
      <table class="totals-table">
        <tbody>
          <tr>
            <td class="label">Subtotal:</td>
            <td class="value">$${fullEstimate.subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="label">Tax (${((fullEstimate.taxRate || 0) * 100).toFixed(1)}%):</td>
            <td class="value">$${fullEstimate.taxAmount.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td class="label">TOTAL:</td>
            <td class="value">$${fullEstimate.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>This estimate is valid for 30 days from the date of issue.</p>
      <p>Thank you for considering ${company?.name || 'Legacy Prime Construction'} for your project!</p>
      <p style="margin-top: 10px;">Questions? Contact us at ${company?.email || 'info@legacyprime.com'} or ${company?.phone || '(555) 123-4567'}</p>
    </div>
  </div>
</body>
</html>
  `;
}

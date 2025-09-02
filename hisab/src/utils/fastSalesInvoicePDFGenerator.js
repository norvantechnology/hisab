import browserPool from './browserPool.js';

// Convert number to words (Indian format)
const convertNumberToWords = (amount) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (amount === 0) return 'Zero';
  if (amount < 10) return ones[amount];
  if (amount < 20) return teens[amount - 10];
  if (amount < 100) return tens[Math.floor(amount / 10)] + (amount % 10 ? ' ' + ones[amount % 10] : '');
  if (amount < 1000) return ones[Math.floor(amount / 100)] + ' Hundred' + (amount % 100 ? ' and ' + convertNumberToWords(amount % 100) : '');
  if (amount < 100000) return convertNumberToWords(Math.floor(amount / 1000)) + ' Thousand' + (amount % 1000 ? ' ' + convertNumberToWords(amount % 1000) : '');
  if (amount < 10000000) return convertNumberToWords(Math.floor(amount / 100000)) + ' Lakh' + (amount % 100000 ? ' ' + convertNumberToWords(amount % 100000) : '');
  return convertNumberToWords(Math.floor(amount / 10000000)) + ' Crore' + (amount % 10000000 ? ' ' + convertNumberToWords(amount % 10000000) : '');
};

// Create simplified HTML for sales invoice
export const createFastSalesInvoiceHTML = (data) => {
  const { sale, items, contact, company, bankAccount } = data;
  
  // Use pre-calculated amounts from database (already includes correct discount calculations)
  const taxAmount = parseFloat(sale?.taxAmount || 0);
  const grandTotal = parseFloat(sale?.netReceivable || 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Sales Invoice</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: Arial, sans-serif; 
          font-size: 9px; 
          line-height: 1.2;
          color: #000;
          background: #fff;
          padding: 8px;
        }
        
        .invoice-container {
          max-width: 100%;
          margin: 0 auto;
        }
        
        .header { 
          text-align: center; 
          margin-bottom: 12px; 
          border-bottom: 2px solid #000; 
          padding-bottom: 8px; 
        }
        
        .company-logo {
          text-align: center;
          margin-bottom: 6px;
        }
        
        .company-logo img {
          max-height: 35px;
          max-width: 120px;
          object-fit: contain;
        }
        
        .company-name { 
          font-size: 16px; 
          font-weight: bold; 
          margin-bottom: 2px; 
          text-transform: uppercase;
          color: #065f46;
        }
        
        .company-details { 
          font-size: 8px; 
          line-height: 1.3;
          color: #4b5563;
          margin-bottom: 4px;
        }
        
        .invoice-title { 
          font-size: 14px; 
          font-weight: bold; 
          margin: 8px 0; 
          text-align: center;
          text-transform: uppercase;
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #065f46;
          padding: 6px;
          border: 1px solid #10b981;
          border-radius: 3px;
        }
        
        .invoice-info { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 10px; 
          gap: 15px;
          font-size: 8px;
        }
        
        .info-section {
          flex: 1;
          border: 1px solid #d1d5db;
          padding: 8px;
          border-radius: 3px;
          background: #f9fafb;
        }
        
        .info-title {
          font-weight: bold;
          font-size: 9px;
          margin-bottom: 6px;
          text-transform: uppercase;
          color: #374151;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 2px;
        }
        
        .info-row { 
          margin-bottom: 3px; 
          display: flex;
        }
        
        .info-label { 
          font-weight: bold; 
          min-width: 50px; 
          font-size: 8px;
          color: #6b7280;
        }
        
        .info-value {
          flex: 1;
          font-size: 8px;
          color: #000;
        }
        
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 8px 0; 
          font-size: 8px; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .items-table th { 
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); 
          color: #065f46;
          padding: 5px 3px; 
          border: 1px solid #16a34a; 
          font-weight: bold; 
          text-align: center;
          font-size: 7px;
          text-transform: uppercase;
        }
        
        .items-table td { 
          padding: 4px; 
          border: 1px solid #e5e7eb; 
          vertical-align: top;
          font-size: 8px;
        }
        
        .items-table tbody tr:nth-child(even) {
          background: #f9fafb;
        }
        
        .items-table tbody tr:hover {
          background: #f0fdf4;
        }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        
        .totals-section { 
          margin-top: 10px; 
          display: flex; 
          justify-content: flex-end; 
        }
        
        .totals-table {
          width: 220px;
          border-collapse: collapse;
          font-size: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .totals-table td {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
        }
        
        .total-label {
          font-weight: bold;
          text-align: left;
          background: #f0fdf4;
          color: #065f46;
        }
        
        .total-value {
          text-align: right;
          font-weight: bold;
          background: white;
          color: #000;
        }
        
        .grand-total {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%) !important;
          color: #065f46 !important;
          font-size: 9px;
          font-weight: bold;
          border: 1px solid #16a34a !important;
        }
        
        .amount-words {
          margin-top: 10px;
          padding: 8px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #60a5fa;
          border-radius: 3px;
          font-size: 8px;
          font-weight: bold;
          color: #1e40af;
        }
        
        .footer { 
          margin-top: 15px; 
          text-align: center; 
          border-top: 1px solid #e5e7eb; 
          padding-top: 8px; 
          font-size: 7px;
          color: #6b7280;
        }
        
        .signature-section {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          font-size: 8px;
        }
        
        .signature-box {
          width: 150px;
          text-align: center;
          border-top: 1px solid #374151;
          padding-top: 6px;
          margin-top: 25px;
          color: #374151;
        }
        
        @media print {
          body { margin: 0; padding: 4px; }
          .invoice-container { max-width: none; }
          * { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Compact Header -->
        <div class="header">
          <div class="company-logo">
            ${company?.logoUrl ? `<img src="${company.logoUrl}" alt="Company Logo">` : ''}
          </div>
          <div class="company-name">${company?.name || 'Company Name'}</div>
          <div class="company-details">
            ${company?.address1 ? company.address1 + ', ' : ''}${company?.city || ''} ${company?.state || ''} ${company?.pincode || ''}
            ${company?.gstin ? '| GSTIN: ' + company.gstin : ''}
          </div>
          <div class="invoice-title">Sales Invoice</div>
        </div>

        <!-- Compact Invoice & Customer Info -->
        <div class="invoice-info">
          <div class="info-section">
            <div class="info-title">Invoice Details</div>
            <div class="info-row">
              <span class="info-label">Invoice#:</span>
              <span class="info-value">${sale?.invoiceNumber || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${new Date(sale?.invoiceDate).toLocaleDateString('en-IN') || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">${sale?.status?.toUpperCase() || 'PENDING'}</span>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-title">Bill To</div>
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span class="info-value">${contact?.name || 'Walk-in Customer'}</span>
            </div>
            ${contact?.mobile ? `
            <div class="info-row">
              <span class="info-label">Mobile:</span>
              <span class="info-value">${contact.mobile}</span>
            </div>` : ''}
            ${contact?.gstin ? `
            <div class="info-row">
              <span class="info-label">GSTIN:</span>
              <span class="info-value">${contact.gstin}</span>
            </div>` : ''}
            ${contact?.contactBillingAddress1 ? `
            <div class="info-row">
              <span class="info-label">Address:</span>
              <span class="info-value">${contact.contactBillingAddress1}, ${contact?.contactBillingCity || ''}</span>
            </div>` : ''}
          </div>
        </div>

        <!-- Compact Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 35%;">Item Description</th>
              <th style="width: 8%;">Qty</th>
              <th style="width: 12%;">Rate</th>
              <th style="width: 10%;">Disc</th>
              <th style="width: 10%;">Tax</th>
              <th style="width: 12%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>
                  <strong>${item.productName || item.name || 'N/A'}</strong>
                  ${item.productCode ? `<br><small>Code: ${item.productCode}</small>` : ''}
                  ${item.serialNumbers && item.serialNumbers.length > 0 ? 
                    `<br><small>S/N: ${item.serialNumbers.join(', ')}</small>` : ''}
                </td>
                <td class="text-center">${parseFloat(item.quantity || 0).toFixed(2)}</td>
                <td class="text-right">₹${parseFloat(item.rate || 0).toFixed(2)}</td>
                <td class="text-right">${parseFloat(item.discount || 0) > 0 ? '₹' + parseFloat(item.discount).toFixed(2) : '-'}</td>
                <td class="text-right">${parseFloat(item.taxAmount || 0) > 0 ? '₹' + parseFloat(item.taxAmount).toFixed(2) : '-'}</td>
                <td class="text-right"><strong>₹${parseFloat(item.total || 0).toFixed(2)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Compact Totals -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="total-label">Subtotal:</td>
              <td class="total-value">₹${parseFloat(sale?.basicAmount || 0).toFixed(2)}</td>
            </tr>
            ${parseFloat(sale?.totalDiscount || 0) > 0 ? `
            <tr>
              <td class="total-label">Discount:</td>
              <td class="total-value">-₹${parseFloat(sale.totalDiscount).toFixed(2)}</td>
            </tr>` : ''}
            ${parseFloat(sale?.taxAmount || 0) > 0 ? `
            <tr>
              <td class="total-label">Tax:</td>
              <td class="total-value">₹${parseFloat(sale.taxAmount).toFixed(2)}</td>
            </tr>` : ''}
            ${parseFloat(sale?.transportationCharge || 0) > 0 ? `
            <tr>
              <td class="total-label">Transport:</td>
              <td class="total-value">₹${parseFloat(sale.transportationCharge).toFixed(2)}</td>
            </tr>` : ''}
            ${parseFloat(sale?.roundOff || 0) !== 0 ? `
            <tr>
              <td class="total-label">Round Off:</td>
              <td class="total-value">${parseFloat(sale.roundOff) >= 0 ? '+' : ''}₹${parseFloat(sale.roundOff).toFixed(2)}</td>
            </tr>` : ''}
            <tr class="grand-total">
              <td class="total-label">TOTAL:</td>
              <td class="total-value">₹${grandTotal.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- Amount in Words -->
        <div class="amount-words">
          <strong>Amount in Words:</strong> ${convertNumberToWords(grandTotal)} Rupees Only
        </div>

        ${sale?.internalNotes ? `
        <div style="margin-top: 8px; padding: 4px; border: 1px solid #ccc; font-size: 8px;">
          <strong>Notes:</strong> ${sale.internalNotes}
        </div>` : ''}

        <!-- Compact Signature Section -->
        <div class="signature-section">
          <div class="signature-box">
            <div>Customer Signature</div>
          </div>
          <div class="signature-box">
            <div>Authorized Signatory</div>
          </div>
        </div>

        <!-- Minimal Footer -->
        <div class="footer">
          Generated on ${new Date().toLocaleString('en-IN')} | ${company?.name || 'HISAB'} | ${process.env.FRONTEND_URL || 'www.hisab.com'}
        </div>
      </div>
    </body>
    </html>
  `;
};

// Ultra-fast PDF generation with browser pool
export const generateFastSalesInvoicePDF = async (htmlContent) => {
  let browser;
  let page;
  
  try {
    browser = await browserPool.getBrowser();
    page = await browser.newPage();
    
    // Minimal page setup for maximum speed
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(htmlContent, { 
      waitUntil: 'load',
      timeout: 3000 
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: false, // Faster without background
      margin: { top: '5px', right: '5px', bottom: '5px', left: '5px' },
      timeout: 3000
    });

    return pdfBuffer;

  } finally {
    if (page) await page.close();
    if (browser) await browserPool.returnBrowser(browser);
  }
};

// Generate filename
export const generateFastSalesInvoicePDFFileName = (invoiceNumber, companyName) => {
  const timestamp = new Date().toISOString().slice(0, 10);
  const sanitizedCompanyName = (companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '');
  return `Sales_Invoice_${invoiceNumber}_${sanitizedCompanyName}_${timestamp}.pdf`;
}; 
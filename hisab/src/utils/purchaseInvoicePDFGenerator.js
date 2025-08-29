                                                                                                                                                                                                                                import puppeteer from 'puppeteer';
import browserPool from './browserPool.js';

// Convert number to words (Indian format)
const convertNumberToWords = (amount) => {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertHundreds = (num) => {
    let result = '';
    if (num >= 100) {
      result += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num >= 10) {
      result += teens[num - 10] + ' ';
      return result;
    }
    if (num > 0) {
      result += units[num] + ' ';
    }
    return result;
  };

  if (amount === 0) return 'Zero Rupees';
  
  let rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  
  let result = '';
  
  if (rupees >= 10000000) { // Crores
    result += convertHundreds(Math.floor(rupees / 10000000)) + 'Crore ';
    rupees %= 10000000;
  }
  if (rupees >= 100000) { // Lakhs
    result += convertHundreds(Math.floor(rupees / 100000)) + 'Lakh ';
    rupees %= 100000;
  }
  if (rupees >= 1000) { // Thousands
    result += convertHundreds(Math.floor(rupees / 1000)) + 'Thousand ';
    rupees %= 1000;
  }
  if (rupees > 0) {
    result += convertHundreds(rupees);
  }
  
  result += 'Rupees';
  
  if (paise > 0) {
    result += ' and ' + convertHundreds(paise) + 'Paise';
  }
  
  return result.trim() + ' Only';
};

// Generate PDF from HTML content - Ultra-fast with browser pool
export const generatePurchaseInvoicePDFFromHTML = async (htmlContent, options = {}) => {
  let browser;
  let page;
  
  try {
    // Get browser from pool (much faster than launching new one)
    browser = await browserPool.getBrowser();
    page = await browser.newPage();
    
    // Ultra-fast page setup
    await page.setViewport({ width: 794, height: 1123 }); // A4 size in pixels
    await page.setContent(htmlContent, { 
      waitUntil: 'load', // Even faster than 'domcontentloaded'
      timeout: 5000 
    });

    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      margin: {
        top: '5px',
        right: '5px',
        bottom: '5px',
        left: '5px'
      },
      preferCSSPageSize: true,
      timeout: 5000, // Faster timeout
      ...options
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    return pdfBuffer;

  } finally {
    // Close page but return browser to pool
    if (page) {
      await page.close();
    }
    if (browser) {
      await browserPool.returnBrowser(browser);
    }
  }
};

// Generate unique filename for purchase invoice PDF
export const generatePurchaseInvoicePDFFileName = (invoiceNumber, companyName) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_');
  return `purchase_invoice_${sanitizedInvoiceNumber}_${sanitizedCompanyName}_${timestamp}.pdf`;
};

// Create purchase invoice HTML template
export const createPurchaseInvoiceHTML = (invoiceData) => {
  const { purchase, company, contact, bankAccount, items = [] } = invoiceData;
  
  // Calculate totals
  const basicAmount = parseFloat(purchase.basicAmount || 0);
  const totalDiscount = parseFloat(purchase.totalDiscount || 0);
  const taxAmount = parseFloat(purchase.taxAmount || 0);
  const roundOff = parseFloat(purchase.roundOff || 0);
  const netPayable = parseFloat(purchase.netPayable || 0);
  
  const amountInWords = convertNumberToWords(netPayable);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Purchase Invoice - ${purchase.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.3;
          color: #333;
          background: white;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 5px;
          background: white;
        }
        
        .header {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        
        .company-info {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 5px;
        }
        
        .company-address {
          color: #666;
          margin-bottom: 10px;
        }
        
        .invoice-title {
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          color: #dc2626;
          background: #fee2e2;
          padding: 10px;
          border-radius: 5px;
        }
        
        .invoice-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
        }
        
        .invoice-info, .vendor-section {
          flex: 1;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 5px;
          margin: 0 10px;
        }
        
        .invoice-info h3, .vendor-section h3 {
          color: #2563eb;
          margin-bottom: 10px;
          font-size: 14px;
        }
        
        .info-row {
          display: flex;
          margin-bottom: 5px;
        }
        
        .info-label {
          font-weight: bold;
          width: 120px;
          color: #374151;
        }
        
        .info-value {
          color: #6b7280;
          flex: 1;
        }
        
        .items-section {
          margin-bottom: 30px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e5e7eb;
        }
        
        .items-table th {
          background: #f5f5f5;
          padding: 8px 6px;
          text-align: left;
          border: 1px solid #ddd;
          font-weight: bold;
        }
        
        .items-table td {
          padding: 6px 6px;
          border: 1px solid #ddd;
          vertical-align: top;
        }
        
        .items-table tr:nth-child(even) {
          background: #f9fafb;
        }
        
        .text-right {
          text-align: right;
        }
        
        .text-center {
          text-align: center;
        }
        
        .totals-section {
          margin-top: 30px;
          display: flex;
          justify-content: flex-end;
        }
        
        .totals-table {
          width: 300px;
          border-collapse: collapse;
        }
        
        .totals-table td {
          padding: 8px 12px;
          border: 1px solid #e5e7eb;
        }
        
        .totals-table .total-label {
          font-weight: bold;
          background: #f3f4f6;
          text-align: right;
        }
        
        .totals-table .total-value {
          text-align: right;
          font-weight: bold;
        }
        
        .final-total {
          background: #2563eb !important;
          color: white !important;
          font-size: 14px;
        }
        
        .amount-words {
          margin-top: 20px;
          padding: 15px;
          background: #f0f9ff;
          border: 1px solid #bfdbfe;
          border-radius: 5px;
        }
        
        .amount-words-label {
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 5px;
        }
        
        .amount-words-value {
          color: #374151;
          font-style: italic;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 11px;
        }
        
        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">${company.name}</div>
            <div class="company-address">
              ${company.address1 ? company.address1 + '<br>' : ''}
              ${company.address2 ? company.address2 + '<br>' : ''}
              ${[company.city, company.state, company.pincode].filter(Boolean).join(', ')}
              ${company.country ? '<br>' + company.country : ''}
              ${company.gstin ? '<br>GSTIN: ' + company.gstin : ''}
            </div>
          </div>
          <div class="invoice-title">PURCHASE INVOICE</div>
        </div>
        
        <!-- Invoice Details -->
        <div class="invoice-details">
          <div class="invoice-info">
            <h3>Invoice Details</h3>
            <div class="info-row">
              <span class="info-label">Invoice #:</span>
              <span class="info-value">${purchase.invoiceNumber}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${new Date(purchase.invoiceDate).toLocaleDateString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">${purchase.status || 'N/A'}</span>
            </div>
            ${purchase.taxType ? `
            <div class="info-row">
              <span class="info-label">Tax Type:</span>
              <span class="info-value">${purchase.taxType}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="vendor-section">
            <h3>Vendor Details</h3>
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span class="info-value">${contact.name}</span>
            </div>
            ${contact.gstin ? `
            <div class="info-row">
              <span class="info-label">GSTIN:</span>
              <span class="info-value">${contact.gstin}</span>
            </div>
            ` : ''}
            ${contact.mobile ? `
            <div class="info-row">
              <span class="info-label">Mobile:</span>
              <span class="info-value">${contact.mobile}</span>
            </div>
            ` : ''}
            ${contact.email ? `
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${contact.email}</span>
            </div>
            ` : ''}
            ${(contact.billingAddress1 || contact.billingCity || contact.billingState) ? `
            <div class="info-row">
              <span class="info-label">Address:</span>
              <span class="info-value">
                ${contact.billingAddress1 ? contact.billingAddress1 + '<br>' : ''}
                ${contact.billingAddress2 ? contact.billingAddress2 + '<br>' : ''}
                ${[contact.billingCity, contact.billingState, contact.billingPincode].filter(Boolean).join(', ')}
                ${contact.billingCountry ? '<br>' + contact.billingCountry : ''}
              </span>
            </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Items Section -->
        <div class="items-section">
          <table class="items-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Product</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Discount</th>
                <th class="text-right">Tax</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>
                    <strong>${item.productName || 'N/A'}</strong>
                    ${item.productCode ? '<br><small>' + item.productCode + '</small>' : ''}
                  </td>
                  <td class="text-center">${item.qty || 0}</td>
                  <td class="text-right">₹${parseFloat(item.rate || 0).toFixed(2)}</td>
                  <td class="text-right">₹${parseFloat(item.discount || 0).toFixed(2)}</td>
                  <td class="text-right">₹${parseFloat(item.taxAmount || 0).toFixed(2)}</td>
                  <td class="text-right">₹${parseFloat(item.total || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Totals Section -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="total-label">Basic Amount:</td>
              <td class="total-value">₹${basicAmount.toFixed(2)}</td>
            </tr>
            ${totalDiscount > 0 ? `
            <tr>
              <td class="total-label">Total Discount:</td>
              <td class="total-value">₹${totalDiscount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${taxAmount > 0 ? `
            <tr>
              <td class="total-label">Tax Amount:</td>
              <td class="total-value">₹${taxAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${roundOff !== 0 ? `
            <tr>
              <td class="total-label">Round Off:</td>
              <td class="total-value">₹${roundOff.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="final-total">
              <td class="total-label">Net Payable:</td>
              <td class="total-value">₹${netPayable.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <!-- Amount in Words -->
        <div class="amount-words">
          <div class="amount-words-label">Amount in Words:</div>
          <div class="amount-words-value">${amountInWords}</div>
        </div>
        
        ${purchase.internalNotes ? `
        <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 5px;">
          <strong>Notes:</strong><br>
          ${purchase.internalNotes}
        </div>
        ` : ''}
        
        <!-- Footer -->
        <div class="footer">
          <p>This is a computer-generated purchase invoice and does not require a signature.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}; 
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

// Create simplified HTML for purchase invoice
export const createFastPurchaseInvoiceHTML = (data) => {
  const { purchase, items, contact, company, bankAccount } = data;
  

  
  // Safely calculate amounts with fallbacks
  const totalAmount = items && items.length > 0 ? 
    items.reduce((sum, item) => {
      const qty = parseFloat(item.qty || 0);
      const rate = parseFloat(item.rate || 0);
      const itemTotal = qty * rate;
      return sum + itemTotal;
    }, 0) : 0;
  const taxAmount = parseFloat(purchase?.taxAmount || 0);
  const grandTotal = parseFloat(purchase?.netPayable || 0) || (totalAmount + taxAmount);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Purchase Invoice</title>
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          font-size: 10px; 
          line-height: 1.3;
          margin: 0; 
          padding: 12px; 
          background: #fff;
          color: #333;
        }
        .header { 
          text-align: center; 
          margin-bottom: 15px; 
          border-bottom: 1px solid #000; 
          padding-bottom: 10px; 
        }
        .company-logo {
          margin-bottom: 8px;
          text-align: center;
        }
        .company-logo img {
          max-height: 40px;
          max-width: 120px;
          object-fit: contain;
        }
        .company-name { 
          font-size: 20px; 
          font-weight: 700; 
          margin-bottom: 4px; 
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .company-details { 
          font-size: 10px; 
          line-height: 1.4;
          opacity: 0.8;
        }
        .invoice-title { 
          font-size: 18px; 
          font-weight: 700; 
          margin-bottom: 15px; 
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .invoice-info { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 15px; 
          gap: 25px;
        }
        .info-section {
          flex: 1;
        }
        .info-row { 
          margin-bottom: 4px; 
          line-height: 1.3;
        }
        .info-label { 
          font-weight: 600; 
          min-width: 60px; 
          display: inline-block;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.3px;
        }
        .info-value {
          font-weight: 400;
          font-size: 10px;
        }
        .billing-address {
          margin-top: 8px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          background: #fafafa;
        }
        .billing-address-title {
          font-weight: 600;
          font-size: 9px;
          text-transform: uppercase;
          margin-bottom: 6px;
          letter-spacing: 0.3px;
        }
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 15px 0; 
          font-size: 9px; 
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        .items-table th { 
          background: #f8f9fa; 
          padding: 8px 6px; 
          border: 1px solid #dee2e6; 
          font-weight: 600; 
          text-transform: uppercase;
          font-size: 8px;
          letter-spacing: 0.3px;
          text-align: left;
        }
        .items-table td { 
          padding: 8px 6px; 
          border: 1px solid #dee2e6; 
          vertical-align: top;
        }
        .items-table tr:nth-child(even) {
          background: #fafafa;
        }
        .totals { 
          margin-top: 15px; 
          text-align: right; 
          border-top: 1px solid #000;
          padding-top: 12px;
        }
        .total-row { 
          margin-bottom: 6px; 
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          max-width: 250px;
          margin-left: auto;
        }
        .total-label {
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .total-value {
          font-weight: 400;
          min-width: 80px;
          text-align: right;
        }
        .grand-total { 
          font-weight: 700; 
          border-top: 1px solid #000; 
          padding-top: 8px; 
          font-size: 12px;
          margin-top: 12px;
        }
        .footer { 
          margin-top: 20px; 
          text-align: center; 
          border-top: 1px solid #ddd; 
          padding-top: 12px; 
          font-size: 9px;
          opacity: 0.7;
          line-height: 1.4;
        }
        .amount-in-words {
          font-style: italic;
          font-weight: 500;
          margin-top: 6px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${company?.logoUrl ? `
          <div class="company-logo">
            <img src="${company.logoUrl}" alt="Company Logo" />
          </div>
        ` : ''}
        <div class="company-name">${company?.name || 'Company Name'}</div>
        <div class="company-details">
          ${company?.address1 || ''} ${company?.city || ''}<br>
          ${company?.gstin || ''}
        </div>
      </div>

      <div class="invoice-title">PURCHASE INVOICE</div>

      <div class="invoice-info">
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Invoice:</span>
            <span class="info-value">${purchase.invoiceNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span class="info-value">${new Date(purchase.invoiceDate).toLocaleDateString()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">${purchase.status}</span>
          </div>
        </div>
        <div class="info-section">
          <div class="info-row">
            <span class="info-label">Vendor:</span>
            <span class="info-value">${contact?.name || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Mobile:</span>
            <span class="info-value">${contact?.mobile || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${contact?.email || ''}</span>
          </div>
          ${contact?.billingAddress1 || contact?.billingAddress2 || contact?.billingCity || contact?.billingState || contact?.billingPincode || contact?.billingCountry ? `
            <div class="billing-address">
              <div class="billing-address-title">Billing Address</div>
              ${contact?.billingAddress1 ? `<div>${contact.billingAddress1}</div>` : ''}
              ${contact?.billingAddress2 ? `<div>${contact.billingAddress2}</div>` : ''}
              ${contact?.billingCity || contact?.billingState || contact?.billingPincode ? `<div>${[contact?.billingCity, contact?.billingState, contact?.billingPincode].filter(Boolean).join(', ')}</div>` : ''}
              ${contact?.billingCountry ? `<div>${contact.billingCountry}</div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate (W/O Tax)</th>
            <th>Discount</th>
            <th>Tax</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${items && items.length > 0 ? items.map(item => `
            <tr>
              <td>${item?.productName || ''}</td>
              <td>${item?.qty || 0}</td>
              <td>₹${item?.rate || 0}</td>
              <td>${parseFloat(item?.discount || 0) > 0 ? `₹${parseFloat(item?.discount || 0).toFixed(2)}` : '-'}</td>
              <td>₹${parseFloat(item?.taxAmount || 0).toFixed(2)}</td>
              <td>₹${parseFloat(item?.total || 0).toFixed(2)}</td>
            </tr>
          `).join('') : '<tr><td colspan="6">No items found</td></tr>'}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span class="total-label">Basic Amount:</span>
          <span class="total-value">₹${parseFloat(purchase?.basicAmount || 0).toFixed(2)}</span>
        </div>
        ${parseFloat(purchase?.totalDiscount || 0) > 0 ? `
        <div class="total-row">
          <span class="total-label">Discount (${purchase?.discountType === 'percentage' ? purchase?.discountValue + '%' : 'Fixed'}):</span>
          <span class="total-value">-₹${parseFloat(purchase?.totalDiscount || 0).toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row">
          <span class="total-label">Tax Amount:</span>
          <span class="total-value">₹${taxAmount.toFixed(2)}</span>
        </div>
        ${parseFloat(purchase?.roundOff || 0) !== 0 ? `
        <div class="total-row">
          <span class="total-label">Round Off:</span>
          <span class="total-value">₹${parseFloat(purchase?.roundOff || 0).toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row grand-total">
          <span class="total-label">Total:</span>
          <span class="total-value">₹${grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <div class="amount-in-words">
          Amount in words: ${convertNumberToWords(Math.round(grandTotal))} Rupees Only
        </div>
      </div>
    </body>
    </html>
  `;
};

// Ultra-fast PDF generation with browser pool
export const generateFastPurchaseInvoicePDF = async (htmlContent) => {
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
export const generateFastPurchaseInvoicePDFFileName = (invoiceNumber, companyName) => {
  const timestamp = new Date().toISOString().slice(0, 10);
  const sanitizedCompanyName = (companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '');
  return `Purchase_Invoice_${invoiceNumber}_${sanitizedCompanyName}_${timestamp}.pdf`;
}; 
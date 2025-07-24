                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        import puppeteer from 'puppeteer';

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
  
  return result.trim();
};

// Generate PDF from HTML content
export const generatePaymentPDFFromHTML = async (htmlContent, options = {}) => {
  let browser;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF with F4 format and minimal margins for cost-saving
    const pdfBuffer = await page.pdf({
      format: 'A4', // F4 is similar to A4, we'll use A4 with minimal margins
      printBackground: true,
      margin: {
        top: '5mm',    // Minimal top margin
        right: '5mm',  // Minimal right margin
        bottom: '5mm', // Minimal bottom margin
        left: '5mm'    // Minimal left margin
      },
      ...options
    });
    
    return pdfBuffer;
    
  } catch (error) {
    console.error('Payment PDF generation error:', error);
    throw new Error(`Failed to generate payment PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Generate unique filename for payment PDF
export const generatePaymentPDFFileName = (paymentNumber, companyName) => {
  const timestamp = Date.now();
  const cleanPaymentNumber = paymentNumber.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  return `payment_${cleanCompanyName}_${cleanPaymentNumber}_${timestamp}.pdf`;
};

// Create payment invoice HTML template
export const createPaymentInvoiceHTML = (paymentData) => {
  const { payment, company, contact, bankAccount, allocations = [] } = paymentData;
  
  // Calculate totals and determine bank impact for each allocation
  let totalReceivable = 0;
  let totalPayable = 0;
  let totalAllocatedAmount = 0;
  
  // Process allocations to determine bank impact
  const processedAllocations = allocations.map(allocation => {
    const paidAmount = parseFloat(allocation.paidAmount || 0);
    const allocationType = allocation.allocationType || 'General';
    
    // Determine if this is a bank debit (-) or credit (+)
    let bankImpact = 0;
    let bankImpactSign = '';
    let bankImpactClass = '';
    
    switch (allocationType) {
      case 'expense':
        // Expense payment = money going out = bank debit (-)
        bankImpact = -paidAmount;
        bankImpactSign = '-';
        bankImpactClass = 'bank-debit';
        totalPayable += paidAmount;
        break;
      case 'income':
        // Income receipt = money coming in = bank credit (+)
        bankImpact = paidAmount;
        bankImpactSign = '+';
        bankImpactClass = 'bank-credit';
        totalReceivable += paidAmount;
        break;
      case 'purchase':
        // Purchase payment = money going out = bank debit (-)
        bankImpact = -paidAmount;
        bankImpactSign = '-';
        bankImpactClass = 'bank-debit';
        totalPayable += paidAmount;
        break;
      case 'sale':
        // Sale payment = money coming in = bank credit (+)
        bankImpact = paidAmount;
        bankImpactSign = '+';
        bankImpactClass = 'bank-credit';
        totalReceivable += paidAmount;
        break;
      case 'current-balance':
        // Current balance settlement - determine based on balance type
        if (allocation.balanceType === 'receivable') {
          // Receiving money = bank credit (+)
          bankImpact = paidAmount;
          bankImpactSign = '+';
          bankImpactClass = 'bank-credit';
          totalReceivable += paidAmount;
        } else {
          // Paying money = bank debit (-)
          bankImpact = -paidAmount;
          bankImpactSign = '-';
          bankImpactClass = 'bank-debit';
          totalPayable += paidAmount;
        }
        break;
      default:
        // Default to neutral
        bankImpact = paidAmount;
        bankImpactSign = '';
        bankImpactClass = 'bank-neutral';
    }
    
    totalAllocatedAmount += paidAmount;
    
    return {
      ...allocation,
      paidAmount,
      bankImpact,
      bankImpactSign,
      bankImpactClass
    };
  });
  
  const adjustmentAmount = parseFloat(payment.adjustmentValue || 0);
  
  // Calculate net bank impact (should be 0 for balanced payments)
  const netBankAmount = totalReceivable - totalPayable;
  
  // Apply adjustment if any
  let finalNetAmount = netBankAmount;
  if (payment.adjustmentType && payment.adjustmentType !== 'none') {
    if (payment.adjustmentType === 'discount') {
      // Discount reduces the amount to be paid/received
      finalNetAmount = netBankAmount - adjustmentAmount;
    } else if (payment.adjustmentType === 'surcharge' || payment.adjustmentType === 'extra_receipt') {
      // Surcharge/extra receipt increases the amount
      finalNetAmount = netBankAmount + adjustmentAmount;
    }
  }
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment - ${payment.paymentNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          font-size: 10px;
          line-height: 1.2;
          color: #000;
          background-color: #fff;
        }
        
        .invoice-container {
          max-width: 100%;
          margin: 0;
          padding: 5px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #000;
        }
        
        .company-info {
          flex: 1;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        
        .company-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          border: 1px solid #ccc;
        }
        
        .company-details h1 {
          font-size: 16px;
          color: #000;
          margin-bottom: 2px;
          font-weight: bold;
        }
        
        .company-details p {
          color: #333;
          margin: 0.5px 0;
          font-size: 9px;
        }
        
        .payment-info {
          text-align: right;
          flex-shrink: 0;
        }
        
        .payment-info h2 {
          font-size: 14px;
          color: #000;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          font-size: 9px;
        }
        
        .info-label {
          font-weight: bold;
          color: #000;
        }
        
        .info-value {
          color: #333;
        }
        
        .contact-section {
          margin-bottom: 10px;
          padding: 6px;
          border: 1px solid #ccc;
          background-color: #f9f9f9;
        }
        
        .contact-section h3 {
          color: #000;
          margin-bottom: 5px;
          font-size: 11px;
          font-weight: bold;
          border-bottom: 1px solid #ccc;
          padding-bottom: 2px;
        }
        
        .allocations-section {
          margin-bottom: 10px;
        }
        
        .allocations-section h3 {
          margin-bottom: 5px;
          color: #000;
          font-size: 11px;
          font-weight: bold;
        }
        
        .allocations-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
          border: 1px solid #000;
        }
        
        .allocations-table thead {
          background-color: #f0f0f0;
        }
        
        .allocations-table th,
        .allocations-table td {
          padding: 3px 2px;
          text-align: left;
          border: 1px solid #ccc;
          font-size: 8px;
        }
        
        .allocations-table th {
          font-weight: bold;
          text-transform: uppercase;
          font-size: 7px;
          background-color: #e0e0e0;
        }
        
        .allocations-table tbody tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .text-right {
          text-align: right;
        }
        
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 10px;
        }
        
        .totals-table {
          width: 200px;
          border-collapse: collapse;
          border: 1px solid #000;
        }
        
        .totals-table td {
          padding: 3px 5px;
          border: 1px solid #ccc;
          font-size: 9px;
        }
        
        .totals-table .label {
          font-weight: bold;
          color: #000;
        }
        
        .totals-table .value {
          text-align: right;
          color: #000;
        }
        
        .totals-table .total-row {
          background-color: #e0e0e0;
          font-weight: bold;
          font-size: 10px;
        }
        
        .allocation-type {
          display: inline-block;
          padding: 1px 3px;
          border-radius: 2px;
          font-size: 7px;
          font-weight: bold;
          text-transform: uppercase;
          background-color: #f0f0f0;
          color: #000;
          border: 1px solid #ccc;
        }
        
        .allocation-type.sale {
          background-color: #d4edda;
          color: #155724;
          border-color: #c3e6cb;
        }
        
        .allocation-type.purchase {
          background-color: #f8d7da;
          color: #721c24;
          border-color: #f5c6cb;
        }
        
        .allocation-type.expense {
          background-color: #fff3cd;
          color: #856404;
          border-color: #ffeaa7;
        }
        
        .allocation-type.income {
          background-color: #d1ecf1;
          color: #0c5460;
          border-color: #bee5eb;
        }
        
        .allocation-type.current-balance {
          background-color: #e2e3e5;
          color: #383d41;
          border-color: #d6d8db;
        }
        
        .bank-debit {
          color: #000;
          font-weight: bold;
        }
        
        .bank-credit {
          color: #000;
          font-weight: bold;
        }
        
        .bank-neutral {
          color: #333;
        }
        
        .adjustment-section {
          padding: 5px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          border-radius: 2px;
          margin-bottom: 8px;
        }
        
        .adjustment-section h4 {
          color: #000;
          margin-bottom: 3px;
          font-size: 10px;
          font-weight: bold;
        }
        
        .amount-words {
          margin-bottom: 8px;
          padding: 5px;
          background-color: #f9f9f9;
          border: 1px solid #ccc;
          border-radius: 2px;
          font-size: 9px;
        }
        
        .notes {
          margin-bottom: 8px;
          padding: 5px;
          background-color: #f9f9f9;
          border: 1px solid #ccc;
          border-radius: 2px;
        }
        
        .notes h4 {
          color: #000;
          margin-bottom: 3px;
          font-size: 10px;
          font-weight: bold;
        }
        
        .signature-section {
          margin-top: 15px;
          margin-bottom: 10px;
        }
        
        .signature-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .signature-table td {
          width: 50%;
          text-align: center;
          padding: 10px 5px;
          border-top: 1px solid #000;
          font-size: 9px;
          font-weight: bold;
        }
        
        .footer {
          border-top: 1px solid #ccc;
          padding-top: 5px;
          text-align: center;
          color: #666;
          font-size: 8px;
        }
        
        @media print {
          body { margin: 0; }
          .invoice-container { padding: 2px; }
          .page-break { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            ${company.logoUrl ? `<img src="${company.logoUrl}" alt="Company Logo" class="company-logo">` : ''}
            <div class="company-details">
              <h1>${company.name}</h1>
              <p>${company.address1}${company.address2 ? ', ' + company.address2 : ''}</p>
              <p>${company.city}, ${company.state} - ${company.pincode}</p>
              <p>${company.country}</p>
              ${company.gstin ? `<p><strong>GSTIN:</strong> ${company.gstin}</p>` : ''}
            </div>
          </div>
          <div class="payment-info">
            <h2>Payment Details</h2>
            <div class="info-row">
              <span class="info-label">Payment #:</span>
              <span class="info-value">${payment.paymentNumber}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${new Date(payment.date).toLocaleDateString()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Type:</span>
              <span class="info-value">${payment.paymentType.toUpperCase()}</span>
            </div>
            ${bankAccount.accountName ? `
            <div class="info-row">
              <span class="info-label">Bank:</span>
              <span class="info-value">${bankAccount.accountName}</span>
            </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Contact Information -->
        <div class="contact-section">
          <h3>${payment.paymentType === 'payment' ? 'Payment To' : 'Receipt From'}</h3>
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
        </div>
        
        <!-- Allocations Section -->
        <div class="allocations-section">
          <h3>Transaction Details</h3>
          <table class="allocations-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Reference</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${processedAllocations.map(allocation => `
                <tr>
                  <td>
                    <span class="allocation-type ${allocation.allocationType}">
                      ${allocation.allocationType.replace('-', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>${allocation.description}</td>
                  <td>${allocation.reference}</td>
                  <td class="text-right ${allocation.bankImpactClass}">
                    ${allocation.bankImpactSign}₹${parseFloat(allocation.paidAmount || 0).toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Adjustment Section -->
        ${payment.adjustmentType && payment.adjustmentType !== 'none' ? `
        <div class="adjustment-section">
          <h4>Adjustment Applied</h4>
          <div class="info-row">
            <span class="info-label">Adjustment Type:</span>
            <span class="info-value">${payment.adjustmentType.replace('_', ' ').toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Adjustment Value:</span>
            <span class="info-value">₹${parseFloat(payment.adjustmentValue || 0).toFixed(2)}</span>
          </div>
        </div>
        ` : ''}
        
        <!-- Totals -->
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td class="label">Total Receivable:</td>
              <td class="value">₹${totalReceivable.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label">Total Payable:</td>
              <td class="value">₹${totalPayable.toFixed(2)}</td>
            </tr>
            ${payment.adjustmentType && payment.adjustmentType !== 'none' ? `
            <tr>
              <td class="label">Adjustment (${payment.adjustmentType.replace('_', ' ')}):</td>
              <td class="value">${payment.adjustmentType === 'discount' ? '(-)' : '(+)'}₹${adjustmentAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="total-row">
              <td class="label">Net Amount:</td>
              <td class="value">₹${finalNetAmount.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <!-- Amount in Words -->
        <div class="amount-words">
          <strong>Amount in Words:</strong> 
          <span style="font-style: italic;">
            ${convertNumberToWords(Math.abs(finalNetAmount))} Only
          </span>
        </div>
        
        <!-- Notes -->
        ${payment.description ? `
        <div class="notes">
          <h4>Payment Description:</h4>
          <p>${payment.description}</p>
        </div>
        ` : ''}
        
        <!-- Signature Section -->
        <div class="signature-section">
          <table class="signature-table">
            <tr>
              <td>Authorised Signature</td>
              <td>Receiver's Signature</td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()} | ${company.name}</p>
          <p>This is a system generated payment ${payment.paymentType}.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}; 
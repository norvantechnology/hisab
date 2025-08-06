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
export const generateBankStatementPDF = async (bankAccount, transactions, filters = {}) => {
  let browser;
  
  try {
    // Generate HTML content
    const htmlContent = createBankStatementHTML(bankAccount, transactions, filters);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF with minimal margins for cost-saving
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '3mm',    // Minimal top margin
        right: '3mm',  // Minimal right margin
        bottom: '3mm', // Minimal bottom margin
        left: '3mm'    // Minimal left margin
      }
    });
    
    return pdfBuffer;
    
  } catch (error) {
    console.error('Bank Statement PDF generation error:', error);
    throw new Error(`Failed to generate bank statement PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Create professional HTML template for bank statement
const createBankStatementHTML = (bankAccount, transactions, filters = {}) => {
  const totalInflows = transactions.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
  const totalOutflows = transactions.reduce((sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0), 0);
  const netChange = totalInflows - totalOutflows;

  // Get company logo from bank account data or use default
  const getCompanyLogo = () => {
    try {
      // Try to get logo from company data if available
      if (bankAccount.companyLogo) {
        return bankAccount.companyLogo;
      }
    } catch (error) {
      console.error('Error getting company logo:', error);
    }
    return '';
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const companyLogo = getCompanyLogo();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bank Statement - ${bankAccount.accountName}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Arial, sans-serif;
                line-height: 1.3;
                color: #2c3e50;
                background: white;
                font-size: 10px;
            }
            
            .container {
                max-width: 100%;
                margin: 0;
                padding: 3px;
            }
            
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                padding: 8px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 4px;
            }
            
            .header-left {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .company-logo {
                width: 40px;
                height: 40px;
                border-radius: 4px;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                font-weight: bold;
                color: #667eea;
            }
            
            .header-info h1 {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 2px;
                text-transform: uppercase;
            }
            
            .header-info .account-name {
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 1px;
            }
            
            .header-info .generated-date {
                font-size: 9px;
                opacity: 0.9;
            }
            
            .header-right {
                text-align: right;
            }
            
            .balance-display {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 2px;
            }
            
            .balance-label {
                font-size: 9px;
                opacity: 0.9;
            }
            
            .content {
                padding: 0;
            }
            
            .section {
                margin-bottom: 12px;
            }
            
            .section-title {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 5px;
                color: #2c3e50;
                padding: 5px 8px;
                background: #ecf0f1;
                border-radius: 3px;
                border-left: 3px solid #3498db;
            }
            
            .account-details {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 10px;
            }
            
            .detail-item {
                background: #f8f9fa;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid #e9ecef;
                text-align: center;
            }
            
            .detail-label {
                font-size: 8px;
                font-weight: bold;
                margin-bottom: 2px;
                color: #6c757d;
                text-transform: uppercase;
            }
            
            .detail-value {
                font-size: 10px;
                font-weight: bold;
                color: #2c3e50;
            }
            
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-bottom: 10px;
            }
            
            .summary-card {
                background: white;
                padding: 10px;
                border-radius: 4px;
                text-align: center;
                border: 2px solid #e9ecef;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            
            .summary-card.inflow {
                border-color: #27ae60;
                background: linear-gradient(135deg, #f8fff9 0%, #e8f5e8 100%);
            }
            
            .summary-card.outflow {
                border-color: #e74c3c;
                background: linear-gradient(135deg, #fff8f8 0%, #fdeaea 100%);
            }
            
            .summary-card.net {
                border-color: #3498db;
                background: linear-gradient(135deg, #f8fbff 0%, #e8f4fd 100%);
            }
            
            .summary-amount {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 2px;
            }
            
            .summary-amount.inflow {
                color: #27ae60;
            }
            
            .summary-amount.outflow {
                color: #e74c3c;
            }
            
            .summary-amount.net {
                color: #3498db;
            }
            
            .summary-label {
                font-size: 8px;
                font-weight: bold;
                color: #6c757d;
                text-transform: uppercase;
            }
            
            .transactions-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 5px;
                background: white;
                border-radius: 4px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .transactions-table th {
                background: #34495e;
                color: white;
                padding: 6px 4px;
                text-align: left;
                font-weight: bold;
                font-size: 8px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            
            .transactions-table td {
                padding: 4px;
                border-bottom: 1px solid #ecf0f1;
                font-size: 8px;
                vertical-align: top;
            }
            
            .transactions-table tr:nth-child(even) {
                background: #f8f9fa;
            }
            
            .transactions-table tr:hover {
                background: #e8f4fd;
            }
            
            .transaction-type {
                display: inline-block;
                padding: 2px 4px;
                border-radius: 8px;
                font-size: 7px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            
            .transaction-type.payment { background: #e8f5e8; color: #27ae60; }
            .transaction-type.transfer { background: #e8f4fd; color: #3498db; }
            .transaction-type.expense { background: #fdeaea; color: #e74c3c; }
            .transaction-type.income { background: #e8f5e8; color: #27ae60; }
            .transaction-type.sale { background: #e8f5e8; color: #27ae60; }
            .transaction-type.purchase { background: #fdeaea; color: #e74c3c; }
            
            .amount-positive {
                color: #27ae60;
                font-weight: bold;
            }
            
            .amount-negative {
                color: #e74c3c;
                font-weight: bold;
            }
            
            .reference {
                font-size: 7px;
                color: #6c757d;
                margin-top: 1px;
                font-style: italic;
            }
            
            .contact-name {
                font-size: 7px;
                color: #6c757d;
                margin-top: 1px;
            }
            
            .footer {
                background: #34495e;
                color: white;
                padding: 8px;
                text-align: center;
                font-size: 8px;
                border-radius: 3px;
                margin-top: 10px;
            }
            
            .no-transactions {
                text-align: center;
                padding: 20px;
                color: #6c757d;
                font-style: italic;
                font-size: 10px;
                background: #f8f9fa;
                border-radius: 4px;
            }
            
            .filter-info {
                background: #e8f4fd;
                padding: 6px 10px;
                margin-bottom: 10px;
                font-size: 9px;
                border-radius: 3px;
                border-left: 3px solid #3498db;
            }
            
            .filter-info strong {
                color: #2c3e50;
            }
            
            @media print {
                body { background: white; }
                .container { box-shadow: none; }
                * { -webkit-print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-left">
                    ${companyLogo ? `
                        <img src="${companyLogo}" alt="Company Logo" style="width: 40px; height: 40px; border-radius: 4px; object-fit: contain;">
                    ` : `
                        <div class="company-logo">
                            ${bankAccount.accountName ? bankAccount.accountName.charAt(0).toUpperCase() : 'C'}
                        </div>
                    `}
                    <div class="header-info">
                        <h1>Bank Statement</h1>
                        <div class="account-name">${bankAccount.accountName}</div>
                        <div class="generated-date">Generated on: ${new Date().toLocaleDateString('en-IN')}</div>
                    </div>
                </div>
                <div class="header-right">
                    <div class="balance-display">${formatAmount(parseFloat(bankAccount.currentBalance || 0))}</div>
                    <div class="balance-label">Current Balance</div>
                </div>
            </div>
            
            <div class="content">
                <div class="section">
                    <div class="section-title">Account Information</div>
                    <div class="account-details">
                        <div class="detail-item">
                            <div class="detail-label">Account Name</div>
                            <div class="detail-value">${bankAccount.accountName}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Account Type</div>
                            <div class="detail-value">${bankAccount.accountType}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Opening Balance</div>
                            <div class="detail-value">${formatAmount(parseFloat(bankAccount.openingBalance || 0))}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Total Transactions</div>
                            <div class="detail-value">${transactions.length}</div>
                        </div>
                    </div>
                </div>
                
                ${(filters.startDate || filters.endDate || (filters.transactionType && filters.transactionType !== 'all')) ? `
                <div class="section">
                    <div class="section-title">Filter Details</div>
                    <div class="filter-info">
                        ${filters.startDate ? `<strong>From:</strong> ${formatDate(filters.startDate)} ` : ''}
                        ${filters.endDate ? `<strong>To:</strong> ${formatDate(filters.endDate)} ` : ''}
                        ${filters.transactionType && filters.transactionType !== 'all' ? `<strong>Type:</strong> ${filters.transactionType.charAt(0).toUpperCase() + filters.transactionType.slice(1)}` : ''}
                    </div>
                </div>
                ` : ''}
                
                <div class="section">
                    <div class="section-title">Financial Summary</div>
                    <div class="summary-grid">
                        <div class="summary-card inflow">
                            <div class="summary-amount inflow">${formatAmount(totalInflows)}</div>
                            <div class="summary-label">Total Inflows</div>
                        </div>
                        <div class="summary-card outflow">
                            <div class="summary-amount outflow">${formatAmount(totalOutflows)}</div>
                            <div class="summary-label">Total Outflows</div>
                        </div>
                        <div class="summary-card net">
                            <div class="summary-amount net">${formatAmount(netChange)}</div>
                            <div class="summary-label">Net Change</div>
                        </div>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Transaction History</div>
                    ${transactions.length > 0 ? `
                    <table class="transactions-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Balance</th>
                                <th>Bank/Contact</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.map(transaction => `
                                <tr>
                                    <td>${formatDate(transaction.date)}</td>
                                    <td>
                                        <div>${transaction.description || 'N/A'}</div>
                                        ${transaction.reference ? `<div class="reference">Ref: ${transaction.reference}</div>` : ''}
                                    </td>
                                    <td>
                                        <span class="transaction-type ${transaction.transaction_type}">
                                            ${transaction.category}
                                        </span>
                                    </td>
                                    <td class="${transaction.amount >= 0 ? 'amount-positive' : 'amount-negative'}">
                                        ${transaction.amount >= 0 ? '+' : '-'} ${formatAmount(Math.abs(transaction.amount))}
                                    </td>
                                    <td class="amount-positive">${formatAmount(transaction.runningBalance)}</td>
                                    <td>
                                        <div>${transaction.bank_contact || transaction.contact_name || 'N/A'}</div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : `
                    <div class="no-transactions">
                        No transactions found for the selected filters.
                    </div>
                    `}
                </div>
            </div>
            
            <div class="footer">
                This is a computer generated statement. Please contact your bank for any discrepancies.
            </div>
        </div>
    </body>
    </html>
  `;
}; 
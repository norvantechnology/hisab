import puppeteer from 'puppeteer';
import ExcelJS from 'exceljs';

// Generate PDF from HTML content - Using EXACT same approach as working bank statement
export const generateContactStatementPDF = async (contact, transactions, summary, filters = {}) => {
  let browser;
  
  try {
    // Generate HTML content
    const htmlContent = createContactStatementHTML(contact, transactions, summary, filters);
    
    // Launch browser - EXACT same as bank statement
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content - EXACT same as bank statement
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF - EXACT same settings as bank statement
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
    console.error('Contact Statement PDF generation error:', error);
    throw new Error(`Failed to generate contact statement PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Create HTML template - Professional and compact design
const createContactStatementHTML = (contact, transactions, summary, filters = {}) => {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const totalDebit = parseFloat(summary?.totalDebit) || 0;
  const totalCredit = parseFloat(summary?.totalCredit) || 0;
  const netBalance = parseFloat(summary?.netBalance) || 0;

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

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contact Statement - ${contact.name}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: Arial, sans-serif;
                font-size: 9px;
                line-height: 1.2;
                color: #000;
                background: #fff;
                padding: 8px;
            }
            
            .container {
                max-width: 100%;
                margin: 0 auto;
            }
            
            .header {
                text-align: center;
                margin-bottom: 12px;
                padding: 8px;
                background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
                color: #0f172a;
                border: 1px solid #0ea5e9;
                border-radius: 4px;
            }
            
            .header h1 {
                font-size: 16px;
                margin-bottom: 2px;
                font-weight: bold;
                text-transform: uppercase;
                color: #0c4a6e;
            }
            
            .header .subtitle {
                font-size: 8px;
                color: #374151;
            }
            
            .company-logo {
                text-align: center;
                margin-bottom: 8px;
            }
            
            .company-logo img {
                max-height: 30px;
                max-width: 100px;
                object-fit: contain;
            }
            
            .contact-info {
                background: #f8f9fa;
                padding: 8px;
                border-radius: 3px;
                margin-bottom: 10px;
                border-left: 3px solid #6b7280;
                font-size: 8px;
            }
            
            .contact-info h3 {
                color: #374151;
                margin-bottom: 6px;
                font-size: 10px;
                text-transform: uppercase;
            }
            
            .contact-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 3px;
            }
            
            .contact-label {
                font-weight: bold;
                min-width: 80px;
            }
            
            .contact-value {
                flex: 1;
                text-align: right;
            }
            
            .period-info {
                background: #e0f2fe;
                padding: 6px;
                text-align: center;
                border-radius: 3px;
                margin-bottom: 10px;
                color: #0f172a;
                font-weight: bold;
                font-size: 8px;
                border: 1px solid #0ea5e9;
            }
            
            .transaction-table {
                width: 100%;
                border-collapse: collapse;
                margin: 8px 0;
                font-size: 7px;
            }
            
            .transaction-table th {
                background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                color: #0f172a;
                padding: 4px 3px;
                text-align: center;
                font-weight: bold;
                border: 1px solid #cbd5e1;
                font-size: 7px;
                text-transform: uppercase;
            }
            
            .transaction-table td {
                padding: 3px;
                border: 1px solid #e2e8f0;
                vertical-align: top;
                font-size: 7px;
            }
            
            .transaction-table tbody tr:nth-child(even) {
                background-color: #f8fafc;
            }
            
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            
            .summary {
                background: #f0fdf4;
                padding: 8px;
                border-radius: 4px;
                margin-top: 10px;
                border: 1px solid #16a34a;
            }
            
            .summary h3 {
                color: #166534;
                margin-bottom: 6px;
                font-size: 10px;
                text-transform: uppercase;
                text-align: center;
            }
            
            .summary-grid {
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }
            
            .summary-item {
                flex: 1;
                text-align: center;
                padding: 4px;
                border: 1px solid #d1d5db;
                border-radius: 3px;
                background: white;
            }
            
            .summary-label {
                font-size: 7px;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 2px;
            }
            
            .summary-value {
                font-weight: bold;
                font-size: 8px;
                color: #000;
            }
            
            .net-balance {
                background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%) !important;
                color: #1e40af !important;
                border: 1px solid #3b82f6 !important;
            }
            
            .footer {
                text-align: center;
                margin-top: 12px;
                padding-top: 6px;
                border-top: 1px solid #cbd5e1;
                color: #6b7280;
                font-size: 7px;
            }
            
            .no-transactions {
                text-align: center;
                padding: 20px;
                color: #6b7280;
                font-style: italic;
            }
            
            @media print {
                body { margin: 0; padding: 4px; }
                .container { max-width: none; padding: 4px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Professional Header with Logo -->
            <div class="header">
                <h1>Contact Statement</h1>
                <div class="subtitle">Generated on ${new Date().toLocaleString('en-IN')}</div>
            </div>
            
            <!-- Compact Contact Information -->
            <div class="contact-info">
                <h3>Contact Information</h3>
                <div class="contact-row">
                    <span class="contact-label">Name:</span>
                    <span class="contact-value">${contact.name || 'N/A'}</span>
                </div>
                <div class="contact-row">
                    <span class="contact-label">Type:</span>
                    <span class="contact-value">${contact.contactType?.toUpperCase() || 'N/A'}</span>
                </div>
                <div class="contact-row">
                    <span class="contact-label">Mobile:</span>
                    <span class="contact-value">${contact.mobile || 'N/A'}</span>
                </div>
                <div class="contact-row">
                    <span class="contact-label">Email:</span>
                    <span class="contact-value">${contact.email || 'N/A'}</span>
                </div>
                <div class="contact-row">
                    <span class="contact-label">Current Balance:</span>
                    <span class="contact-value"><strong>${formatAmount(summary?.currentBalance || 0)}</strong></span>
                </div>
            </div>
            
            ${filters.startDate || filters.endDate ? `
            <div class="period-info">
                <strong>Period:</strong> ${filters.startDate || 'All Time'} ${filters.endDate ? `to ${filters.endDate}` : ''}
                ${filters.transactionType !== 'all' ? ` | Type: ${filters.transactionType.toUpperCase()}` : ''}
            </div>
            ` : ''}
            
            ${safeTransactions.length > 0 ? `
            <!-- Compact Transaction Table -->
            <table class="transaction-table">
                <thead>
                    <tr>
                        <th style="width: 8%;">Date</th>
                        <th style="width: 10%;">Ref#</th>
                        <th style="width: 20%;">Description</th>
                        <th style="width: 6%;">Type</th>
                        <th style="width: 10%;">Debit</th>
                        <th style="width: 10%;">Credit</th>
                        <th style="width: 10%;">Paid</th>
                        <th style="width: 10%;">Pending</th>
                        <th style="width: 6%;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${safeTransactions.map(transaction => `
                        <tr>
                            <td class="text-center">${formatDate(transaction.transaction_date)}</td>
                            <td class="text-center"><strong>${transaction.reference_number || 'N/A'}</strong></td>
                            <td>${transaction.description || 'N/A'}</td>
                            <td class="text-center"><small>${transaction.transaction_type?.toUpperCase() || 'N/A'}</small></td>
                            <td class="text-right">${parseFloat(transaction.debit_amount || 0) > 0 ? formatAmount(transaction.debit_amount) : '-'}</td>
                            <td class="text-right">${parseFloat(transaction.credit_amount || 0) > 0 ? formatAmount(transaction.credit_amount) : '-'}</td>
                            <td class="text-right">${parseFloat(transaction.paid_amount || 0) > 0 ? formatAmount(transaction.paid_amount) : '-'}</td>
                            <td class="text-right">${parseFloat(transaction.remaining_amount || 0) > 0 ? '<strong style="color: #b91c1c;">' + formatAmount(transaction.remaining_amount) + '</strong>' : '-'}</td>
                            <td class="text-center"><small>${transaction.status?.toUpperCase() || 'N/A'}</small></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : `
            <div class="no-transactions">
                No transactions found for the selected period.
            </div>
            `}
            
            <!-- Professional Summary Section -->
            <div class="summary">
                <h3>Statement Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Total Debit</div>
                        <div class="summary-value">${formatAmount(summary.totalDebit || 0)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Credit</div>
                        <div class="summary-value">${formatAmount(summary.totalCredit || 0)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Total Paid</div>
                        <div class="summary-value">${formatAmount(summary.totalPaidAmount || 0)}</div>
                    </div>
                    <div class="summary-item net-balance">
                        <div class="summary-label">Total Pending</div>
                        <div class="summary-value">${formatAmount(summary.totalPendingAmount || 0)}</div>
                    </div>
                </div>
                
                <!-- Running Balance -->
                <div style="margin-top: 8px; padding: 6px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 3px; text-align: center;">
                    <strong style="color: #0c4a6e;">Running Balance: ${formatAmount(summary.runningBalance || 0)}</strong>
                </div>
            </div>
            
            <!-- Minimal Footer -->
            <div class="footer">
                Contact Statement | Generated by HISAB Financial Management System | ${process.env.FRONTEND_URL || 'www.hisab.com'}
            </div>
        </div>
    </body>
    </html>
  `;
};

// Generate Excel file for contact statement
export const generateContactStatementExcel = async (contact, transactions, summary, filters = {}) => {
    try {

        const safeTransactions = Array.isArray(transactions) ? transactions : [];
        const safeSummary = {
            totalDebit: parseFloat(summary?.totalDebit) || 0,
            totalCredit: parseFloat(summary?.totalCredit) || 0,
            netBalance: parseFloat(summary?.netBalance) || 0,
            currentBalance: parseFloat(summary?.currentBalance) || 0,
            currentBalanceType: summary?.currentBalanceType || 'receivable',
            transactionCount: parseInt(summary?.transactionCount) || 0
        };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'HISAB System';
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet('Contact Statement');
        
        // Set column widths
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Reference', key: 'reference', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Type', key: 'type', width: 12 },
            { header: 'Debit Amount', key: 'debit', width: 15 },
            { header: 'Credit Amount', key: 'credit', width: 15 },
            { header: 'Running Balance', key: 'balance', width: 18 },
            { header: 'Status', key: 'status', width: 12 }
        ];
        
        // Add title
        worksheet.mergeCells('A1:H1');
        worksheet.getCell('A1').value = 'CONTACT STATEMENT';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };
        
        // Add contact info
        worksheet.mergeCells('A3:D3');
        worksheet.getCell('A3').value = `Contact: ${contact.name || 'N/A'}`;
        worksheet.getCell('A3').font = { bold: true };
        
        worksheet.mergeCells('E3:H3');
        worksheet.getCell('E3').value = `Current Balance: ${formatCurrency(safeSummary.currentBalance)}`;
        
        // Add headers
        const headers = worksheet.getRow(5);
        headers.values = ['Date', 'Reference', 'Description', 'Type', 'Debit Amount', 'Credit Amount', 'Running Balance', 'Status'];
        headers.font = { bold: true };
        headers.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6FA' }
        };
        
        // Add transaction data
        let rowIndex = 6;
        safeTransactions.forEach((transaction) => {
            const row = worksheet.getRow(rowIndex);
            row.values = [
                formatDate(transaction.transaction_date),
                transaction.reference_number || '',
                transaction.description || '',
                transaction.transaction_type?.toUpperCase() || '',
                parseFloat(transaction.debit_amount) || 0,
                parseFloat(transaction.credit_amount) || 0,
                parseFloat(transaction.running_balance) || 0,
                transaction.status?.toUpperCase() || ''
            ];
            
            // Format currency cells
            row.getCell(5).numFmt = '₹#,##0.00';
            row.getCell(6).numFmt = '₹#,##0.00';
            row.getCell(7).numFmt = '₹#,##0.00';
            
            rowIndex++;
        });
        
        // Add summary
        const summaryRow = rowIndex + 2;
        worksheet.getCell(`A${summaryRow}`).value = 'SUMMARY';
        worksheet.getCell(`A${summaryRow}`).font = { bold: true };
        
        worksheet.getCell(`A${summaryRow + 1}`).value = 'Total Debit:';
        worksheet.getCell(`B${summaryRow + 1}`).value = formatCurrency(safeSummary.totalDebit);
        
        worksheet.getCell(`A${summaryRow + 2}`).value = 'Total Credit:';
        worksheet.getCell(`B${summaryRow + 2}`).value = formatCurrency(safeSummary.totalCredit);
        
        worksheet.getCell(`A${summaryRow + 3}`).value = 'Net Balance:';
        worksheet.getCell(`B${summaryRow + 3}`).value = formatCurrency(safeSummary.netBalance);
        
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
        
    } catch (error) {
        console.error('Contact Statement Excel generation error:', error);
        throw new Error(`Failed to generate contact statement Excel: ${error.message}`);
    }
};

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(parseFloat(amount) || 0);
};

// Helper function to format date
const formatDate = (dateString) => {
    try {
        return new Date(dateString).toLocaleDateString('en-IN');
    } catch (error) {
        return 'Invalid Date';
    }
}; 
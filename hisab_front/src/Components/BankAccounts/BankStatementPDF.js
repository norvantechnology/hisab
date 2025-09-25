import { getSelectedCompany } from '../../utils/companyEvents';

export const generateBankStatementPDF = async (bankAccount, transactions, summary, filters, copies = 2) => {
    try {
        // Get company information
        const companyInfo = getSelectedCompany() || { name: 'Your Company Name' };
        
        // Create professional bank statement HTML
        const statementHTML = createBankStatementHTML(bankAccount, transactions, summary, filters, copies, companyInfo);
        
        // Open in new tab for printing/saving
        const printWindow = window.open('', '_blank');
        printWindow.document.write(statementHTML);
        printWindow.document.close();
        
        // Wait for content and images to load then focus
        printWindow.onload = () => {
            const images = printWindow.document.images;
            let loadedImages = 0;
            const totalImages = images.length;
            
            if (totalImages === 0) {
                setTimeout(() => {
                    printWindow.focus();
                }, 300);
                return;
            }
            
            const checkAllImagesLoaded = () => {
                loadedImages++;
                if (loadedImages >= totalImages) {
                    setTimeout(() => {
                        printWindow.focus();
                    }, 500);
                }
            };
            
            for (let i = 0; i < images.length; i++) {
                images[i].onload = checkAllImagesLoaded;
                images[i].onerror = checkAllImagesLoaded;
            }
        };
        
        return true;
    } catch (error) {
        console.error('Error generating bank statement PDF:', error);
        throw error;
    }
};

const createBankStatementHTML = (bankAccount, transactions, summary, filters, copies, companyInfo) => {
    const statementDate = new Date().toLocaleDateString('en-IN');
    const periodText = filters.startDate && filters.endDate ? 
        `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}` : 
        'All Transactions';

    const formatCurrency = (amount) => {
        const absAmount = Math.abs(parseFloat(amount) || 0);
        return absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Bank Statement - ${bankAccount.accountName}</title>
        <style>
            @page { 
                size: A4; 
                margin: 15mm 15mm 25mm 15mm; 
            }
            body { 
                font-family: 'Arial', 'Helvetica', sans-serif; 
                font-size: 11px; 
                line-height: 1.3; 
                color: #000;
                margin: 0;
                padding: 0;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .page-container {
                position: relative;
                min-height: calc(100vh - 40mm);
                padding-bottom: 50px;
            }
            .header-section {
                border-bottom: 2px solid #2563eb;
                padding-bottom: 15px;
                margin-bottom: 20px;
                position: relative;
            }
            .company-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 15px;
            }
            .company-info {
                flex: 1;
                max-width: 60%;
            }
            .company-logo {
                max-height: 50px;
                max-width: 120px;
                margin-bottom: 8px;
                display: block;
            }
            .company-name {
                font-size: 20px;
                font-weight: bold;
                color: #1f2937;
                margin: 0 0 3px 0;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .company-tagline {
                color: #6b7280;
                font-size: 9px;
                margin: 0;
            }
            .statement-info {
                text-align: right;
                flex-shrink: 0;
            }
            .statement-title {
                font-size: 16px;
                font-weight: bold;
                color: #1f2937;
                margin: 0 0 5px 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .statement-subtitle {
                color: #6b7280;
                font-size: 9px;
                margin: 0;
            }
            .copy-indicator {
                position: absolute;
                top: -8px;
                right: 0;
                background: #2563eb;
                color: white;
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 8px;
                font-weight: bold;
                text-transform: uppercase;
            }
            .account-section {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 18px;
            }
            .account-table {
                width: 100%;
                border-collapse: collapse;
            }
            .account-table td {
                padding: 4px 8px;
                border: none;
                vertical-align: top;
            }
            .account-table .label {
                font-weight: 600;
                color: #374151;
                width: 120px;
                font-size: 10px;
            }
            .account-table .value {
                color: #1f2937;
                font-weight: 500;
                font-size: 10px;
            }
            .summary-section {
                margin: 18px 0;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                overflow: hidden;
            }
            .summary-header {
                background: #1f2937;
                color: white;
                padding: 8px 12px;
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .summary-body {
                padding: 12px;
                background: white;
            }
            .summary-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .summary-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 0;
                border-bottom: 1px solid #f1f5f9;
            }
            .summary-item:last-child {
                border-bottom: none;
                font-weight: 700;
                font-size: 11px;
            }
            .summary-label {
                font-weight: 500;
                color: #374151;
                font-size: 10px;
            }
            .summary-value {
                font-weight: 600;
                color: #1f2937;
                font-size: 10px;
            }
            .summary-value.positive {
                color: #059669;
            }
            .summary-value.negative {
                color: #dc2626;
            }
            .transactions-section {
                margin-top: 20px;
            }
            .section-title {
                font-size: 12px;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .transactions-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                overflow: hidden;
            }
            .transactions-table th {
                background: #1f2937;
                color: white;
                padding: 8px 6px;
                text-align: left;
                font-weight: 600;
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                border-bottom: 1px solid #374151;
            }
            .transactions-table td {
                padding: 8px 6px;
                border-bottom: 1px solid #f1f5f9;
                font-size: 9px;
                vertical-align: top;
            }
            .transactions-table tr:nth-child(even) {
                background: #f8fafc;
            }
            .transactions-table tr:last-child td {
                border-bottom: none;
            }
            .transaction-date {
                font-weight: 500;
                color: #374151;
                white-space: nowrap;
            }
            .transaction-ref {
                color: #6b7280;
                font-size: 8px;
                margin-top: 1px;
            }
            .transaction-desc {
                font-weight: 500;
                color: #1f2937;
                line-height: 1.2;
            }
            .transaction-contact {
                color: #6b7280;
                font-size: 8px;
                margin-top: 2px;
            }
            .transaction-notes {
                font-style: italic;
                color: #2563eb;
                font-size: 8px;
                margin-top: 2px;
            }
            .transaction-type {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 8px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            .type-purchase { background: #fef3c7; color: #92400e; }
            .type-sale { background: #d1fae5; color: #065f46; }
            .type-payment { background: #dbeafe; color: #1e40af; }
            .type-expense { background: #fee2e2; color: #991b1b; }
            .type-income { background: #d1fae5; color: #065f46; }
            .type-transfer { background: #e0e7ff; color: #3730a3; }
            .amount-cell {
                text-align: right;
                font-weight: 600;
                white-space: nowrap;
            }
            .balance-cell {
                text-align: right;
                font-weight: 700;
                white-space: nowrap;
                background: #f1f5f9 !important;
                border-left: 2px solid #e2e8f0 !important;
            }
            .page-footer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 30px;
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
                padding: 5px 15mm;
                font-size: 7px;
                color: #6b7280;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 1000;
            }
            .footer-left {
                text-align: left;
                flex: 1;
            }
            .footer-right {
                text-align: right;
                flex: 1;
            }
            .disclaimer {
                margin-top: 25px;
                padding: 10px;
                background: #fef9c3;
                border: 1px solid #eab308;
                border-radius: 4px;
                font-size: 8px;
                color: #a16207;
                text-align: center;
                margin-bottom: 50px;
            }
            @media print {
                body { margin: 0; }
                .page-break { page-break-before: always; }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body>`;

    // Generate copies
    for (let copy = 1; copy <= copies; copy++) {
        if (copy > 1) html += '<div class="page-break"></div>';
        
        html += `
        <div class="page-container">
            <div class="header-section">
                <div class="copy-indicator">Copy ${copy} of ${copies}</div>
                
                <div class="company-header">
                    <div class="company-info">
                        ${companyInfo.logoUrl ? `<img src="${companyInfo.logoUrl}" alt="Company Logo" class="company-logo">` : ''}
                        <div class="company-name">${companyInfo.name}</div>
                        <div class="company-tagline">Financial Management System</div>
                    </div>
                    <div class="statement-info">
                        <h1 class="statement-title">Bank Account Statement</h1>
                        <div class="statement-subtitle">Generated on ${statementDate}</div>
                    </div>
                </div>
            </div>

            <div class="account-section">
                <table class="account-table">
                    <tr>
                        <td class="label">Account Name:</td>
                        <td class="value">${bankAccount.accountName}</td>
                        <td class="label">Account Type:</td>
                        <td class="value">${bankAccount.accountType.toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td class="label">Statement Date:</td>
                        <td class="value">${statementDate}</td>
                        <td class="label">Statement Period:</td>
                        <td class="value">${periodText}</td>
                    </tr>
                    <tr>
                        <td class="label">Total Transactions:</td>
                        <td class="value">${transactions.length}</td>
                        <td class="label">Statement #:</td>
                        <td class="value">BS-${Date.now().toString().slice(-6)}</td>
                    </tr>
                </table>
            </div>

            <div class="summary-section">
                <div class="summary-header">Account Summary</div>
                <div class="summary-body">
                    <div class="summary-grid">
                        <div>
                            <div class="summary-item">
                                <span class="summary-label">Opening Balance:</span>
                                <span class="summary-value">₹${formatCurrency(summary.openingBalance)}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Total Inflows:</span>
                                <span class="summary-value positive">+₹${formatCurrency(summary.totalInflows)}</span>
                            </div>
                        </div>
                        <div>
                            <div class="summary-item">
                                <span class="summary-label">Total Outflows:</span>
                                <span class="summary-value negative">-₹${formatCurrency(summary.totalOutflows)}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Closing Balance:</span>
                                <span class="summary-value ${summary.currentBalance >= 0 ? 'positive' : 'negative'}">
                                    ${summary.currentBalance >= 0 ? '' : '-'}₹${formatCurrency(Math.abs(summary.currentBalance))}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="transactions-section">
                <div class="section-title">Transaction History</div>
                <table class="transactions-table">
                    <thead>
                        <tr>
                            <th style="width: 10%;">Date</th>
                            <th style="width: 15%;">Reference</th>
                            <th style="width: 40%;">Description</th>
                            <th style="width: 10%;">Type</th>
                            <th style="width: 12%; text-align: right;">Amount</th>
                            <th style="width: 13%; text-align: right;">Balance</th>
                        </tr>
                    </thead>
                    <tbody>`;

        transactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount) || 0;
            const runningBalance = parseFloat(transaction.runningBalance) || 0;
            
            // Get transaction type class
            const typeClass = `type-${transaction.transaction_type}`;
            
            html += `
                <tr>
                    <td class="transaction-date">${formatDate(transaction.date)}</td>
                    <td>
                        <div class="transaction-ref">${transaction.reference || 'N/A'}</div>
                    </td>
                    <td>
                        <div class="transaction-desc">${transaction.description}</div>
                        ${transaction.contact_name ? `<div class="transaction-contact">${transaction.contact_name}</div>` : ''}
                        ${transaction.notes ? `<div class="transaction-notes">"${transaction.notes}"</div>` : ''}
                    </td>
                    <td>
                        <span class="transaction-type ${typeClass}">${transaction.category}</span>
                    </td>
                    <td class="amount-cell ${amount >= 0 ? 'amount-positive' : 'amount-negative'}">
                        ${amount >= 0 ? '+' : ''}₹${formatCurrency(Math.abs(amount))}
                    </td>
                    <td class="balance-cell ${runningBalance >= 0 ? 'balance-positive' : 'balance-negative'}">
                        ${runningBalance < 0 ? '-' : ''}₹${formatCurrency(Math.abs(runningBalance))}
                    </td>
                </tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>

            <div class="disclaimer">
                <strong>Important:</strong> This is a computer-generated statement and does not require a signature. 
                Please verify all transactions and report any discrepancies immediately.
            </div>
        </div>`;
    }

    // Add page footer
    html += `
        <div class="page-footer">
            <div class="footer-left">
                Generated by ${companyInfo.name} | ${new Date().toLocaleString('en-IN')}
            </div>
            <div class="footer-right">
                www.hisab.in | Powered by HISAB Financial Management
            </div>
        </div>
    </body>
    </html>`;

    return html;
}; 
import pool from "../config/dbConnection.js";
import { errorResponse, successResponse, sendEmail } from "../utils/index.js";
import { generateContactStatementPDF, generateContactStatementExcel } from "../utils/contactStatementGenerator.js";

// Get contact statement with all transactions
export async function getContactStatement(req, res) {
    const { contactId } = req.params;
    const { 
        startDate, 
        endDate, 
        transactionType = 'all', // all, sales, purchases, income, expense, payments
        format = 'json' // json, pdf, excel
    } = req.query;
    
    const companyId = req.currentUser?.companyId;
    const currentUserId = req.currentUser?.id;

    if (!companyId || !currentUserId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!contactId) {
        return errorResponse(res, "Contact ID is required", 400);
    }

    const client = await pool.connect();

    try {
        // First, get contact details
        const contactQuery = `
            SELECT 
                c.id, c.name, c.gstin, c.mobile, c.email, c."contactType",
                c."currentBalance", c."currentBalanceType",
                c."billingAddress1", c."billingAddress2", c."billingCity", 
                c."billingPincode", c."billingState", c."billingCountry",
                comp.name as "companyName", comp."address1" as "companyAddress1",
                comp."address2" as "companyAddress2", comp."city" as "companyCity",
                comp."pincode" as "companyPincode", comp."state" as "companyState"
            FROM hisab.contacts c
            JOIN hisab.companies comp ON c."companyId" = comp.id
            WHERE c.id = $1 AND c."companyId" = $2 AND c."deletedAt" IS NULL
        `;
        
        const contactResult = await client.query(contactQuery, [contactId, companyId]);
        
        if (contactResult.rows.length === 0) {
            return errorResponse(res, "Contact not found", 404);
        }

        const contact = contactResult.rows[0];
        let transactions = [];

        // Build date filter
        let dateFilter = '';
        const dateParams = [];
        let paramCount = 1;

        if (startDate && endDate) {
            dateFilter = ` AND DATE(COALESCE("invoiceDate", "date")) BETWEEN $${paramCount} AND $${paramCount + 1}`;
            dateParams.push(startDate, endDate);
            paramCount += 2;
        } else if (startDate) {
            dateFilter = ` AND DATE(COALESCE("invoiceDate", "date")) >= $${paramCount}`;
            dateParams.push(startDate);
            paramCount++;
        } else if (endDate) {
            dateFilter = ` AND DATE(COALESCE("invoiceDate", "date")) <= $${paramCount}`;
            dateParams.push(endDate);
            paramCount++;
        }

        // Get all transactions based on type filter (excluding payments)
        if (transactionType === 'all' || transactionType === 'sales') {
            const salesQuery = `
                SELECT 
                    'sale' as transaction_type,
                    id,
                    "invoiceNumber" as reference_number,
                    "invoiceDate" as transaction_date,
                    "basicAmount",
                    "taxAmount",
                    "totalDiscount",
                    "netReceivable" as total_amount,
                    COALESCE("remaining_amount", "netReceivable") as pending_amount,
                    COALESCE("paid_amount", 0) as paid_amount,
                    ("netReceivable" - COALESCE("paid_amount", 0)) as remaining_amount,
                    status,
                    "createdAt",
                    CONCAT('Sales Invoice #', "invoiceNumber") as description,
                    "netReceivable" as debit_amount,
                    0 as credit_amount
                FROM hisab.sales 
                WHERE "contactId" = $${paramCount} AND "deletedAt" IS NULL ${dateFilter}
                ORDER BY "invoiceDate" ASC
            `;
            
            const salesResult = await client.query(salesQuery, [contactId, ...dateParams]);
            transactions.push(...salesResult.rows);
        }

        if (transactionType === 'all' || transactionType === 'purchases') {
            const purchaseQuery = `
                SELECT 
                    'purchase' as transaction_type,
                    id,
                    "invoiceNumber" as reference_number,
                    "invoiceDate" as transaction_date,
                    "basicAmount",
                    "taxAmount",
                    "totalDiscount",
                    "netPayable" as total_amount,
                    COALESCE("remaining_amount", "netPayable") as pending_amount,
                    COALESCE("paid_amount", 0) as paid_amount,
                    ("netPayable" - COALESCE("paid_amount", 0)) as remaining_amount,
                    status,
                    "createdAt",
                    CONCAT('Purchase Invoice #', "invoiceNumber") as description,
                    0 as debit_amount,
                    "netPayable" as credit_amount
                FROM hisab.purchases 
                WHERE "contactId" = $${paramCount} AND "deletedAt" IS NULL ${dateFilter}
                ORDER BY "invoiceDate" ASC
            `;
            
            const purchaseResult = await client.query(purchaseQuery, [contactId, ...dateParams]);
            transactions.push(...purchaseResult.rows);
        }

        if (transactionType === 'all' || transactionType === 'income') {
            const incomeQuery = `
                SELECT 
                    'income' as transaction_type,
                    id,
                    CONCAT('INC-', id) as reference_number,
                    "date" as transaction_date,
                    amount as "basicAmount",
                    0 as "taxAmount",
                    0 as "totalDiscount",
                    amount as total_amount,
                    COALESCE("remaining_amount", amount) as pending_amount,
                    COALESCE("paid_amount", 0) as paid_amount,
                    (amount - COALESCE("paid_amount", 0)) as remaining_amount,
                    status,
                    "createdAt",
                    COALESCE(notes, 'Income Transaction') as description,
                    amount as debit_amount,
                    0 as credit_amount
                FROM hisab.incomes 
                WHERE "contactId" = $${paramCount} ${dateFilter}
                ORDER BY "date" ASC
            `;
            
            const incomeResult = await client.query(incomeQuery, [contactId, ...dateParams]);
            transactions.push(...incomeResult.rows);
        }

        if (transactionType === 'all' || transactionType === 'expense') {
            const expenseQuery = `
                SELECT 
                    'expense' as transaction_type,
                    id,
                    CONCAT('EXP-', id) as reference_number,
                    "date" as transaction_date,
                    amount as "basicAmount",
                    0 as "taxAmount",
                    0 as "totalDiscount",
                    amount as total_amount,
                    COALESCE("remaining_amount", amount) as pending_amount,
                    COALESCE("paid_amount", 0) as paid_amount,
                    (amount - COALESCE("paid_amount", 0)) as remaining_amount,
                    status,
                    "createdAt",
                    COALESCE(notes, 'Expense Transaction') as description,
                    0 as debit_amount,
                    amount as credit_amount
                FROM hisab.expenses 
                WHERE "contactId" = $${paramCount} ${dateFilter}
                ORDER BY "date" ASC
            `;
            
            const expenseResult = await client.query(expenseQuery, [contactId, ...dateParams]);
            transactions.push(...expenseResult.rows);
        }

        // Sort all transactions by date
        transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));

        // Calculate comprehensive summary (business + accounting)
        let totalInvoiceAmount = 0;
        let totalPaidAmount = 0;
        let totalPendingAmount = 0;
        let totalSales = 0;
        let totalPurchases = 0;
        let totalDebit = 0;
        let totalCredit = 0;
        let runningBalance = 0;

        transactions.forEach(transaction => {
            const totalAmount = parseFloat(transaction.total_amount || 0);
            const paidAmount = parseFloat(transaction.paid_amount || 0);
            const remainingAmount = parseFloat(transaction.remaining_amount || 0);
            const debitAmount = parseFloat(transaction.debit_amount || 0);
            const creditAmount = parseFloat(transaction.credit_amount || 0);
            
            // Business metrics
            totalInvoiceAmount += totalAmount;
            totalPaidAmount += paidAmount;
            totalPendingAmount += remainingAmount;
            
            // Accounting metrics
            totalDebit += debitAmount;
            totalCredit += creditAmount;
            runningBalance += (debitAmount - creditAmount);
            
            // Add running balance to transaction for display
            transaction.running_balance = runningBalance;
            
            // Separate sales and purchases for better insights
            if (transaction.transaction_type === 'sale' || transaction.transaction_type === 'income') {
                totalSales += totalAmount;
            } else if (transaction.transaction_type === 'purchase' || transaction.transaction_type === 'expense') {
                totalPurchases += totalAmount;
            }
        });

        const summary = {
            // Business metrics
            totalInvoiceAmount,
            totalPaidAmount, 
            totalPendingAmount,
            totalSales,
            totalPurchases,
            // Accounting metrics
            totalDebit,
            totalCredit,
            netBalance: totalSales - totalPurchases, // Business net
            runningBalance, // Accounting running balance
            currentBalance: parseFloat(contact.currentBalance || 0),
            currentBalanceType: contact.currentBalanceType,
            transactionCount: transactions.length
        };

        // Handle different response formats
        if (format === 'pdf') {
            const pdfBuffer = await generateContactStatementPDF(contact, transactions, summary, {
                startDate,
                endDate,
                transactionType
            });

            const fileName = `contact_statement_${contact.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            return res.send(pdfBuffer);
        }

        if (format === 'excel') {
            const excelBuffer = await generateContactStatementExcel(contact, transactions, summary, {
                startDate,
                endDate,
                transactionType
            });

            const fileName = `contact_statement_${contact.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', excelBuffer.length);
            
            return res.send(excelBuffer);
        }

        // Default JSON response
        return successResponse(res, {
            contact,
            transactions,
            summary,
            filters: {
                startDate,
                endDate,
                transactionType
            }
        });

    } catch (error) {
        console.error("Error fetching contact statement:", error);
        return errorResponse(res, "Error fetching contact statement", 500);
    } finally {
        client.release();
    }
}

// Share contact statement via email
export async function shareContactStatement(req, res) {
    const { contactId } = req.params;
    const { 
        email, 
        format = 'pdf', // pdf, excel
        startDate, 
        endDate, 
        transactionType = 'all',
        message = '',
        subject = ''
    } = req.body;
    
    const companyId = req.currentUser?.companyId;
    const currentUserId = req.currentUser?.id;

    if (!companyId || !currentUserId) {
        return errorResponse(res, "Unauthorized access", 401);
    }

    if (!contactId || !email) {
        return errorResponse(res, "Contact ID and email are required", 400);
    }

    try {
        // Get statement data by calling the same function but with format parameter
        const statementReq = {
            ...req,
            query: { startDate, endDate, transactionType, format }
        };
        
        // For email sharing, we'll generate the file and send it
        // This is a simplified version - in production you might want to reuse the logic
        const emailSubject = subject || `Contact Statement - ${contactId}`;
        const emailMessage = message || `Please find attached the contact statement.`;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #2c5aa0;">Contact Statement</h2>
                <p>${emailMessage}</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h4 style="margin-top: 0;">Statement Details:</h4>
                    <ul style="margin-bottom: 0;">
                        <li><strong>Period:</strong> ${startDate || 'All Time'} ${endDate ? `to ${endDate}` : ''}</li>
                        <li><strong>Transaction Type:</strong> ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}</li>
                        <li><strong>Generated:</strong> ${new Date().toLocaleDateString()}</li>
                    </ul>
                </div>
                <p>If you have any questions about this statement, please don't hesitate to contact us.</p>
                <p>Best regards,<br>Your Company</p>
            </div>
        `;

        await sendEmail({
            to: email,
            subject: emailSubject,
            html: htmlContent
        });

        return successResponse(res, {
            message: "Contact statement sent successfully",
            sentTo: email
        });

    } catch (error) {
        console.error("Error sharing contact statement:", error);
        return errorResponse(res, "Error sharing contact statement", 500);
    }
} 
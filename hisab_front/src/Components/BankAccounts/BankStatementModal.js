import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Row,
    Col,
    Card,
    CardBody,
    Badge,
    Input,
    Label,
    Table,
    Pagination,
    PaginationItem,
    PaginationLink,
    Spinner,
    Alert,
    InputGroup,
    InputGroupText,
    ButtonGroup,
    UncontrolledDropdown,
    DropdownToggle,
    DropdownMenu,
    DropdownItem
} from 'reactstrap';
import { toast } from 'react-toastify';
import {
    RiCloseLine,
    RiCalendarLine,
    RiFilter3Line,
    RiDownload2Line,
    RiEyeLine,
    RiBankLine,
    RiExchangeLine,
    RiArrowUpLine,
    RiArrowDownLine,
    RiLineChartLine,
    RiBarChartLine,
    RiRefreshLine,
    RiSearchLine,
    RiFileTextLine,
    RiShoppingCartLine,
    RiStoreLine,
    RiWalletLine,
    RiCashLine
} from 'react-icons/ri';
import { getBankStatement, exportBankStatementPDF } from '../../services/bankAccount';
import { getDefaultCopies } from '../../services/copyPreferences';
import { generateBankStatementPDF } from './BankStatementPDF';

const BankStatementModal = ({ show, onCloseClick, bankAccount }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [defaultCopies, setDefaultCopies] = useState(2);

    const [summary, setSummary] = useState({
        openingBalance: 0,
        totalInflows: 0,
        totalOutflows: 0,
        currentBalance: 0
    });
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        transactionType: 'all',
        searchTerm: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    const transactionTypes = [
        { value: 'all', label: 'All Transactions', icon: <RiFileTextLine />, color: 'secondary' },
        { value: 'payments', label: 'Payments & Receipts', icon: <RiWalletLine />, color: 'primary' },
        { value: 'transfers', label: 'Bank Transfers', icon: <RiExchangeLine />, color: 'info' },
        { value: 'expenses', label: 'Expenses', icon: <RiBarChartLine />, color: 'danger' },
        { value: 'incomes', label: 'Incomes', icon: <RiLineChartLine />, color: 'success' },
        { value: 'sales', label: 'Sales', icon: <RiStoreLine />, color: 'success' },
        { value: 'purchases', label: 'Purchases', icon: <RiShoppingCartLine />, color: 'warning' }
    ];

    // Enhanced transaction icon mapping
    const getTransactionIcon = (type, category) => {
        const iconMap = {
            'payment': <RiWalletLine className="text-primary" />,
            'transfer': <RiExchangeLine className="text-info" />,
            'expense': <RiBarChartLine className="text-danger" />,
            'income': <RiLineChartLine className="text-success" />,
            'sale': <RiStoreLine className="text-success" />,
            'purchase': <RiShoppingCartLine className="text-warning" />,
            'opening_balance': <RiBankLine className="text-secondary" />
        };
        return iconMap[type] || <RiCashLine className="text-secondary" />;
    };

    // Simple transaction color mapping
    const getTransactionColor = (type) => {
        const colorMap = {
            'payment': 'primary',
            'transfer': 'info',
            'expense': 'danger',
            'income': 'success',
            'sale': 'success',
            'purchase': 'warning',
            'opening_balance': 'secondary'
        };
        return colorMap[type] || 'secondary';
    };

    // Format currency with proper styling
    const formatCurrency = (amount, isNegative = false) => {
        const absAmount = Math.abs(parseFloat(amount) || 0);
        const formatted = `₹${absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return formatted;
    };

    // Enhanced date formatting
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
    };

    // Filter transactions based on search term
    const filteredTransactions = useMemo(() => {
        if (!filters.searchTerm) return transactions;
        
        const searchLower = filters.searchTerm.toLowerCase();
        return transactions.filter(transaction => 
            transaction.description?.toLowerCase().includes(searchLower) ||
            transaction.reference?.toLowerCase().includes(searchLower) ||
            transaction.contact_name?.toLowerCase().includes(searchLower) ||
            transaction.category?.toLowerCase().includes(searchLower)
        );
    }, [transactions, filters.searchTerm]);

    const fetchBankStatement = async (page = 1) => {
        if (!bankAccount?.id) return;

        setLoading(true);
        try {
            const params = {
                page,
                limit: 20,
                transactionType: filters.transactionType,
                ...(filters.startDate && { startDate: filters.startDate }),
                ...(filters.endDate && { endDate: filters.endDate })
            };

            const response = await getBankStatement(bankAccount.id, params);
            
            if (response?.success) {
                setTransactions(response.transactions || []);
                setTotalPages(response.pagination?.totalPages || 0);
                setTotalTransactions(response.pagination?.total || 0);
                setCurrentPage(page);
                setSummary({
                    openingBalance: response.summary?.openingBalance || 0,
                    totalInflows: response.summary?.totalInflows || 0,
                    totalOutflows: response.summary?.totalOutflows || 0,
                    currentBalance: response.summary?.currentBalance || 0
                });
            } else {
                toast.error(response?.message || 'Failed to fetch bank statement');
            }
        } catch (error) {
            console.error('Error fetching bank statement:', error);
            toast.error('Failed to fetch bank statement');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (show && bankAccount?.id) {
            fetchBankStatement(1);
            fetchDefaultCopies();
        }
    }, [show, bankAccount?.id]);

    const fetchDefaultCopies = async () => {
        try {
            const response = await getDefaultCopies('bank_statement');
            setDefaultCopies(response.defaultCopies || 2);
        } catch (error) {
            console.error('Error fetching default copies:', error);
            setDefaultCopies(2);
        }
    };



    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleFilterSubmit = () => {
        fetchBankStatement(1);
    };

    const handlePageChange = (page) => {
        fetchBankStatement(page);
    };

    const handleGeneratePDF = async (copies = null) => {
        const copiesToUse = copies || defaultCopies;
        setIsExporting(true);
        
        try {
            await generateBankStatementPDF(
                bankAccount, 
                filteredTransactions, 
                summary, 
                filters, 
                copiesToUse
            );
            
            toast.success(`Bank statement generated with ${copiesToUse} ${copiesToUse === 1 ? 'copy' : 'copies'}!`);
        } catch (error) {
            console.error('Error generating bank statement:', error);
            toast.error('Failed to generate bank statement');
        } finally {
            setIsExporting(false);
        }
    };

    const generateBankStatementHTML = (copies) => {
        const statementDate = new Date().toLocaleDateString('en-IN');
        const periodText = filters.startDate && filters.endDate ? 
            `${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}` : 
            'All Transactions';

        const companyName = companyInfo?.name || 'Your Company Name';
        const companyLogo = companyInfo?.logoUrl;

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Bank Statement - ${bankAccount.accountName}</title>
            <style>
                @page { 
                    size: A4; 
                    margin: 15mm 15mm 20mm 15mm; 
                }
                body { 
                    font-family: 'Arial', sans-serif; 
                    font-size: 11px; 
                    line-height: 1.4; 
                    color: #000;
                    margin: 0;
                    padding: 0;
                    background: white;
                }
                .page-container {
                    min-height: 100vh;
                    position: relative;
                    padding-bottom: 60px;
                }
                .header {
                    border-bottom: 3px solid #2563eb;
                    padding-bottom: 20px;
                    margin-bottom: 25px;
                    position: relative;
                }
                .company-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }
                .company-info {
                    flex: 1;
                }
                .company-logo {
                    max-height: 60px;
                    max-width: 150px;
                    margin-bottom: 10px;
                }
                .company-name {
                    font-size: 22px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .company-tagline {
                    color: #6b7280;
                    font-size: 10px;
                    margin-bottom: 15px;
                }
                .statement-title {
                    text-align: right;
                    flex-shrink: 0;
                    margin-left: 20px;
                }
                .statement-title h1 {
                    font-size: 18px;
                    font-weight: bold;
                    color: #1f2937;
                    margin: 0 0 5px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .statement-subtitle {
                    color: #6b7280;
                    font-size: 10px;
                    text-align: right;
                }
                .copy-badge {
                    position: absolute;
                    top: -5px;
                    right: 0;
                    background: #2563eb;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 15px;
                    font-size: 9px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .account-details {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .account-details table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .account-details td {
                    padding: 6px 12px;
                    border: none;
                    vertical-align: top;
                }
                .account-details .label {
                    font-weight: 600;
                    color: #374151;
                    width: 140px;
                }
                .account-details .value {
                    color: #1f2937;
                    font-weight: 500;
                }
                .summary-section {
                    margin: 20px 0;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .summary-header {
                    background: #2563eb;
                    color: white;
                    padding: 10px 15px;
                    font-weight: bold;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .summary-body {
                    padding: 15px;
                    background: white;
                }
                .summary-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .summary-table td {
                    padding: 8px 15px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .summary-table .label {
                    font-weight: 500;
                    color: #374151;
                    text-align: left;
                }
                .summary-table .value {
                    text-align: right;
                    font-weight: 600;
                    color: #1f2937;
                }
                .transactions-section {
                    margin-top: 25px;
                }
                .transactions-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .transactions-table th {
                    background: #1f2937;
                    color: white;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid #374151;
                }
                .transactions-table td {
                    padding: 10px 8px;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 10px;
                    vertical-align: top;
                }
                .transactions-table tr:nth-child(even) {
                    background: #f8fafc;
                }
                .transactions-table tr:last-child td {
                    border-bottom: none;
                }
                .amount-positive {
                    color: #059669;
                    font-weight: 600;
                }
                .amount-negative {
                    color: #dc2626;
                    font-weight: 600;
                }
                .balance-cell {
                    background: #f1f5f9 !important;
                    font-weight: 700;
                    text-align: right;
                    border-left: 2px solid #e2e8f0;
                }
                .balance-positive {
                    color: #059669;
                }
                .balance-negative {
                    color: #dc2626;
                }
                .transaction-notes {
                    font-style: italic;
                    color: #2563eb;
                    font-size: 9px;
                    margin-top: 2px;
                }
                .page-footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 40px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    padding: 8px 15mm;
                    font-size: 8px;
                    color: #6b7280;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .page-footer .left {
                    text-align: left;
                }
                .page-footer .right {
                    text-align: right;
                }
                .disclaimer {
                    margin-top: 30px;
                    padding: 15px;
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                    border-radius: 6px;
                    font-size: 9px;
                    color: #92400e;
                    text-align: center;
                    margin-bottom: 60px;
                }
                @media print {
                    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .page-break { page-break-before: always; }
                    .page-footer { position: fixed; bottom: 0; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>`;

        // Generate copies
        for (let copy = 1; copy <= copies; copy++) {
            if (copy > 1) html += '<div class="page-break"></div>';
            
            html += `
            <div class="copy-indicator">Copy ${copy} of ${copies}</div>
            
            <div class="header">
                <div class="company-info">
                    <div>
                        <div class="company-name">HISAB</div>
                        <div style="color: #666; font-size: 14px;">Financial Management Platform</div>
                    </div>
                    <div class="statement-title">Bank Account Statement</div>
                </div>
            </div>

            <div class="account-info">
                <table>
                    <tr>
                        <td class="label">Account Name:</td>
                        <td><strong>${bankAccount.accountName}</strong></td>
                        <td class="label">Account Type:</td>
                        <td><strong>${bankAccount.accountType.toUpperCase()}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Statement Date:</td>
                        <td><strong>${statementDate}</strong></td>
                        <td class="label">Statement Period:</td>
                        <td><strong>${periodText}</strong></td>
                    </tr>
                </table>
            </div>

            <div class="summary-section">
                <table class="summary-table">
                    <tr>
                        <td class="label">Opening Balance:</td>
                        <td>₹${formatCurrency(summary.openingBalance)}</td>
                        <td class="label">Total Inflows:</td>
                        <td class="amount-positive">+₹${formatCurrency(summary.totalInflows)}</td>
                    </tr>
                    <tr>
                        <td class="label">Total Outflows:</td>
                        <td class="amount-negative">-₹${formatCurrency(summary.totalOutflows)}</td>
                        <td class="label">Closing Balance:</td>
                        <td class="${summary.currentBalance >= 0 ? 'amount-positive' : 'amount-negative'}">
                            ${summary.currentBalance >= 0 ? '' : '-'}₹${formatCurrency(Math.abs(summary.currentBalance))}
                        </td>
                    </tr>
                </table>
            </div>

            <table class="transactions-table">
                <thead>
                    <tr>
                        <th style="width: 12%;">Date</th>
                        <th style="width: 15%;">Reference</th>
                        <th style="width: 35%;">Description</th>
                        <th style="width: 12%;">Type</th>
                        <th style="width: 13%; text-align: right;">Amount</th>
                        <th style="width: 13%; text-align: right;">Balance</th>
                    </tr>
                </thead>
                <tbody>`;

            filteredTransactions.forEach(transaction => {
                const amount = parseFloat(transaction.amount) || 0;
                const runningBalance = parseFloat(transaction.runningBalance) || 0;
                
                html += `
                    <tr>
                        <td>${formatDate(transaction.date)}</td>
                        <td>${transaction.reference || 'N/A'}</td>
                        <td>
                            <strong>${transaction.description}</strong>
                            ${transaction.contact_name ? `<br><small style="color: #666;">${transaction.contact_name}</small>` : ''}
                            ${transaction.notes ? `<br><small style="color: #0066cc; font-style: italic;">"${transaction.notes}"</small>` : ''}
                        </td>
                        <td>${transaction.category}</td>
                        <td style="text-align: right;" class="${amount >= 0 ? 'amount-positive' : 'amount-negative'}">
                            ${amount >= 0 ? '+' : ''}₹${formatCurrency(Math.abs(amount))}
                        </td>
                        <td style="text-align: right;" class="balance-cell ${runningBalance >= 0 ? 'balance-positive' : 'balance-negative'}">
                            ${runningBalance < 0 ? '-' : ''}₹${formatCurrency(Math.abs(runningBalance))}
                        </td>
                    </tr>`;
            });

            html += `
                </tbody>
            </table>

            <div class="footer">
                <p><strong>Statement Summary:</strong> This statement contains ${filteredTransactions.length} transactions for the period ${periodText}.</p>
                <p><strong>Generated on:</strong> ${new Date().toLocaleString('en-IN')} | <strong>Copy:</strong> ${copy} of ${copies}</p>
                <p style="margin-top: 15px;"><em>This is a computer-generated statement and does not require a signature.</em></p>
            </div>`;
        }

        html += `
        </body>
        </html>`;

        return html;
    };

    // Calculate period summary
    const periodSummary = useMemo(() => {
        const netChange = summary.currentBalance - summary.openingBalance;
        const isPositive = netChange >= 0;
        
        return {
            netChange,
            isPositive,
            percentageChange: summary.openingBalance !== 0 ? 
                Math.abs((netChange / summary.openingBalance) * 100) : 0
        };
    }, [summary]);

    if (!bankAccount) return null;

    return (
        <Modal isOpen={show} toggle={onCloseClick} size="xl">
            <ModalHeader toggle={onCloseClick}>
                <div className="d-flex align-items-center">
                    <RiBankLine className="me-2 text-primary" size={24} />
                    <div>
                        <h4 className="modal-title mb-0">Bank Statement</h4>
                        <div className="d-flex align-items-center gap-2 mt-1">
                            <span className="text-muted">{bankAccount.accountName}</span>
                            <Badge color="primary" pill className="text-uppercase small">
                                {bankAccount.accountType}
                            </Badge>
                        </div>
                    </div>
                </div>
            </ModalHeader>

            <ModalBody className="pt-3">
                                {/* Simplified Summary */}
                <Row className="g-3 mb-4">
                    <Col md={4}>
                        <div className="text-center p-3 bg-light rounded">
                            <div className="text-muted small">Opening Balance</div>
                            <h5 className="mb-0">{formatCurrency(summary.openingBalance)}</h5>
                        </div>
                    </Col>
                    <Col md={4}>
                        <div className="text-center p-3 bg-light rounded">
                            <div className="text-muted small">Total Inflows</div>
                            <h5 className="mb-0 text-success">{formatCurrency(summary.totalInflows)}</h5>
                        </div>
                    </Col>
                    <Col md={4}>
                        <div className="text-center p-3 bg-light rounded">
                            <div className="text-muted small">Current Balance</div>
                            <h5 className={`mb-0 ${summary.currentBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                                {summary.currentBalance < 0 ? '-' : ''}
                                {formatCurrency(Math.abs(summary.currentBalance))}
                            </h5>
                        </div>
                    </Col>
                </Row>

                {/* Simplified Filters */}
                <div className="mb-3">
                    <Row className="g-2">
                        <Col md={5}>
                            <InputGroup>
                                <InputGroupText>
                                    <RiSearchLine size={14} />
                                </InputGroupText>
                                <Input
                                    type="text"
                                    placeholder="Search transactions..."
                                    value={filters.searchTerm}
                                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                />
                            </InputGroup>
                        </Col>
                        <Col md={3}>
                            <Input
                                type="select"
                                value={filters.transactionType}
                                onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                            >
                                {transactionTypes.map(type => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </Input>
                        </Col>
                        <Col md={2}>
                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                placeholder="Start Date"
                            />
                        </Col>
                        <Col md={2}>
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                placeholder="End Date"
                            />
                        </Col>
                    </Row>
                    <div className="mt-2">
                        <ButtonGroup size="sm">
                            <Button 
                                color="primary" 
                                onClick={handleFilterSubmit}
                                disabled={loading}
                            >
                                {loading ? <Spinner size="sm" /> : 'Apply Filters'}
                            </Button>
                            <Button 
                                color="light" 
                                onClick={() => {
                                    setFilters({
                                        startDate: '',
                                        endDate: '',
                                        transactionType: 'all',
                                        searchTerm: ''
                                    });
                                    fetchBankStatement(1);
                                }}
                            >
                                Clear
                            </Button>
                        </ButtonGroup>
                    </div>
                </div>

                {/* Clean Transaction Table */}
                <div className="table-responsive">
                    <Table className="table table-hover mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Type</th>
                                <th className="text-end">Amount</th>
                                <th className="text-end">Balance</th>
                            </tr>
                        </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-4">
                                                <Spinner size="sm" className="me-2" />
                                                Loading transactions...
                                            </td>
                                        </tr>
                                    ) : filteredTransactions.length > 0 ? (
                                        filteredTransactions.map((transaction, index) => {
                                            const amount = parseFloat(transaction.amount) || 0;
                                            const isInflow = amount > 0;
                                            const runningBalance = parseFloat(transaction.runningBalance) || 0;
                                            
                                            return (
                                                <tr key={`${transaction.id}-${index}`} className="border-bottom">
                                                    <td className="ps-3">
                                                        <div className="d-flex align-items-center">
                                                            {getTransactionIcon(transaction.transaction_type, transaction.category)}
                                                            <div className="ms-2">
                                                                <div className="fw-medium">{formatDate(transaction.date)}</div>
                                                                <div className="text-muted small">{transaction.reference}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div>
                                                            <div className="fw-medium mb-1">{transaction.description}</div>
                                                            {transaction.contact_name && (
                                                                <div className="text-muted small">
                                                                    {transaction.contact_name}
                                                                </div>
                                                            )}
                                                            {transaction.notes && (
                                                                <div className="text-info small mt-1">
                                                                    <em>"{transaction.notes}"</em>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge bg-${getTransactionColor(transaction.transaction_type)}`}>
                                                            {transaction.category}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <span className={`fw-medium ${amount >= 0 ? 'text-success' : 'text-danger'}`}>
                                                            {amount >= 0 ? '+' : ''}{formatCurrency(amount)}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className={`px-3 py-2 rounded-pill ${runningBalance >= 0 ? 'bg-success text-white' : 'bg-danger text-white'}`} style={{display: 'inline-block', minWidth: '120px', fontSize: '0.95rem'}}>
                                                            <span className="fw-bold">
                                                                {runningBalance < 0 ? '-' : ''}
                                                                {formatCurrency(Math.abs(runningBalance))}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center py-5">
                                                <div className="text-muted">
                                                    <RiFileTextLine size={48} className="mb-3 opacity-50" />
                                                    <p className="mb-0">No transactions found</p>
                                                    <small>Try adjusting your filters or date range</small>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="d-flex align-items-center justify-content-between mt-3">
                        <div className="text-muted small">
                            Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalTransactions)} of {totalTransactions} transactions
                        </div>
                        <Pagination size="sm" className="mb-0">
                            <PaginationItem disabled={currentPage <= 1}>
                                <PaginationLink 
                                    previous 
                                    onClick={() => handlePageChange(currentPage - 1)}
                                />
                            </PaginationItem>
                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                const pageNum = Math.max(1, currentPage - 2) + i;
                                if (pageNum <= totalPages) {
                                    return (
                                        <PaginationItem key={pageNum} active={pageNum === currentPage}>
                                            <PaginationLink onClick={() => handlePageChange(pageNum)}>
                                                {pageNum}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                }
                                return null;
                            })}
                            <PaginationItem disabled={currentPage >= totalPages}>
                                <PaginationLink 
                                    next 
                                    onClick={() => handlePageChange(currentPage + 1)}
                                />
                            </PaginationItem>
                        </Pagination>
                    </div>
                )}
            </ModalBody>

            <ModalFooter>
                <div className="d-flex justify-content-between w-100">
                    <div>
                        <small className="text-muted">
                            {totalTransactions} transactions
                        </small>
                    </div>
                    <div className="d-flex gap-2">
                        <UncontrolledDropdown>
                            <DropdownToggle 
                                color="primary"
                                size="sm"
                                caret 
                                disabled={isExporting || transactions.length === 0}
                            >
                                {isExporting ? (
                                    <>
                                        <Spinner size="sm" className="me-1" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <RiDownload2Line className="me-1" />
                                        Export PDF
                                    </>
                                )}
                            </DropdownToggle>
                            <DropdownMenu end className="shadow-lg border-0" style={{ minWidth: '200px' }}>
                                <DropdownItem header className="bg-light text-dark fw-bold py-2 px-3 border-bottom">
                                    📄 PDF Options
                                </DropdownItem>
                                
                                <DropdownItem 
                                    onClick={() => handleGeneratePDF()} 
                                    className="py-2 px-3 d-flex align-items-center"
                                >
                                    <div className="me-3">
                                        <i className="ri-star-fill text-warning" style={{ fontSize: '16px' }}></i>
                                    </div>
                                    <div>
                                        <div className="fw-semibold text-dark">Quick Download</div>
                                        <small className="text-muted">{defaultCopies} {defaultCopies === 1 ? 'copy' : 'copies'} • Your default</small>
                                    </div>
                                </DropdownItem>
                                
                                <DropdownItem divider className="my-1" />
                                
                                <DropdownItem 
                                    onClick={() => handleGeneratePDF(1)} 
                                    className="py-2 px-3 d-flex align-items-center"
                                >
                                    <div className="me-3">
                                        <i className="ri-file-text-line text-info" style={{ fontSize: '16px' }}></i>
                                    </div>
                                    <div>
                                        <div className="fw-semibold text-dark">1 Copy</div>
                                        <small className="text-muted">Single page • Large format</small>
                                    </div>
                                </DropdownItem>
                                
                                <DropdownItem 
                                    onClick={() => handleGeneratePDF(2)} 
                                    className="py-2 px-3 d-flex align-items-center"
                                >
                                    <div className="me-3">
                                        <i className="ri-file-copy-line text-success" style={{ fontSize: '16px' }}></i>
                                    </div>
                                    <div>
                                        <div className="fw-semibold text-dark">2 Copies</div>
                                        <small className="text-muted">Standard format • Most common</small>
                                    </div>
                                </DropdownItem>
                                
                                <DropdownItem 
                                    onClick={() => handleGeneratePDF(3)} 
                                    className="py-2 px-3 d-flex align-items-center"
                                >
                                    <div className="me-3">
                                        <i className="ri-file-list-line text-primary" style={{ fontSize: '16px' }}></i>
                                    </div>
                                    <div>
                                        <div className="fw-semibold text-dark">3 Copies</div>
                                        <small className="text-muted">Multiple copies • For records</small>
                                    </div>
                                </DropdownItem>
                            </DropdownMenu>
                        </UncontrolledDropdown>
                        
                        <Button color="secondary" onClick={onCloseClick}>
                            Close
                        </Button>
                    </div>
                </div>
            </ModalFooter>


        </Modal>
    );
};

export default BankStatementModal;

// Add CSS for better balance display
const styles = `
    .bg-success-subtle {
        background-color: rgba(25, 135, 84, 0.1) !important;
    }
    .bg-danger-subtle {
        background-color: rgba(220, 53, 69, 0.1) !important;
    }
    .table td {
        vertical-align: middle;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
} 
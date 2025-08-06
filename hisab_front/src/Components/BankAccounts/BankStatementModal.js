import React, { useState, useEffect } from 'react';
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
    Alert
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
    RiArrowDownLine
} from 'react-icons/ri';
import { getBankStatement, exportBankStatementPDF } from '../../services/bankAccount';

const BankStatementModal = ({ show, onCloseClick, bankAccount }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [summary, setSummary] = useState({
        openingBalance: 0,
        totalInflows: 0,
        totalOutflows: 0,
        currentBalance: 0
    });
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        transactionType: 'all'
    });

    const transactionTypes = [
        { value: 'all', label: 'All Transactions' },
        { value: 'payments', label: 'Payments' },
        { value: 'transfers', label: 'Bank Transfers' },
        { value: 'expenses', label: 'Expenses' },
        { value: 'incomes', label: 'Incomes' },
        { value: 'sales', label: 'Sales' },
        { value: 'purchases', label: 'Purchases' }
    ];

    const getTransactionIcon = (type) => {
        switch (type) {
            case 'payment':
                return <RiBankLine className="text-primary" />;
            case 'transfer':
                return <RiExchangeLine className="text-info" />;
            case 'expense':
                return <RiArrowDownLine className="text-danger" />;
            case 'income':
                return <RiArrowUpLine className="text-success" />;
            case 'sale':
                return <RiBankLine className="text-success" />;
            case 'purchase':
                return <RiBankLine className="text-warning" />;
            default:
                return <RiBankLine className="text-muted" />;
        }
    };

    const getTransactionColor = (type) => {
        switch (type) {
            case 'payment':
                return 'primary';
            case 'transfer':
                return 'info';
            case 'expense':
                return 'danger';
            case 'income':
                return 'success';
            case 'sale':
                return 'success';
            case 'purchase':
                return 'warning';
            default:
                return 'secondary';
        }
    };

    const formatAmount = (amount) => {
        const numAmount = parseFloat(amount);
        const formattedAmount = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(Math.abs(numAmount));
        
        // Add the sign back
        return numAmount < 0 ? `-${formattedAmount}` : formattedAmount;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

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
        }
    }, [show, bankAccount?.id]);

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

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const params = {
                transactionType: filters.transactionType,
                ...(filters.startDate && { startDate: filters.startDate }),
                ...(filters.endDate && { endDate: filters.endDate })
            };

            const blob = await exportBankStatementPDF(bankAccount.id, params);
            
            // Create a blob URL and trigger download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `bank_statement_${bankAccount.accountName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success('Bank statement PDF downloaded successfully');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            toast.error('Failed to export PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const renderTransactionRow = (transaction, index) => (
        <tr key={`${transaction.transaction_type}-${transaction.id}-${index}`}>
            <td>
                <div className="d-flex align-items-center">
                    <div className="flex-shrink-0 me-2">
                        {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div className="flex-grow-1">
                        <div className="fw-semibold">{transaction.reference}</div>
                        <small className="text-muted">{transaction.description}</small>
                    </div>
                </div>
            </td>
            <td>
                <Badge color={getTransactionColor(transaction.transaction_type)}>
                    {transaction.category}
                </Badge>
            </td>
            <td>
                <span className={`fw-semibold ${transaction.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatAmount(transaction.amount)}
                </span>
            </td>
            <td>
                <span className="fw-semibold">
                    {formatAmount(transaction.runningBalance)}
                </span>
            </td>
            <td>
                <div>
                    <div>{formatDate(transaction.date)}</div>
                    <small className="text-muted">
                        {transaction.contact_name || 'N/A'}
                    </small>
                </div>
            </td>
        </tr>
    );

    return (
        <Modal
            isOpen={show}
            toggle={onCloseClick}
            size="xl"
            className="bank-statement-modal"
        >
            <ModalHeader toggle={onCloseClick}>
                <div className="d-flex align-items-center">
                    <RiBankLine className="me-2" />
                    Bank Statement - {bankAccount?.accountName}
                </div>
            </ModalHeader>
            
            <ModalBody>
                {bankAccount && (
                    <Card className="mb-3">
                        <CardBody>
                            <Row>
                                <Col md={6}>
                                    <div className="mb-2">
                                        <small className="text-muted">Account Name</small>
                                        <div className="fw-semibold">{bankAccount.accountName}</div>
                                    </div>
                                    <div className="mb-2">
                                        <small className="text-muted">Account Type</small>
                                        <div className="fw-semibold">{bankAccount.accountType}</div>
                                    </div>
                                </Col>
                                <Col md={6}>
                                    <div className="mb-2">
                                        <small className="text-muted">Current Balance</small>
                                        <div className={`fw-semibold ${parseFloat(bankAccount.currentBalance) >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatAmount(bankAccount.currentBalance)}
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <small className="text-muted">Opening Balance</small>
                                        <div className="fw-semibold">{formatAmount(bankAccount.openingBalance)}</div>
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                )}

                {/* Filters */}
                <Card className="mb-3">
                    <CardBody>
                        <Row>
                            <Col md={3}>
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                />
                            </Col>
                            <Col md={3}>
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                />
                            </Col>
                            <Col md={3}>
                                <Label>Transaction Type</Label>
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
                            <Col md={3} className="d-flex align-items-end">
                                <Button color="primary" onClick={handleFilterSubmit} className="me-2">
                                    <RiFilter3Line className="me-1" />
                                    Filter
                                </Button>
                                <Button color="outline-secondary" onClick={handleExport} disabled={isExporting}>
                                    {isExporting ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <>
                                            <RiDownload2Line className="me-1" />
                                            Export
                                        </>
                                    )}
                                </Button>
                            </Col>
                        </Row>
                    </CardBody>
                </Card>

                {/* Transaction Summary */}
                <Card className="mb-3">
                    <CardBody>
                        <Row>
                            <Col md={3}>
                                <div className="text-center">
                                    <small className="text-muted d-block">Opening Balance</small>
                                    <div className="fw-semibold fs-5">{formatAmount(summary.openingBalance)}</div>
                                </div>
                            </Col>
                            <Col md={3}>
                                <div className="text-center">
                                    <small className="text-muted d-block">Total Inflows</small>
                                    <div className="fw-semibold fs-5 text-success">
                                        {formatAmount(summary.totalInflows)}
                                    </div>
                                </div>
                            </Col>
                            <Col md={3}>
                                <div className="text-center">
                                    <small className="text-muted d-block">Total Outflows</small>
                                    <div className="fw-semibold fs-5 text-danger">
                                        {formatAmount(summary.totalOutflows)}
                                    </div>
                                </div>
                            </Col>
                            <Col md={3}>
                                <div className="text-center">
                                    <small className="text-muted d-block">Current Balance</small>
                                    <div className={`fw-semibold fs-5 ${summary.currentBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatAmount(summary.currentBalance)}
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </CardBody>
                </Card>

                {/* Transactions Table */}
                <Card>
                    <CardBody>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0">Transaction History</h6>
                            <div className="d-flex align-items-center">
                                <small className="text-muted me-3">
                                    Total: {totalTransactions} transactions
                                </small>
                                <small className="text-muted">
                                    <i className="ri-information-line me-1"></i>
                                    Oldest transactions first
                                </small>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-4">
                                <Spinner color="primary" />
                                <div className="mt-2">Loading transactions...</div>
                            </div>
                        ) : transactions.length === 0 ? (
                            <Alert color="info" className="text-center">
                                No transactions found for the selected filters.
                            </Alert>
                        ) : (
                            <>
                                <div className="table-responsive">
                                    <Table className="table-nowrap mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Date</th>
                                                <th>Transaction Details</th>
                                                <th>Type</th>
                                                <th>Inflow</th>
                                                <th>Outflow</th>
                                                <th>Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactions.map((transaction, index) => (
                                                <tr key={`${transaction.transaction_type}-${transaction.id}-${index}`}>
                                                    <td>
                                                        <div className="fw-semibold">{formatDate(transaction.date)}</div>
                                                        <small className="text-muted">{transaction.reference}</small>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center">
                                                            <div className="flex-shrink-0 me-2">
                                                                {getTransactionIcon(transaction.transaction_type)}
                                                            </div>
                                                            <div className="flex-grow-1">
                                                                <div className="fw-semibold">{transaction.description}</div>
                                                                <small className="text-muted">
                                                                    {transaction.contact_name || 'N/A'}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <Badge color={getTransactionColor(transaction.transaction_type)}>
                                                            {transaction.category}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        {transaction.amount > 0 && (
                                                            <span className="fw-semibold text-success">
                                                                {formatAmount(transaction.amount)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {transaction.amount < 0 && (
                                                            <span className="fw-semibold text-danger">
                                                                {formatAmount(Math.abs(transaction.amount))}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`fw-semibold ${transaction.runningBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                                                            {formatAmount(transaction.runningBalance)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-center mt-3">
                                        <Pagination>
                                            <PaginationItem disabled={currentPage === 1}>
                                                <PaginationLink 
                                                    onClick={() => handlePageChange(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                >
                                                    Previous
                                                </PaginationLink>
                                            </PaginationItem>
                                            
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                const page = i + 1;
                                                return (
                                                    <PaginationItem key={page} active={page === currentPage}>
                                                        <PaginationLink onClick={() => handlePageChange(page)}>
                                                            {page}
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                            })}
                                            
                                            <PaginationItem disabled={currentPage === totalPages}>
                                                <PaginationLink 
                                                    onClick={() => handlePageChange(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                >
                                                    Next
                                                </PaginationLink>
                                            </PaginationItem>
                                        </Pagination>
                                    </div>
                                )}
                            </>
                        )}
                    </CardBody>
                </Card>
            </ModalBody>

            <ModalFooter>
                <Button color="secondary" onClick={onCloseClick}>
                    <RiCloseLine className="me-1" />
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default BankStatementModal; 
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
    Table,
    FormGroup,
    Label,
    Input,
    Alert,
    Spinner,
    UncontrolledDropdown,
    DropdownToggle,
    DropdownMenu,
    DropdownItem
} from 'reactstrap';
import { 
    RiDownloadLine, 
    RiMailLine, 
    RiFileTextLine, 
    RiFileExcelLine,
    RiFilterLine,
    RiCloseLine,
    RiFilePdfLine,
    RiArrowDownSLine
} from 'react-icons/ri';
import { toast } from 'react-toastify';
import { 
    getContactStatement, 
    downloadContactStatementPDF, 
    downloadContactStatementExcel,
    shareContactStatement 
} from '../../services/contactStatement';
import ShareModal from '../Common/ShareModal';

const ContactStatementModal = ({ isOpen, toggle, contact }) => {
    const [loading, setLoading] = useState(false);
    const [statement, setStatement] = useState(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        transactionType: 'all'
    });
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareFormat, setShareFormat] = useState('pdf');
    const [downloadLoading, setDownloadLoading] = useState({
        pdf: false,
        excel: false
    });
    const [shareLoading, setShareLoading] = useState(false);

    // Fetch statement data when modal opens or filters change
    useEffect(() => {
        if (isOpen && contact?.id) {
            fetchStatement();
        }
    }, [isOpen, contact?.id, filters]);

    const fetchStatement = async () => {
        setLoading(true);
        try {
            const response = await getContactStatement(contact.id, filters);
            // Statement data received successfully
            if (response.success) {
                // The API returns data directly in response, not nested under response.data
                const statementData = {
                    contact: response.contact,
                    transactions: response.transactions,
                    summary: response.summary,
                    filters: response.filters
                };
                // Setting statement data for display
                setStatement(statementData);
            } else {
                toast.error(response.message || 'Failed to fetch statement');
            }
        } catch (error) {
            toast.error('Error fetching statement');
            console.error('Error fetching statement:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleDownloadPDF = async () => {
        setDownloadLoading(prev => ({ ...prev, pdf: true }));
        try {
            const response = await downloadContactStatementPDF(contact.id, filters);
            if (response.success) {
                toast.success('PDF downloaded successfully');
            } else {
                toast.error(response.message || 'Failed to download PDF');
            }
        } catch (error) {
            toast.error('Error downloading PDF');
            console.error('Error downloading PDF:', error);
        } finally {
            setDownloadLoading(prev => ({ ...prev, pdf: false }));
        }
    };

    const handleDownloadExcel = async () => {
        setDownloadLoading(prev => ({ ...prev, excel: true }));
        try {
            const response = await downloadContactStatementExcel(contact.id, filters);
            if (response.success) {
                toast.success('Excel file downloaded successfully');
            } else {
                toast.error(response.message || 'Failed to download Excel');
            }
        } catch (error) {
            toast.error('Error downloading Excel');
            console.error('Error downloading Excel:', error);
        } finally {
            setDownloadLoading(prev => ({ ...prev, excel: false }));
        }
    };

    const handleShare = (format) => {
        setShareFormat(format);
        setShowShareModal(true);
    };

    const handleShareSubmit = async (shareData) => {
        setShareLoading(true);
        try {
            console.log('Share data received:', shareData);
            const response = await shareContactStatement(contact.id, {
                email: shareData.recipient, // Map recipient to email
                message: shareData.description || `Please find attached the contact statement for ${contact?.name}.`,
                subject: `Contact Statement - ${contact?.name}`,
                format: shareFormat,
                ...filters
            });
            
            if (response.success) {
                toast.success('Statement shared successfully');
                setShowShareModal(false);
            } else {
                toast.error(response.message || 'Failed to share statement');
            }
        } catch (error) {
            toast.error('Error sharing statement');
            console.error('Error sharing statement:', error);
        } finally {
            setShareLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN');
    };

    const getTransactionTypeColor = (type) => {
        const colors = {
            sale: 'success',
            purchase: 'primary',
            income: 'info',
            expense: 'warning',
            payment: 'secondary'
        };
        return colors[type] || 'secondary';
    };

    const getStatusColor = (status) => {
        const colors = {
            paid: 'success',
            pending: 'warning',
            overdue: 'danger'
        };
        return colors[status] || 'secondary';
    };

    return (
        <>
            <Modal 
                isOpen={isOpen} 
                toggle={toggle} 
                size="xl" 
                className="contact-statement-modal"
                centered
            >
                <ModalHeader toggle={toggle} className="border-bottom">
                    <h5 className="modal-title mb-0">
                        <RiFileTextLine className="me-2" />
                        Contact Statement - {contact?.name}
                    </h5>
                </ModalHeader>
                
                <ModalBody className="p-4">
                    {/* Contact Info - Simple Design */}
                    <div className="mb-4 p-3 bg-light rounded">
                        <Row>
                            <Col md={6}>
                                <h6 className="mb-2">{contact?.name}</h6>
                                <p className="mb-1 text-muted small">
                                    <strong>Type:</strong> {contact?.contactType?.toUpperCase()} | 
                                    <strong> Mobile:</strong> {contact?.mobile || 'N/A'}
                                </p>
                                <p className="mb-0 text-muted small">
                                    <strong>Email:</strong> {contact?.email || 'N/A'}
                                </p>
                            </Col>
                            <Col md={6} className="text-md-end">
                                <div className="mt-2 mt-md-0">
                                    <span className="badge bg-light text-dark border">
                                        Current Balance: {formatCurrency(statement?.summary?.currentBalance || 0)}
                                    </span>
                                </div>
                            </Col>
                        </Row>
                    </div>

                    {/* Filters - Clean Layout */}
                    <Card className="mb-4">
                        <CardBody className="py-3">
                            <Row className="g-3 align-items-end">
                                <Col md={3} sm={6}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small">Start Date</Label>
                                        <Input
                                            type="date"
                                            size="sm"
                                            value={filters.startDate}
                                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                        />
                                    </FormGroup>
                                </Col>
                                <Col md={3} sm={6}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small">End Date</Label>
                                        <Input
                                            type="date"
                                            size="sm"
                                            value={filters.endDate}
                                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                        />
                                    </FormGroup>
                                </Col>
                                <Col md={4} sm={8}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small">Transaction Type</Label>
                                        <Input
                                            type="select"
                                            size="sm"
                                            value={filters.transactionType}
                                            onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                                        >
                                            <option value="all">All Business Transactions</option>
                                            <option value="sales">Sales Invoices</option>
                                            <option value="purchases">Purchase Invoices</option>
                                            <option value="income">Income Transactions</option>
                                            <option value="expense">Expense Transactions</option>
                                        </Input>
                                    </FormGroup>
                                </Col>
                                <Col md={2} sm={4}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small text-white">.</Label>
                                        <Input
                                            type="button"
                                            size="sm"
                                            value={loading ? "Loading..." : "Apply"}
                                            onClick={fetchStatement}
                                            disabled={loading}
                                            className="btn btn-outline-primary btn-sm w-100"
                                        />
                                    </FormGroup>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>

                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner color="primary" />
                            <p className="mt-2 text-muted">Loading statement...</p>
                        </div>
                    ) : statement ? (
                        <>
                            {/* Business Summary Cards - Professional & Clear */}
                            <Row className="mb-4">
                                <Col lg={3} md={6} className="mb-3 mb-lg-0">
                                    <div className="border rounded p-3 text-center bg-light">
                                        <h6 className="text-muted mb-1">Total Debit</h6>
                                        <h5 className="mb-0 text-success">{formatCurrency(statement.summary?.totalDebit)}</h5>
                                    </div>
                                </Col>
                                <Col lg={3} md={6} className="mb-3 mb-lg-0">
                                    <div className="border rounded p-3 text-center bg-light">
                                        <h6 className="text-muted mb-1">Total Credit</h6>
                                        <h5 className="mb-0 text-danger">{formatCurrency(statement.summary?.totalCredit)}</h5>
                                    </div>
                                </Col>
                                <Col lg={3} md={6} className="mb-3 mb-lg-0">
                                    <div className="border rounded p-3 text-center bg-light">
                                        <h6 className="text-muted mb-1">Total Paid</h6>
                                        <h5 className="mb-0 text-info">{formatCurrency(statement.summary?.totalPaidAmount)}</h5>
                                    </div>
                                </Col>
                                <Col lg={3} md={6}>
                                    <div className="border rounded p-3 text-center bg-warning bg-opacity-10">
                                        <h6 className="text-muted mb-1">Total Pending</h6>
                                        <h5 className="mb-0 text-warning fw-bold">{formatCurrency(statement.summary?.totalPendingAmount)}</h5>
                                    </div>
                                </Col>
                            </Row>

                            {/* Running Balance & Business Insights */}
                            <Row className="mb-4">
                                <Col md={4}>
                                    <div className="border rounded p-2 text-center bg-primary bg-opacity-10">
                                        <small className="text-muted">Running Balance</small>
                                        <div className={`fw-bold ${statement.summary?.runningBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatCurrency(statement.summary?.runningBalance)}
                                        </div>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="border rounded p-2 text-center">
                                        <small className="text-muted">Sales & Income</small>
                                        <div className="fw-bold text-success">{formatCurrency(statement.summary?.totalSales)}</div>
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <div className="border rounded p-2 text-center">
                                        <small className="text-muted">Purchases & Expenses</small>
                                        <div className="fw-bold text-danger">{formatCurrency(statement.summary?.totalPurchases)}</div>
                                    </div>
                                </Col>
                            </Row>

                            {/* Transactions Table - Clean Design */}
                            <Card>
                                <CardBody className="p-0">
                                    <div className="border-bottom px-3 py-2 bg-light">
                                        <h6 className="mb-0">
                                            Transaction History ({statement.transactions?.length || 0} records)
                                        </h6>
                                    </div>
                                    
                                    {statement.transactions && statement.transactions.length > 0 ? (
                                        <div className="table-responsive">
                                            <Table className="table-sm mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th className="border-0">Date</th>
                                                        <th className="border-0">Reference</th>
                                                        <th className="border-0 d-none d-md-table-cell">Description</th>
                                                        <th className="border-0">Type</th>
                                                        <th className="border-0 text-end">Debit</th>
                                                        <th className="border-0 text-end">Credit</th>
                                                        <th className="border-0 text-end">Paid</th>
                                                        <th className="border-0 text-end">Pending</th>
                                                        <th className="border-0 text-center d-none d-sm-table-cell">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {statement.transactions.map((transaction, index) => (
                                                        <tr key={index}>
                                                            <td className="border-0">
                                                                <small>{formatDate(transaction.transaction_date)}</small>
                                                            </td>
                                                            <td className="border-0">
                                                                <div className="text-primary fw-medium">
                                                                    {transaction.reference_number}
                                                                </div>
                                                                <div className="d-md-none">
                                                                    <small className="text-muted">
                                                                        {transaction.description}
                                                                    </small>
                                                                </div>
                                                            </td>
                                                            <td className="border-0 d-none d-md-table-cell">
                                                                <small className="text-truncate d-block" style={{ maxWidth: '200px' }}>
                                                                    {transaction.description}
                                                                </small>
                                                            </td>
                                                            <td className="border-0">
                                                                <Badge 
                                                                    color="light" 
                                                                    className="text-dark border"
                                                                >
                                                                    {transaction.transaction_type?.toUpperCase()}
                                                                </Badge>
                                                            </td>
                                                            <td className="border-0 text-end">
                                                                <small className={transaction.debit_amount > 0 ? 'text-success fw-medium' : 'text-muted'}>
                                                                    {transaction.debit_amount > 0 ? formatCurrency(transaction.debit_amount) : '—'}
                                                                </small>
                                                            </td>
                                                            <td className="border-0 text-end">
                                                                <small className={transaction.credit_amount > 0 ? 'text-danger fw-medium' : 'text-muted'}>
                                                                    {transaction.credit_amount > 0 ? formatCurrency(transaction.credit_amount) : '—'}
                                                                </small>
                                                            </td>
                                                            <td className="border-0 text-end">
                                                                <small className={transaction.paid_amount > 0 ? 'text-info fw-medium' : 'text-muted'}>
                                                                    {transaction.paid_amount > 0 ? formatCurrency(transaction.paid_amount) : '—'}
                                                                </small>
                                                            </td>
                                                            <td className="border-0 text-end">
                                                                <small className={transaction.remaining_amount > 0 ? 'text-warning fw-bold' : 'text-muted'}>
                                                                    {transaction.remaining_amount > 0 ? formatCurrency(transaction.remaining_amount) : '—'}
                                                                </small>
                                                            </td>
                                                            <td className="border-0 text-center d-none d-sm-table-cell">
                                                                <Badge 
                                                                    color={getStatusColor(transaction.status)}
                                                                    className="badge-soft"
                                                                >
                                                                    {transaction.status?.toUpperCase()}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-5">
                                            <RiFileTextLine size={48} className="text-muted mb-3" />
                                            <h6 className="text-muted">No transactions found</h6>
                                            <p className="text-muted small mb-0">
                                                Try adjusting your filter criteria
                                            </p>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </>
                    ) : (
                        <div className="text-center py-5">
                            <RiFileTextLine size={64} className="text-muted mb-3" />
                            <h5 className="text-muted mb-2">Ready to Load Statement</h5>
                            <p className="text-muted mb-3">
                                Click "Apply" to load the statement with your selected filters
                            </p>
                            <Button color="primary" onClick={fetchStatement} disabled={loading}>
                                <RiFilterLine className="me-1" /> Load Statement
                            </Button>
                        </div>
                    )}
                </ModalBody>
                
                <ModalFooter className="border-top">
                    <div className="d-flex justify-content-between w-100 flex-wrap gap-2">
                        {/* Left side - Close button */}
                        <Button color="light" onClick={toggle}>
                            <RiCloseLine className="me-1" /> Close
                        </Button>
                        
                        {/* Right side - Action buttons */}
                        <div className="d-flex gap-2 flex-wrap">
                            {/* Download Dropdown */}
                            <UncontrolledDropdown>
                                <DropdownToggle 
                                    color="success" 
                                    size="sm"
                                    caret
                                    disabled={!statement || downloadLoading.pdf || downloadLoading.excel}
                                >
                                    <RiDownloadLine className="me-1" /> Download
                                </DropdownToggle>
                                <DropdownMenu>
                                    <DropdownItem onClick={handleDownloadPDF} disabled={downloadLoading.pdf}>
                                        <RiFilePdfLine className="me-2" />
                                        PDF Format
                                        {downloadLoading.pdf && <Spinner size="sm" className="ms-2" />}
                                    </DropdownItem>
                                    <DropdownItem onClick={handleDownloadExcel} disabled={downloadLoading.excel}>
                                        <RiFileExcelLine className="me-2" />
                                        CSV Format
                                        {downloadLoading.excel && <Spinner size="sm" className="ms-2" />}
                                    </DropdownItem>
                                </DropdownMenu>
                            </UncontrolledDropdown>

                            {/* Share Dropdown */}
                            <UncontrolledDropdown>
                                <DropdownToggle 
                                    color="primary" 
                                    size="sm"
                                    caret
                                    disabled={!statement || shareLoading}
                                >
                                    <RiMailLine className="me-1" /> Share
                                </DropdownToggle>
                                <DropdownMenu>
                                    <DropdownItem onClick={() => handleShare('pdf')} disabled={shareLoading}>
                                        <RiFilePdfLine className="me-2" />
                                        Email as PDF
                                        {shareLoading && <Spinner size="sm" className="ms-2" />}
                                    </DropdownItem>
                                    <DropdownItem onClick={() => handleShare('excel')} disabled={shareLoading}>
                                        <RiFileExcelLine className="me-2" />
                                        Email as CSV
                                        {shareLoading && <Spinner size="sm" className="ms-2" />}
                                    </DropdownItem>
                                </DropdownMenu>
                            </UncontrolledDropdown>
                        </div>
                    </div>
                </ModalFooter>
            </Modal>

            {/* Share Modal */}
            <ShareModal
                isOpen={showShareModal}
                toggle={() => setShowShareModal(false)}
                invoiceType="contact-statement"
                invoiceData={{
                    id: contact?.id,
                    name: contact?.name,
                    invoiceNumber: `Contact Statement - ${contact?.name}`,
                    format: shareFormat
                }}
                onShare={handleShareSubmit}
                isLoading={shareLoading}
            />
        </>
    );
};

export default ContactStatementModal; 
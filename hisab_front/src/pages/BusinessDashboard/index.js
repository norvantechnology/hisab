import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Input, FormGroup, Label, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem, Progress } from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import { RiRefreshLine, RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine, RiAddLine, RiArrowRightLine, RiArrowUpLine, RiArrowDownLine, RiCalendarLine, RiUserLine, RiShoppingCartLine, RiCashLine, RiWallet3Line, RiFilterLine, RiDownload2Line, RiSortAsc, RiCheckLine, RiTimeLine, RiAlertLine, RiFileTextLine, RiSendPlaneLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import Loader from '../../Components/Common/Loader';
import PaymentForm from '../../Components/Payments/PaymentForm';
import { 
    getBusinessAnalytics, 
    getQuickStats, 
    exportDashboardData 
} from '../../services/dashboard';
import { getContacts } from '../../services/contacts';
import { listProducts } from '../../services/products';
import { getBankAccounts } from '../../services/bankAccount';
import { createPayment } from '../../services/payment';
import useCompanySelectionState from '../../hooks/useCompanySelection';
import DashboardFilters from './DashboardFilters';

const BusinessDashboard = () => {
    const { selectedCompanyId } = useCompanySelectionState();
    const navigate = useNavigate();
    const [state, setState] = useState({
        analytics: null,
        quickStats: null,
        loading: true,
        refreshing: false,
        filters: {},
        modals: {
            quickEdit: false,
            productDetails: false,
            customerDetails: false,
            filters: false,
            paymentForm: false
        },
        selectedItem: null,
        selectedType: null,
        sortConfig: { key: null, direction: 'asc' },
        contacts: [],
        products: [],
        bankAccounts: [],
        // Payment form related state
        selectedOutstandingPayment: null,
        paymentFormLoading: false
    });

    const { analytics, quickStats, loading, refreshing, filters, modals, selectedItem, selectedType, sortConfig, contacts, products, bankAccounts, selectedOutstandingPayment, paymentFormLoading } = state;

    const fetchDashboardData = async (showRefreshing = false, customFilters = null) => {
        if (!selectedCompanyId) {
            return;
        }

        const filtersToUse = customFilters || filters;

        setState(prev => ({ 
            ...prev, 
            loading: !showRefreshing,
            refreshing: showRefreshing 
        }));

        try {
            const [
                analyticsResponse,
                quickStatsResponse
            ] = await Promise.all([
                getBusinessAnalytics(filtersToUse),
                getQuickStats()
            ]);

            setState(prev => ({
                ...prev,
                analytics: analyticsResponse.success ? analyticsResponse.analytics : null,
                quickStats: quickStatsResponse.success ? quickStatsResponse.stats : null,
                loading: false,
                refreshing: false
            }));

        } catch (error) {
            console.error('❌ Error fetching dashboard data:', error);
            toast.error(`Failed to load dashboard data: ${error.message || 'Unknown error'}`);
            setState(prev => ({ ...prev, loading: false, refreshing: false }));
        }
    };

    // Fetch bank accounts and contacts for payment form
    const fetchPaymentFormData = async () => {
        try {
            const [bankAccountsRes, contactsRes] = await Promise.all([
                getBankAccounts().catch(() => ({ success: false, accounts: [] })),
                getContacts().catch(() => ({ success: false, contacts: [] }))
            ]);

            setState(prev => ({
                ...prev,
                bankAccounts: bankAccountsRes?.success ? bankAccountsRes.accounts || [] : [],
                contacts: contactsRes?.success ? contactsRes.contacts || [] : prev.contacts
            }));
        } catch (error) {
            console.error('❌ Error fetching payment form data:', error);
        }
    };

    const handleRefresh = () => {
        fetchDashboardData(true);
    };

    const handleFiltersChange = (newFilters) => {
        setState(prev => ({ ...prev, filters: newFilters }));
        fetchDashboardData(false, newFilters);
    };

    // Modal handlers
    const toggleModal = (modalName, value) => {
        setState(prev => ({
            ...prev,
            modals: { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] }
        }));
    };

    const handleDetailsView = (item, type) => {
        setState(prev => ({
            ...prev,
            selectedItem: item,
            selectedType: type
        }));
        
        switch(type) {
            case 'product':
                toggleModal('productDetails', true);
                break;
            case 'customer':
                toggleModal('customerDetails', true);
                break;
            case 'payment':
                // Instead of opening the simple details modal, open the PaymentForm
                handleOutstandingPaymentClick(item);
                break;
            default:
                break;
        }
    };

    // New handler for outstanding payment clicks
    const handleOutstandingPaymentClick = async (payment) => {
        console.log('🔍 Outstanding payment clicked:', payment);
        
        // Set the selected payment
        setState(prev => ({
            ...prev,
            selectedOutstandingPayment: payment,
            paymentFormLoading: true
        }));

        // Fetch bank accounts and contacts if not already loaded
        if (bankAccounts.length === 0 || contacts.length === 0) {
            await fetchPaymentFormData();
        }

        // Convert the outstanding payment to a format similar to selectedInvoice
        const mockInvoice = {
            id: payment.id,
            invoiceNumber: payment.reference,
            contactId: payment.contact_id,
            contact: {
                id: payment.contact_id,
                name: payment.contact_name
            },
            remainingAmount: payment.amount,
            amount: payment.amount
        };

        setState(prev => ({
            ...prev,
            selectedOutstandingPayment: mockInvoice,
            paymentFormLoading: false,
            modals: { ...prev.modals, paymentForm: true }
        }));
    };

    // Handler for payment form submission
    const handlePaymentSubmit = async (payloadFromForm) => {
        try {
            setState(prev => ({ ...prev, paymentFormLoading: true }));
            
            console.log('🚀 Creating payment from dashboard:', payloadFromForm);

            const response = await createPayment(payloadFromForm);

            if (response.success) {
                toast.success('Payment created successfully');
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, paymentForm: false },
                    paymentFormLoading: false,
                    selectedOutstandingPayment: null
                }));
                
                // Refresh dashboard data to update outstanding payments
                fetchDashboardData(true);
            }
        } catch (error) {
            setState(prev => ({ ...prev, paymentFormLoading: false }));
            toast.error(error.message || 'Failed to create payment');
        }
    };

    // Navigation handlers
    const navigateToSection = (section) => {
        switch(section) {
            case 'sales':
                navigate('/sales/invoices');
                break;
            case 'purchases':
                navigate('/purchases/invoices');
                break;
            case 'products':
                navigate('/products');
                break;
            case 'contacts':
                navigate('/contacts');
                break;
            case 'expenses':
                navigate('/expenses');
                break;
            case 'income':
                navigate('/income');
                break;
            case 'payments':
                navigate('/payments');
                break;
            case 'bank-accounts':
                navigate('/bank-accounts');
                break;
            default:
                break;
        }
    };

    const handleQuickAdd = async (type) => {
        // For sales and purchases, navigate directly to the appropriate forms with add parameter
        if (type === 'sale') {
            navigate('/sales/invoices?add=true');
            return;
        }
        
        if (type === 'purchase') {
            navigate('/purchases/invoices?add=true');
            return;
        }

        if (type === 'product') {
            navigate('/products?add=true');
            return;
        }

        if (type === 'contact') {
            navigate('/contacts?add=true');
            return;
        }

        // No modal needed - all types now navigate to their respective pages
    };

    const handleSort = (key) => {
        setState(prev => ({
            ...prev,
            sortConfig: {
                key,
                direction: prev.sortConfig.key === key && prev.sortConfig.direction === 'asc' ? 'desc' : 'asc'
            }
        }));
    };

    const getStatusBadge = (status, daysOverdue = 0) => {
        if (status === 'paid' || daysOverdue <= 0) {
            return <Badge color="success" className="badge-soft-success">Paid</Badge>;
        } else if (daysOverdue <= 7) {
            return <Badge color="warning" className="badge-soft-warning">Pending</Badge>;
        } else {
            return <Badge color="danger" className="badge-soft-danger">Overdue</Badge>;
        }
    };

    const getBalanceTypeBadge = (paymentType) => {
        // Determine balance type based on transaction type
        let balanceType, color;
        
        switch (paymentType) {
            case 'sales':
            case 'sale':
            case 'income':
                balanceType = 'receivable';
                color = 'success';
                break;
            case 'purchases':
            case 'purchase':
            case 'expense':
                balanceType = 'payable';
                color = 'warning';
                break;
            default:
                balanceType = 'payable'; // Default to payable for unknown types
                color = 'warning';
                break;
        }

        return (
            <Badge color={color} className={`badge-soft-${color}`}>
                {balanceType === 'payable' ? 'Payable' : 'Receivable'}
            </Badge>
        );
    };

    useEffect(() => {
        if (selectedCompanyId) {
            fetchDashboardData();
        }
    }, [selectedCompanyId]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-IN').format(num || 0);
    };

    const calculatePercentage = (part, total) => {
        if (!total || total === 0) return 0;
        return Math.round((part / total) * 100);
    };

    const handleExport = async () => {
        try {
            setState(prev => ({ ...prev, refreshing: true }));
            const response = await exportDashboardData('csv', filters);
            
            if (response.success) {
                // Create and download CSV file
                const csvContent = convertToCSV(response.data);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Dashboard data exported successfully!');
            } else {
                toast.error(response.message || 'Failed to export data');
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            toast.error('Failed to export data');
        } finally {
            setState(prev => ({ ...prev, refreshing: false }));
        }
    };

    const convertToCSV = (data) => {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row => 
            headers.map(header => {
                const value = row[header];
                // Escape commas and quotes in CSV
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        );
        
        return [csvHeaders, ...csvRows].join('\n');
    };

    if (loading) {
        return (
            <div className="page-content">
                <Container fluid>
                    <Loader />
                </Container>
            </div>
        );
    }

    if (!selectedCompanyId) {
        return (
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Business Dashboard" pageTitle="Dashboard" />
                    <Card className="shadow-sm">
                        <CardBody className="text-center py-5">
                            <h5 className="text-muted">Please select a company to view analytics</h5>
                        </CardBody>
                    </Card>
                </Container>
            </div>
        );
    }

    if (!analytics || !quickStats) {
        return (
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Business Dashboard" pageTitle="Dashboard" />
                    <Card className="shadow-sm">
                        <CardBody className="text-center py-5">
                            <i className="ri-database-2-line text-muted mb-3" style={{ fontSize: '3rem' }}></i>
                            <h5 className="text-muted">No data available</h5>
                            <p className="text-muted mb-3">Start recording transactions to see business analytics</p>
                            <Button color="primary" onClick={handleRefresh}>
                                <RiRefreshLine className="me-1" /> Load Data
                            </Button>
                        </CardBody>
                    </Card>
                </Container>
            </div>
        );
    }

    return (
        <div className="page-content">
            <ToastContainer closeButton={false} position="top-right" />
            <Container fluid>
                <BreadCrumb title="Business Dashboard" pageTitle="Dashboard" />

                {/* Header Actions - Match Contacts Page Style */}
                <Row className="mb-3">
                    <Col sm={12} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <Button color="light" outline onClick={() => toggleModal('filters', true)}>
                                <RiFilterLine className="align-middle me-1" /> Filters
                            </Button>
                            <Button color="primary" onClick={handleExport}>
                                <RiDownload2Line className="align-middle me-1" /> Export
                            </Button>
                            <UncontrolledDropdown>
                                <DropdownToggle color="success">
                                    <RiAddLine className="align-middle me-1" /> Add New
                                </DropdownToggle>
                                <DropdownMenu className="dropdown-menu-end">
                                    <DropdownItem onClick={() => handleQuickAdd('sale')}>
                                        <RiArrowUpLine className="me-2 text-success" />
                                        New Sale
                                    </DropdownItem>
                                    <DropdownItem onClick={() => handleQuickAdd('purchase')}>
                                        <RiArrowDownLine className="me-2 text-primary" />
                                        New Purchase
                                    </DropdownItem>
                                    <DropdownItem onClick={() => handleQuickAdd('product')}>
                                        <RiShoppingCartLine className="me-2 text-info" />
                                        Add Product
                                    </DropdownItem>
                                    <DropdownItem onClick={() => handleQuickAdd('contact')}>
                                        <RiUserLine className="me-2 text-secondary" />
                                        Add Contact
                                    </DropdownItem>
                                </DropdownMenu>
                            </UncontrolledDropdown>
                            <Button color="light" onClick={handleRefresh} disabled={refreshing}>
                                <RiRefreshLine className={`align-middle me-1 ${refreshing ? 'spin' : ''}`} />
                                {refreshing ? 'Loading...' : 'Refresh'}
                            </Button>
                        </div>
                    </Col>
                </Row>

                {/* Financial Summary Cards - Clean Flat Design */}
                <Row className="mb-4">
                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="shadow-sm h-100 metric-card" onClick={() => navigateToSection('sales')}>
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-success-subtle d-flex align-items-center justify-content-center">
                                            <RiArrowUpLine className="text-success fs-22" />
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_sales)}</h4>
                                        <h6 className="text-muted mb-1 fs-13">Total Sales</h6>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_sales_count)} invoices</p>
                                        {analytics.financialSummary.total_sales > 0 && (
                                            <div className="mt-2">
                                                <div className="d-flex justify-content-between mb-1">
                                                    <small className="text-muted">Paid</small>
                                                    <small className="text-success fw-medium">
                                                        {calculatePercentage(analytics.financialSummary.sales_received, analytics.financialSummary.total_sales)}%
                                                    </small>
                                                </div>
                                                <Progress 
                                                    value={calculatePercentage(analytics.financialSummary.sales_received, analytics.financialSummary.total_sales)} 
                                                    color="success" 
                                                    className="progress-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="shadow-sm h-100 metric-card" onClick={() => navigateToSection('purchases')}>
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center">
                                            <RiWallet3Line className="text-primary fs-22" />
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_purchases)}</h4>
                                        <h6 className="text-muted mb-1 fs-13">Total Purchases</h6>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_purchase_count)} invoices</p>
                                        {analytics.financialSummary.total_purchases > 0 && (
                                            <div className="mt-2">
                                                <div className="d-flex justify-content-between mb-1">
                                                    <small className="text-muted">Paid</small>
                                                    <small className="text-primary fw-medium">
                                                        {calculatePercentage(analytics.financialSummary.purchases_paid, analytics.financialSummary.total_purchases)}%
                                                    </small>
                                                </div>
                                                <Progress 
                                                    value={calculatePercentage(analytics.financialSummary.purchases_paid, analytics.financialSummary.total_purchases)} 
                                                    color="primary" 
                                                    className="progress-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="shadow-sm h-100 metric-card" onClick={() => navigateToSection('expenses')}>
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-warning-subtle d-flex align-items-center justify-content-center">
                                            <RiArrowDownLine className="text-warning fs-22" />
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_expenses)}</h4>
                                        <h6 className="text-muted mb-1 fs-13">Total Expenses</h6>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_expense_count)} entries</p>
                                        {analytics.financialSummary.total_expenses > 0 && (
                                            <div className="mt-2">
                                                <div className="d-flex justify-content-between mb-1">
                                                    <small className="text-muted">Paid</small>
                                                    <small className="text-warning fw-medium">
                                                        {calculatePercentage(analytics.financialSummary.expenses_paid, analytics.financialSummary.total_expenses)}%
                                                    </small>
                                                </div>
                                                <Progress 
                                                    value={calculatePercentage(analytics.financialSummary.expenses_paid, analytics.financialSummary.total_expenses)} 
                                                    color="warning" 
                                                    className="progress-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="shadow-sm h-100 metric-card" onClick={() => navigateToSection('income')}>
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-info-subtle d-flex align-items-center justify-content-center">
                                            <RiArrowUpLine className="text-info fs-22" />
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        {analytics.financialSummary.total_incomes > 0 ? (
                                            <>
                                                <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_incomes)}</h4>
                                                <h6 className="text-muted mb-1 fs-13">Total Income</h6>
                                                <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_income_count)} entries</p>
                                                <div className="mt-2">
                                                    <div className="d-flex justify-content-between mb-1">
                                                        <small className="text-muted">Received</small>
                                                        <small className="text-info fw-medium">
                                                            {calculatePercentage(analytics.financialSummary.incomes_received, analytics.financialSummary.total_incomes)}%
                                                        </small>
                                                    </div>
                                                    <Progress 
                                                        value={calculatePercentage(analytics.financialSummary.incomes_received, analytics.financialSummary.total_incomes)} 
                                                        color="info" 
                                                        className="progress-sm"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h4 className="mb-1 fw-bold text-muted">₹0</h4>
                                                <h6 className="text-muted mb-1 fs-13">Total Income</h6>
                                                <p className="text-muted mb-0 fs-11">No income recorded</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="shadow-sm h-100 metric-card" onClick={() => navigateToSection('bank-accounts')}>
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center">
                                            <RiCashLine className="text-secondary fs-22" />
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h4 className="mb-1 fw-bold">{formatCurrency(quickStats.total_balance)}</h4>
                                        <h6 className="text-muted mb-1 fs-13">Bank Balance</h6>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(quickStats.active_bank_accounts)} accounts</p>
                                        <div className="mt-1">
                                            <small className={`fw-medium ${analytics.financialSummary.net_cash_flow >= 0 ? 'text-success' : 'text-danger'}`}>
                                                Net Flow: {formatCurrency(analytics.financialSummary.net_cash_flow)}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="shadow-sm h-100">
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className={`avatar-sm rounded-circle d-flex align-items-center justify-content-center ${analytics.financialSummary.gross_profit >= 0 ? 'bg-success-subtle' : 'bg-danger-subtle'}`}>
                                            <RiArrowUpLine className={analytics.financialSummary.gross_profit >= 0 ? 'text-success' : 'text-danger'} size={22} />
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h4 className={`mb-1 fw-bold ${analytics.financialSummary.gross_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatCurrency(analytics.financialSummary.gross_profit)}
                                        </h4>
                                        <h6 className="text-muted mb-1 fs-13">Gross Profit</h6>
                                        <p className="text-muted mb-0 fs-11">Revenue - Costs</p>
                                        <div className="mt-1">
                                            <Badge 
                                                color={analytics.financialSummary.gross_profit >= 0 ? 'success' : 'danger'} 
                                                className="badge-soft"
                                            >
                                                {analytics.financialSummary.gross_profit >= 0 ? 'Profitable' : 'Loss'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>

                {/* Business Overview - Clean 3-column Layout */}
                <Row className="mb-4">
                    <Col xl={4} md={4} className="mb-3">
                        <Card className="shadow-sm h-100 clickable-card" onClick={() => navigateToSection('products')}>
                            <CardBody className="text-center">
                                <div className="avatar-md rounded-circle bg-primary-subtle mx-auto mb-3 d-flex align-items-center justify-content-center">
                                    <RiShoppingCartLine className="text-primary fs-24" />
                                </div>
                                <h3 className="mb-1 fw-bold">{formatNumber(quickStats.total_products)}</h3>
                                <h6 className="text-muted mb-0">Products</h6>
                                <p className="text-muted mb-0 fs-12">Click to manage</p>
                            </CardBody>
                        </Card>
                    </Col>
                    
                    <Col xl={4} md={4} className="mb-3">
                        <Card className="shadow-sm h-100 clickable-card" onClick={() => navigateToSection('contacts')}>
                            <CardBody className="text-center">
                                <div className="avatar-md rounded-circle bg-info-subtle mx-auto mb-3 d-flex align-items-center justify-content-center">
                                    <RiUserLine className="text-info fs-24" />
                                </div>
                                <h3 className="mb-1 fw-bold">{formatNumber(quickStats.total_contacts)}</h3>
                                <h6 className="text-muted mb-0">Contacts</h6>
                                <p className="text-muted mb-0 fs-12">Customers & vendors</p>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={4} md={4} className="mb-3">
                        <Card className="shadow-sm h-100">
                            <CardBody className="text-center">
                                <div className="avatar-md rounded-circle bg-success-subtle mx-auto mb-3 d-flex align-items-center justify-content-center">
                                    <RiCalendarLine className="text-success fs-24" />
                                </div>
                                {quickStats.today_sales > 0 ? (
                                    <>
                                        <h3 className="mb-1 fw-bold text-success">{formatCurrency(quickStats.today_sales)}</h3>
                                        <h6 className="text-muted mb-0">Today's Sales</h6>
                                        <p className="text-muted mb-0 fs-12">Great performance!</p>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="mb-1 fw-bold text-muted">No sales today</h3>
                                        <h6 className="text-muted mb-0">Today's Sales</h6>
                                        <p className="text-muted mb-0 fs-12">Start your first sale</p>
                                    </>
                                )}
                            </CardBody>
                        </Card>
                    </Col>
                </Row>

                {/* Top Products and Customers - Match Contacts Table Style */}
                {(analytics.topProducts?.length > 0 || analytics.topCustomers?.length > 0) && (
                    <Row className="mb-4">
                        {analytics.topProducts?.length > 0 && (
                            <Col xl={6} className="mb-4">
                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <h5 className="card-title mb-0">Top Products</h5>
                                            <Button color="link" size="sm" className="text-primary" onClick={() => navigateToSection('products')}>
                                                View All <RiArrowRightLine className="ms-1" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardBody className="p-3">
                                        <div className="table-responsive">
                                            <table className="table align-middle table-nowrap mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Product</th>
                                                        <th className="sortable" onClick={() => handleSort('revenue')}>
                                                            Revenue <RiSortAsc size={12} className="ms-1" />
                                                        </th>
                                                        <th>Qty Sold</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.topProducts.slice(0, 5).map((product, index) => (
                                                        <tr key={product.id} className="table-row-hover" onClick={() => handleDetailsView(product, 'product')}>
                                                            <td>
                                                                <div className="d-flex align-items-center">
                                                                    {index < 3 && (
                                                                        <Badge 
                                                                            color={index === 0 ? 'warning' : index === 1 ? 'secondary' : 'light'} 
                                                                            className="badge-soft me-2"
                                                                        >
                                                                            #{index + 1}
                                                                        </Badge>
                                                                    )}
                                                                    <div>
                                                                        <h6 className="mb-0">{product.name}</h6>
                                                                        <small className="text-muted">{product.itemcode}</small>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="fw-semibold">
                                                                    {formatCurrency(product.total_sales_amount)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="text-muted">
                                                                    {formatNumber(product.total_quantity_sold)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <UncontrolledDropdown>
                                                                    <DropdownToggle tag="a" className="btn btn-soft-secondary btn-sm" onClick={(e) => e.stopPropagation()}>
                                                                        <RiMoreFill className="align-middle" />
                                                                    </DropdownToggle>
                                                                    <DropdownMenu className="dropdown-menu-end">
                                                                        <DropdownItem onClick={(e) => { e.stopPropagation(); handleDetailsView(product, 'product'); }}>
                                                                            <RiEyeLine className="me-2 align-middle text-muted" />View
                                                                        </DropdownItem>
                                                                        <DropdownItem onClick={(e) => { e.stopPropagation(); navigateToSection('products'); }}>
                                                                            <RiPencilLine className="me-2 align-middle text-muted" />Edit
                                                                        </DropdownItem>
                                                                    </DropdownMenu>
                                                                </UncontrolledDropdown>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        )}
                        
                        {analytics.topCustomers?.length > 0 && (
                            <Col xl={6} className="mb-4">
                                <Card className="shadow-sm">
                                    <CardHeader>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <h5 className="card-title mb-0">Top Customers</h5>
                                            <Button color="link" size="sm" className="text-primary" onClick={() => navigateToSection('contacts')}>
                                                View All <RiArrowRightLine className="ms-1" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardBody className="p-3">
                                        <div className="table-responsive">
                                            <table className="table align-middle table-nowrap mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Customer</th>
                                                        <th className="sortable" onClick={() => handleSort('sales')}>
                                                            Sales <RiSortAsc size={12} className="ms-1" />
                                                        </th>
                                                        <th>Status</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.topCustomers.slice(0, 5).map((customer, index) => (
                                                        <tr key={customer.id} className="table-row-hover" onClick={() => handleDetailsView(customer, 'customer')}>
                                                            <td>
                                                                <div className="d-flex align-items-center">
                                                                    {index < 3 && (
                                                                        <Badge 
                                                                            color={index === 0 ? 'warning' : index === 1 ? 'secondary' : 'light'} 
                                                                            className="badge-soft me-2"
                                                                        >
                                                                            #{index + 1}
                                                                        </Badge>
                                                                    )}
                                                                    <div>
                                                                        <h6 className="mb-0">{customer.name}</h6>
                                                                        {customer.gstin && (
                                                                            <small className="text-muted">{customer.gstin}</small>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="fw-semibold">
                                                                    {formatCurrency(customer.total_sales)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {parseFloat(customer.pending_amount) > 0 ? (
                                                                    <Badge color="warning" className="badge-soft-warning">
                                                                        Pending
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge color="success" className="badge-soft-success">
                                                                        Paid
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <UncontrolledDropdown>
                                                                    <DropdownToggle tag="a" className="btn btn-soft-secondary btn-sm" onClick={(e) => e.stopPropagation()}>
                                                                        <RiMoreFill className="align-middle" />
                                                                    </DropdownToggle>
                                                                    <DropdownMenu className="dropdown-menu-end">
                                                                        <DropdownItem onClick={(e) => { e.stopPropagation(); handleDetailsView(customer, 'customer'); }}>
                                                                            <RiEyeLine className="me-2 align-middle text-muted" />View
                                                                        </DropdownItem>
                                                                        <DropdownItem onClick={(e) => { e.stopPropagation(); navigateToSection('contacts'); }}>
                                                                            <RiPencilLine className="me-2 align-middle text-muted" />Edit
                                                                        </DropdownItem>
                                                                    </DropdownMenu>
                                                                </UncontrolledDropdown>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        )}
                    </Row>
                )}

                {/* Outstanding Payments - Clean Table Design */}
                {analytics.outstandingPayments?.length > 0 && (
                    <Row>
                        <Col xl={12}>
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="card-title mb-0">Outstanding Payments</h5>
                                        <Button color="link" size="sm" className="text-primary" onClick={() => navigateToSection('payments')}>
                                            Manage All <RiArrowRightLine className="ms-1" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardBody className="p-3">
                                    <div className="table-responsive">
                                        <table className="table align-middle table-nowrap mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Reference</th>
                                                    <th>Contact</th>
                                                    <th className="sortable" onClick={() => handleSort('amount')}>
                                                        Amount <RiSortAsc size={12} className="ms-1" />
                                                    </th>
                                                    <th>Balance Type</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.outstandingPayments
                                                    .sort((a, b) => b.days_overdue - a.days_overdue)
                                                    .slice(0, 10)
                                                    .map((payment, index) => (
                                                    <tr key={`${payment.type}-${payment.id}`} className="table-row-hover" onClick={() => handleOutstandingPaymentClick(payment)}>
                                                        <td>
                                                            <Badge 
                                                                color={payment.type === 'sales' ? 'success' : 'primary'} 
                                                                className="badge-soft"
                                                            >
                                                                {payment.type}
                                                            </Badge>
                                                        </td>
                                                        <td>
                                                            <h6 className="mb-0">{payment.reference}</h6>
                                                        </td>
                                                        <td>
                                                            <span className="text-muted">{payment.contact_name || '—'}</span>
                                                        </td>
                                                        <td>
                                                            <span className="fw-semibold">
                                                                {formatCurrency(payment.amount)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {getBalanceTypeBadge(payment.type)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {analytics.outstandingPayments.length > 10 && (
                                        <div className="text-center mt-3 pt-3 border-top">
                                            <Button color="link" className="text-primary" onClick={() => navigateToSection('payments')}>
                                                View All {analytics.outstandingPayments.length} Outstanding Payments
                                            </Button>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* Empty State for Payments */}
                {analytics.outstandingPayments?.length === 0 && (
                    <Row>
                        <Col xl={12}>
                            <Card className="shadow-sm">
                                <CardBody className="text-center py-4">
                                    <i className="ri-checkbox-multiple-line text-success mb-3" style={{ fontSize: '3rem' }}></i>
                                    <h5 className="text-success">All Payments Up to Date!</h5>
                                    <p className="text-muted mb-3">No outstanding payments found. Great job!</p>
                                    <Button color="success" onClick={() => navigateToSection('payments')}>
                                        View Payment History
                                    </Button>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* Filters Modal */}
                <Modal isOpen={modals.filters} toggle={() => toggleModal('filters')} size="lg">
                    <ModalHeader toggle={() => toggleModal('filters')}>
                        Dashboard Filters
                    </ModalHeader>
                    <ModalBody>
                        <DashboardFilters 
                            onFiltersChange={handleFiltersChange}
                            currentFilters={filters}
                            onRefresh={handleRefresh}
                        />
                    </ModalBody>
                </Modal>

                {/* Product Details Modal */}
                <Modal isOpen={modals.productDetails} toggle={() => toggleModal('productDetails')} size="lg">
                    <ModalHeader toggle={() => toggleModal('productDetails')}>
                        Product Details
                    </ModalHeader>
                    <ModalBody>
                        {selectedItem && (
                            <Row>
                                <Col md={6}>
                                    <h6 className="text-muted mb-3">Product Information</h6>
                                    <p><strong>Name:</strong> {selectedItem.name}</p>
                                    <p><strong>Item Code:</strong> {selectedItem.itemcode || 'N/A'}</p>
                                    <p><strong>Current Rate:</strong> {formatCurrency(selectedItem.current_rate)}</p>
                                </Col>
                                <Col md={6}>
                                    <h6 className="text-muted mb-3">Sales Performance</h6>
                                    <p><strong>Total Revenue:</strong> {formatCurrency(selectedItem.total_sales_amount)}</p>
                                    <p><strong>Quantity Sold:</strong> {formatNumber(selectedItem.total_quantity_sold)}</p>
                                    <p><strong>Invoice Count:</strong> {formatNumber(selectedItem.invoice_count)}</p>
                                </Col>
                            </Row>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button color="light" onClick={() => toggleModal('productDetails')}>
                            Close
                        </Button>
                        <Button color="primary" onClick={() => navigateToSection('products')}>
                            Manage Products
                        </Button>
                    </ModalFooter>
                </Modal>

                {/* Customer Details Modal */}
                <Modal isOpen={modals.customerDetails} toggle={() => toggleModal('customerDetails')} size="lg">
                    <ModalHeader toggle={() => toggleModal('customerDetails')}>
                        Customer Details
                    </ModalHeader>
                    <ModalBody>
                        {selectedItem && (
                            <Row>
                                <Col md={6}>
                                    <h6 className="text-muted mb-3">Customer Information</h6>
                                    <p><strong>Name:</strong> {selectedItem.name}</p>
                                    <p><strong>GSTIN:</strong> {selectedItem.gstin || 'N/A'}</p>
                                    <p><strong>Total Sales:</strong> {formatCurrency(selectedItem.total_sales)}</p>
                                </Col>
                                <Col md={6}>
                                    <h6 className="text-muted mb-3">Payment Status</h6>
                                    <p><strong>Invoice Count:</strong> {formatNumber(selectedItem.invoice_count)}</p>
                                    <p><strong>Pending Amount:</strong> {formatCurrency(selectedItem.pending_amount)}</p>
                                    <p><strong>Status:</strong> 
                                        {parseFloat(selectedItem.pending_amount) > 0 ? (
                                            <Badge color="warning" className="badge-soft-warning ms-2">Has Pending</Badge>
                                        ) : (
                                            <Badge color="success" className="badge-soft-success ms-2">Paid Up</Badge>
                                        )}
                                    </p>
                                </Col>
                            </Row>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button color="light" onClick={() => toggleModal('customerDetails')}>
                            Close
                        </Button>
                        <Button color="primary" onClick={() => navigateToSection('contacts')}>
                            Manage Contacts
                        </Button>
                    </ModalFooter>
                </Modal>

                {/* Payment Form Modal */}
                <PaymentForm
                    isOpen={modals.paymentForm}
                    toggle={() => toggleModal('paymentForm')}
                    isEditMode={false}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    selectedPayment={null}
                    selectedInvoice={selectedOutstandingPayment}
                    invoiceType={selectedOutstandingPayment?.type || 'sale'}
                    onSubmit={handlePaymentSubmit}
                    isLoading={paymentFormLoading}
                />
            </Container>

            <style>{`
                /* Clean Dashboard Styles - Match Contacts Page */
                .metric-card {
                    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
                    cursor: pointer;
                }

                .metric-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1) !important;
                }

                .clickable-card {
                    cursor: pointer;
                    transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
                }

                .clickable-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1) !important;
                }

                .table-row-hover {
                    cursor: pointer;
                    transition: background-color 0.2s ease-in-out;
                }

                .table-row-hover:hover {
                    background-color: rgba(0,0,0,0.02);
                }

                .sortable {
                    cursor: pointer;
                    user-select: none;
                }

                .sortable:hover {
                    color: var(--bs-primary) !important;
                }

                .progress-sm {
                    height: 4px;
                }

                .avatar-md {
                    width: 3rem;
                    height: 3rem;
                }

                .fs-24 {
                    font-size: 1.5rem !important;
                }

                .fs-12 {
                    font-size: 0.75rem !important;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Mobile responsiveness */
                @media (max-width: 768px) {
                    .d-flex.gap-2 {
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </div>
    );
};

export default BusinessDashboard; 
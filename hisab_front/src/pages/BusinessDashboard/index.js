import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Badge, Modal, ModalHeader, ModalBody, Progress, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem, Alert } from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import Loader from '../../Components/Common/Loader';
import PaymentForm from '../../Components/Payments/PaymentForm';
import { 
    getBusinessAnalytics, 
    getQuickStats, 
    exportDashboardData,
    getChartData,
    getDashboardInsights,
    getRecentActivities
} from '../../services/dashboard';
import { getContacts } from '../../services/contacts';
import { getBankAccounts } from '../../services/bankAccount';
import { createPayment } from '../../services/payment';
import useCompanySelectionState from '../../hooks/useCompanySelection';
import useDashboardPreferences from '../../hooks/useDashboardPreferences';
import DashboardFilters from './DashboardFilters';
import {
    RevenueTrendChart,
    CashFlowChart,
    PaymentStatusChart,
    TopProductsChart,
    MonthlySalesChart,
    BusinessGrowthChart
} from './BusinessDashboardCharts';

const BusinessDashboard = () => {
    const { selectedCompanyId } = useCompanySelectionState();
    const navigate = useNavigate();
    
    // Use dashboard preferences hook
    const {
        preferences,
        isLoading: preferencesLoading,
        updatePreference,
        updateNestedPreference,
        resetPreferences,
        hasHiddenSections,
        setPeriod,
        setFilters
    } = useDashboardPreferences();
    
    const [state, setState] = useState({
        analytics: null,
        quickStats: null,
        chartData: null,
        insights: null,
        activities: [],
        loading: true,
        refreshing: false,
        error: null,
        modals: {
            filters: false,
            paymentForm: false,
            settings: false
        },
        selectedOutstandingPayment: null,
        paymentFormLoading: false,
        contacts: [],
        bankAccounts: []
    });

    const { 
        analytics, 
        quickStats, 
        chartData, 
        insights, 
        activities, 
        loading, 
        refreshing, 
        error,
        modals, 
        selectedOutstandingPayment, 
        paymentFormLoading, 
        contacts, 
        bankAccounts
    } = state;

    // Memoized utility functions
    const formatCurrency = useMemo(() => (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    }, []);

    const formatNumber = useMemo(() => (num) => {
        return new Intl.NumberFormat('en-IN').format(num || 0);
    }, []);

    const calculatePercentage = useCallback((part, total) => {
        if (!total || total === 0) return 0;
        const percentage = (part / total) * 100;
        // FIXED: Show more precise percentage for better accuracy
        // If there's any pending amount, don't show 100%
        if (percentage >= 99.5 && part < total) {
            return Math.floor(percentage); // Show 99% instead of 100% if there's pending amount
        }
        return Math.round(percentage);
    }, []);

    // Optimized data fetching without page reload
    const fetchDashboardData = useCallback(async (showRefreshing = false, customFilters = null, chartPeriod = null) => {
        if (!selectedCompanyId || preferencesLoading) {
            return;
        }

        const filtersToUse = customFilters || preferences.filters;
        const periodToUse = chartPeriod || preferences.period;

        setState(prev => ({ 
            ...prev, 
            loading: !showRefreshing,
            refreshing: showRefreshing,
            error: null
        }));

        try {
            const [
                analyticsResponse,
                quickStatsResponse,
                chartDataResponse,
                insightsResponse,
                activitiesResponse
            ] = await Promise.all([
                getBusinessAnalytics(filtersToUse).catch(err => ({ success: false, error: err.message })),
                getQuickStats().catch(err => ({ success: false, error: err.message })),
                getChartData(periodToUse, filtersToUse).catch(err => ({ success: false, error: err.message })),
                getDashboardInsights().catch(err => ({ success: false, error: err.message })),
                getRecentActivities().catch(err => ({ success: false, error: err.message }))
            ]);

            // DEBUG: Log dashboard data to check calculations
            console.log('=== DASHBOARD DATA DEBUG ===');
            console.log('Analytics response:', analyticsResponse);
            if (analyticsResponse?.financialSummary) {
                console.log('Purchase data:', {
                    total_purchases: analyticsResponse.financialSummary.total_purchases,
                    purchases_paid: analyticsResponse.financialSummary.purchases_paid,
                    purchases_pending: analyticsResponse.financialSummary.purchases_pending,
                    calculated_percentage: calculatePercentage(analyticsResponse.financialSummary.purchases_paid, analyticsResponse.financialSummary.total_purchases)
                });
                console.log('Sales data:', {
                    total_sales: analyticsResponse.financialSummary.total_sales,
                    sales_received: analyticsResponse.financialSummary.sales_received,
                    sales_pending: analyticsResponse.financialSummary.sales_pending,
                    calculated_percentage: calculatePercentage(analyticsResponse.financialSummary.sales_received, analyticsResponse.financialSummary.total_sales)
                });
            }
            console.log('=== END DASHBOARD DEBUG ===');

            // Check for critical failures
            if (!analyticsResponse.success && !quickStatsResponse.success) {
                throw new Error('Failed to load essential dashboard data');
            }

            setState(prev => ({
                ...prev,
                analytics: analyticsResponse.success ? analyticsResponse.analytics : null,
                quickStats: quickStatsResponse.success ? quickStatsResponse.stats : null,
                chartData: chartDataResponse.success ? chartDataResponse.chartData : null,
                insights: insightsResponse.success ? insightsResponse : null,
                activities: activitiesResponse.success ? activitiesResponse.activities : [],
                loading: false,
                refreshing: false,
                error: null
            }));

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setState(prev => ({ 
                ...prev, 
                loading: false, 
                refreshing: false,
                error: error.message || 'Failed to load dashboard data'
            }));
            toast.error(`Failed to load dashboard data: ${error.message || 'Unknown error'}`);
        }
    }, [selectedCompanyId, preferences.filters, preferences.period, preferencesLoading]);

    const fetchPaymentFormData = useCallback(async () => {
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
            console.error('Error fetching payment form data:', error);
        }
    }, []);

    // Event handlers
    const handleRefresh = useCallback(() => {
        fetchDashboardData(true);
    }, [fetchDashboardData]);

    const handleFiltersChange = useCallback((newFilters) => {
        setFilters(newFilters);
        fetchDashboardData(false, newFilters);
    }, [fetchDashboardData, setFilters]);

    const handlePeriodChange = useCallback((newPeriod) => {
        setPeriod(newPeriod);
        // Don't reload page - just update data smoothly
        fetchDashboardData(false, preferences.filters, newPeriod);
    }, [fetchDashboardData, preferences.filters, setPeriod]);

    const toggleModal = useCallback((modalName, value) => {
        setState(prev => ({
            ...prev,
            modals: { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] }
        }));
    }, []);

    const toggleSection = useCallback((section) => {
        updatePreference(section, !preferences[section]);
    }, [preferences, updatePreference]);

    const navigateToSection = useCallback((section) => {
        const routes = {
            sales: '/sales/invoices',
            purchases: '/purchases/invoices',
            products: '/products',
            contacts: '/contacts',
            expenses: '/expenses',
            incomes: '/incomes', // FIXED: Updated to match card usage
            income: '/incomes',  // Keep both for compatibility
            payments: '/payments',
            'bank-accounts': '/bank-accounts'
        };
        
        if (routes[section]) {
            navigate(routes[section]);
        }
    }, [navigate]);

    const handleQuickAdd = useCallback((type) => {
        const addRoutes = {
            sale: '/sales/invoices?add=true',
            purchase: '/purchases/invoices?add=true',
            product: '/products?add=true',
            contact: '/contacts?add=true'
        };
        
        if (addRoutes[type]) {
            navigate(addRoutes[type]);
        }
    }, [navigate]);

    const handleOutstandingPaymentClick = useCallback(async (payment) => {
        setState(prev => ({
            ...prev,
            selectedOutstandingPayment: payment,
            paymentFormLoading: true
        }));

        if (bankAccounts.length === 0 || contacts.length === 0) {
            await fetchPaymentFormData();
        }

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
    }, [bankAccounts.length, contacts.length, fetchPaymentFormData]);

    const handlePaymentSubmit = useCallback(async (payloadFromForm) => {
        try {
            setState(prev => ({ ...prev, paymentFormLoading: true }));

            const response = await createPayment(payloadFromForm);

            if (response.success) {
                toast.success('Payment created successfully');
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, paymentForm: false },
                    paymentFormLoading: false,
                    selectedOutstandingPayment: null
                }));
                
                fetchDashboardData(true);
            }
        } catch (error) {
            setState(prev => ({ ...prev, paymentFormLoading: false }));
            toast.error(error.message || 'Failed to create payment');
        }
    }, [fetchDashboardData]);

    const handleExport = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, refreshing: true }));
            const response = await exportDashboardData('csv', preferences.filters);
            
            if (response.success) {
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
    }, [preferences.filters]);

    const convertToCSV = useCallback((data) => {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        const csvRows = data.map(row => 
            headers.map(header => {
                const value = row[header];
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        );
        
        return [csvHeaders, ...csvRows].join('\n');
    }, []);

    // Load data when component mounts or company changes
    useEffect(() => {
        if (selectedCompanyId) {
            fetchDashboardData();
        }
    }, [selectedCompanyId, fetchDashboardData]);

    // Loading state
    if (loading) {
        return (
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Business Dashboard" pageTitle="Dashboard" />
                    <Loader />
                </Container>
            </div>
        );
    }

    // No company selected
    if (!selectedCompanyId) {
        return (
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Business Dashboard" pageTitle="Dashboard" />
                    <Card>
                        <CardBody className="text-center py-5">
                            <i className="ri-building-line display-4 text-muted mb-3"></i>
                            <h5 className="text-muted">Please select a company to view analytics</h5>
                            <p className="text-muted">Choose a company from the dropdown to access your business dashboard</p>
                        </CardBody>
                    </Card>
                </Container>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Business Dashboard" pageTitle="Dashboard" />
                    <Alert color="danger" className="mb-4">
                        <h6 className="alert-heading">
                            <i className="ri-error-warning-line me-2"></i>
                            Dashboard Error
                        </h6>
                        <p className="mb-2">{error}</p>
                        <Button color="danger" size="sm" onClick={handleRefresh}>
                            <i className="ri-refresh-line me-1"></i>
                            Retry
                        </Button>
                    </Alert>
                </Container>
            </div>
        );
    }

    // No data state
    if (!analytics || !quickStats) {
        return (
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Business Dashboard" pageTitle="Dashboard" />
                    <Card>
                        <CardBody className="text-center py-5">
                            <i className="ri-database-2-line display-4 text-muted mb-3"></i>
                            <h5 className="text-muted">No data available</h5>
                            <p className="text-muted mb-3">Start recording transactions to see business analytics</p>
                            <Button color="primary" onClick={handleRefresh}>
                                <i className="ri-refresh-line me-1"></i>
                                Load Data
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

                {/* Compact Header */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h4 className="mb-1 fw-semibold">Business Overview</h4>
                        <p className="text-muted mb-0">Monitor your business performance and key metrics</p>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <Button color="outline-secondary" size="sm" onClick={() => toggleModal('filters', true)}>
                            <i className="ri-filter-line me-1"></i>
                            Filters
                        </Button>
                        <UncontrolledDropdown>
                            <DropdownToggle color="success" size="sm" caret>
                                <i className="ri-add-line me-1"></i>
                                Add New
                            </DropdownToggle>
                            <DropdownMenu>
                                <DropdownItem onClick={() => handleQuickAdd('sale')}>
                                    <i className="ri-arrow-up-line me-2 text-success"></i>
                                    New Sale
                                </DropdownItem>
                                <DropdownItem onClick={() => handleQuickAdd('purchase')}>
                                    <i className="ri-arrow-down-line me-2 text-primary"></i>
                                    New Purchase
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem onClick={() => handleQuickAdd('product')}>
                                    <i className="ri-shopping-cart-line me-2 text-info"></i>
                                    Add Product
                                </DropdownItem>
                                <DropdownItem onClick={() => handleQuickAdd('contact')}>
                                    <i className="ri-user-line me-2 text-secondary"></i>
                                    Add Contact
                                </DropdownItem>
                            </DropdownMenu>
                        </UncontrolledDropdown>
                        <UncontrolledDropdown>
                            <DropdownToggle color="outline-info" size="sm" caret>
                                <i className="ri-layout-line me-1"></i>
                                View
                                {hasHiddenSections && (
                                    <Badge color="warning" className="badge-soft ms-1">
                                        {Object.values(preferences).filter(v => v === false).length}
                                    </Badge>
                                )}
                            </DropdownToggle>
                            <DropdownMenu>
                                <DropdownItem onClick={() => updatePreference('showCharts', !preferences.showCharts)}>
                                    <i className={`ri-${preferences.showCharts ? 'eye' : 'eye-off'}-line me-2 text-${preferences.showCharts ? 'success' : 'muted'}`}></i>
                                    Charts
                                </DropdownItem>
                                <DropdownItem onClick={() => updatePreference('showInsights', !preferences.showInsights)}>
                                    <i className={`ri-${preferences.showInsights ? 'eye' : 'eye-off'}-line me-2 text-${preferences.showInsights ? 'success' : 'muted'}`}></i>
                                    Insights
                                </DropdownItem>
                                <DropdownItem onClick={() => updatePreference('showActivities', !preferences.showActivities)}>
                                    <i className={`ri-${preferences.showActivities ? 'eye' : 'eye-off'}-line me-2 text-${preferences.showActivities ? 'success' : 'muted'}`}></i>
                                    Activities
                                </DropdownItem>
                                <DropdownItem onClick={() => updatePreference('showBusinessOverview', !preferences.showBusinessOverview)}>
                                    <i className={`ri-${preferences.showBusinessOverview ? 'eye' : 'eye-off'}-line me-2 text-${preferences.showBusinessOverview ? 'success' : 'muted'}`}></i>
                                    Overview
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem onClick={() => {
                                    updatePreference('showCharts', true);
                                    updatePreference('showInsights', true);
                                    updatePreference('showActivities', true);
                                    updatePreference('showBusinessOverview', true);
                                }}>
                                    <i className="ri-eye-line me-2 text-success"></i>
                                    Show All
                                </DropdownItem>
                            </DropdownMenu>
                        </UncontrolledDropdown>
                        <Button color="primary" size="sm" onClick={handleRefresh} disabled={refreshing}>
                            <i className={`ri-refresh-line me-1 ${refreshing ? 'spin' : ''}`}></i>
                            Refresh
                        </Button>
                    </div>
                </div>



                {/* Financial Summary - Complete Layout with All Transaction Types */}
                {preferences.showFinancialSummary && (
                <Row className="mb-4">
                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="metric-card h-100" onClick={() => navigateToSection('sales')}>
                            <CardBody className="p-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="metric-icon bg-success-subtle text-success">
                                            <i className="ri-arrow-up-line"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3 overflow-hidden">
                                        <p className="text-muted mb-1 fs-13">Total Sales</p>
                                        <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_sales)}</h4>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">{formatNumber(analytics.financialSummary.total_sales_count)} invoices</small>
                                            {analytics.financialSummary.total_sales > 0 && (
                                                <div className="text-end">
                                                    <small className="text-success fw-medium">
                                                        {calculatePercentage(analytics.financialSummary.sales_received, analytics.financialSummary.total_sales)}% collected
                                                    </small>
                                                    {analytics.financialSummary.sales_pending > 0 && (
                                                        <div>
                                                            <small className="text-warning">
                                                                ₹{formatNumber(analytics.financialSummary.sales_pending)} pending
                                                            </small>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {analytics.financialSummary.total_sales > 0 && (
                                                <Progress 
                                                    value={calculatePercentage(analytics.financialSummary.sales_received, analytics.financialSummary.total_sales)} 
                                                    color="success" 
                                                className="progress-sm mt-2"
                                                />
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="metric-card h-100" onClick={() => navigateToSection('purchases')}>
                            <CardBody className="p-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="metric-icon bg-primary-subtle text-primary">
                                            <i className="ri-arrow-down-line"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3 overflow-hidden">
                                        <p className="text-muted mb-1 fs-13">Total Purchases</p>
                                        <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_purchases)}</h4>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">{formatNumber(analytics.financialSummary.total_purchase_count)} invoices</small>
                                            {analytics.financialSummary.total_purchases > 0 && (
                                                <div className="text-end">
                                                    <small className="text-primary fw-medium">
                                                        {calculatePercentage(analytics.financialSummary.purchases_paid, analytics.financialSummary.total_purchases)}% paid
                                                    </small>
                                                    {analytics.financialSummary.purchases_pending > 0 && (
                                                        <div>
                                                            <small className="text-warning">
                                                                ₹{formatNumber(analytics.financialSummary.purchases_pending)} pending
                                                            </small>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {analytics.financialSummary.total_purchases > 0 && (
                                                <Progress 
                                                    value={calculatePercentage(analytics.financialSummary.purchases_paid, analytics.financialSummary.total_purchases)} 
                                                    color="primary" 
                                                className="progress-sm mt-2"
                                                />
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    {/* ADDED: Income Card */}
                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="metric-card h-100" onClick={() => navigateToSection('incomes')}>
                            <CardBody className="p-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="metric-icon bg-success-subtle text-success">
                                            <i className="ri-money-dollar-circle-line"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3 overflow-hidden">
                                        <p className="text-muted mb-1 fs-13">Total Incomes</p>
                                        <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_incomes)}</h4>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">{formatNumber(analytics.financialSummary.total_income_count)} entries</small>
                                            {analytics.financialSummary.total_incomes > 0 && (
                                                <div className="text-end">
                                                    <small className="text-success fw-medium">
                                                        {calculatePercentage(analytics.financialSummary.incomes_received, analytics.financialSummary.total_incomes)}% received
                                                    </small>
                                                    {analytics.financialSummary.incomes_pending > 0 && (
                                                        <div>
                                                            <small className="text-warning">
                                                                ₹{formatNumber(analytics.financialSummary.incomes_pending)} pending
                                                            </small>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {analytics.financialSummary.total_incomes > 0 && (
                                            <Progress 
                                                value={calculatePercentage(analytics.financialSummary.incomes_received, analytics.financialSummary.total_incomes)} 
                                                color="success" 
                                                className="progress-sm mt-2"
                                            />
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    {/* ADDED: Expense Card */}
                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="metric-card h-100" onClick={() => navigateToSection('expenses')}>
                            <CardBody className="p-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="metric-icon bg-danger-subtle text-danger">
                                            <i className="ri-money-dollar-circle-line"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3 overflow-hidden">
                                        <p className="text-muted mb-1 fs-13">Total Expenses</p>
                                        <h4 className="mb-1 fw-bold">{formatCurrency(analytics.financialSummary.total_expenses)}</h4>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">{formatNumber(analytics.financialSummary.total_expense_count)} entries</small>
                                            {analytics.financialSummary.total_expenses > 0 && (
                                                <div className="text-end">
                                                    <small className="text-danger fw-medium">
                                                        {calculatePercentage(analytics.financialSummary.expenses_paid, analytics.financialSummary.total_expenses)}% paid
                                                    </small>
                                                    {analytics.financialSummary.expenses_pending > 0 && (
                                                        <div>
                                                            <small className="text-warning">
                                                                ₹{formatNumber(analytics.financialSummary.expenses_pending)} pending
                                                            </small>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {analytics.financialSummary.total_expenses > 0 && (
                                            <Progress 
                                                value={calculatePercentage(analytics.financialSummary.expenses_paid, analytics.financialSummary.total_expenses)} 
                                                color="danger" 
                                                className="progress-sm mt-2"
                                            />
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="metric-card h-100" onClick={() => navigateToSection('bank-accounts')}>
                            <CardBody className="p-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="metric-icon bg-info-subtle text-info">
                                            <i className="ri-bank-line"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3 overflow-hidden">
                                        <p className="text-muted mb-1 fs-13">Bank Balance</p>
                                        <h4 className="mb-1 fw-bold">{formatCurrency(quickStats.total_balance)}</h4>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">{formatNumber(quickStats.active_bank_accounts)} accounts</small>
                                            <small className={`fw-medium ${analytics.financialSummary.net_cash_flow >= 0 ? 'text-success' : 'text-danger'}`}>
                                                {analytics.financialSummary.net_cash_flow >= 0 ? '+' : ''}{formatCurrency(Math.abs(analytics.financialSummary.net_cash_flow))}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={2} lg={4} md={6} className="mb-3">
                        <Card className="metric-card h-100">
                            <CardBody className="p-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className={`metric-icon ${analytics.financialSummary.gross_profit >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                            <i className={`${analytics.financialSummary.gross_profit >= 0 ? 'ri-trending-up-line' : 'ri-trending-down-line'}`}></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3 overflow-hidden">
                                        <p className="text-muted mb-1 fs-13">Gross Profit</p>
                                        <h4 className={`mb-1 fw-bold ${analytics.financialSummary.gross_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatCurrency(analytics.financialSummary.gross_profit)}
                                        </h4>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">Revenue - Costs</small>
                                            <Badge 
                                                color={analytics.financialSummary.gross_profit >= 0 ? 'success' : 'danger'} 
                                                className="badge-soft-sm"
                                            >
                                                {analytics.financialSummary.gross_profit >= 0 ? 'Profit' : 'Loss'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
                )}

                {/* Charts Analytics Section */}
                {preferences.showCharts && chartData && (
                    <Card className="mb-4">
                        <CardHeader>
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="card-title mb-0 fw-semibold">
                                    <i className="ri-bar-chart-line me-2 text-primary"></i>
                                    Business Analytics
                                </h5>
                                                                        <div className="d-flex gap-2">
                                            <Button 
                                                color={preferences.period === '6months' ? 'primary' : 'outline-primary'}
                                                size="sm"
                                                onClick={() => handlePeriodChange('6months')}
                                            >
                                                6M
                                            </Button>
                                            <Button 
                                                color={preferences.period === '1year' ? 'primary' : 'outline-primary'}
                                                size="sm"
                                                onClick={() => handlePeriodChange('1year')}
                                            >
                                                1Y
                                            </Button>
                                        </div>
                            </div>
                        </CardHeader>
                        <CardBody>
                            {/* Revenue Trend */}
                            {preferences.chartTypes.revenueTrend && (
                <Row className="mb-4">
                                    <Col xl={12}>
                                        <div className="chart-container">
                                                                                        <h6 className="chart-title">Revenue Trend Analysis</h6>
                                            <RevenueTrendChart 
                                                dataColors='["--vz-primary", "--vz-secondary", "--vz-success"]'
                                                chartData={chartData.revenueTrend}
                                            />
                                        </div>
                    </Col>
                                </Row>
                            )}

                            {/* Cash Flow and Payment Status */}
                            <Row className="mb-4">
                                {preferences.chartTypes.cashFlow && (
                                    <Col xl={preferences.chartTypes.paymentStatus ? 8 : 12}>
                                        <div className="chart-container h-100">
                                            <h6 className="chart-title">Cash Flow Analysis</h6>
                                            <CashFlowChart 
                                                dataColors='["--vz-success", "--vz-danger"]'
                                                chartData={{
                                                    months: chartData.revenueTrend?.labels || [],
                                                    incomeData: chartData.revenueTrend?.incomesData || [],
                                                    expenseData: chartData.revenueTrend?.expensesData || []
                                                }}
                                            />
                                        </div>
                                    </Col>
                                )}
                                {preferences.chartTypes.paymentStatus && (
                                    <Col xl={preferences.chartTypes.cashFlow ? 4 : 12}>
                                        <div className="chart-container h-100">
                                            <h6 className="chart-title">Payment Distribution</h6>
                                            <PaymentStatusChart 
                                                dataColors='["--vz-success", "--vz-warning", "--vz-danger"]'
                                                chartData={chartData.paymentStatus}
                                            />
                                        </div>
                                    </Col>
                                )}
                            </Row>

                                                        {/* Top Products */}
                            {preferences.chartTypes.topProducts && chartData.topProducts?.labels?.length > 0 && (
                                <Row>
                                    <Col xl={12}>
                                        <div className="chart-container">
                                            <h6 className="chart-title">Top Products Performance</h6>
                                            <TopProductsChart 
                                                dataColors='["--vz-primary", "--vz-info"]'
                                                chartData={{
                                                    productNames: chartData.topProducts.labels,
                                                    revenue: chartData.topProducts.revenue,
                                                    quantity: chartData.topProducts.quantity
                                                }}
                                            />
                                        </div>
                                    </Col>
                                </Row>
                            )}
                            </CardBody>
                        </Card>
                )}

                {/* Business Insights and Activities */}
                    <Row className="mb-4">
                    {/* Insights */}
                    {preferences.showInsights && insights && insights.recommendations && (
                        <Col xl={preferences.showActivities && activities?.length > 0 ? 6 : 12} className="mb-3">
                            <Card className="h-100">
                                <CardHeader>
                                    <h5 className="card-title mb-0 fw-semibold">
                                        <i className="ri-lightbulb-line me-2 text-warning"></i>
                                        Business Insights
                                    </h5>
                                </CardHeader>
                                <CardBody>
                                    <div className="mb-3">
                                        <h6 className="fw-semibold mb-2">Key Metrics</h6>
                                        <div className="row g-2">
                                            <div className="col-6">
                                                <div className="text-center p-2 bg-light rounded">
                                                    <div className={`fw-bold ${insights.insights.salesGrowth >= 0 ? 'text-success' : 'text-danger'}`}>
                                                        {insights.insights.salesGrowth > 0 ? '+' : ''}{insights.insights.salesGrowth}%
                                                    </div>
                                                    <small className="text-muted">Growth</small>
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="text-center p-2 bg-light rounded">
                                                                        <Badge 
                                                        color={insights.insights.overdueRisk === 'high' ? 'danger' : insights.insights.overdueRisk === 'medium' ? 'warning' : 'success'}
                                                        className="badge-soft"
                                                                        >
                                                        {insights.insights.overdueRisk}
                                                                        </Badge>
                                                    <small className="text-muted d-block">Risk</small>
                                                                    </div>
                                                                </div>
                                        </div>
                                    </div>
                                    <div className="recommendations">
                                        <h6 className="fw-semibold mb-2">Recommendations</h6>
                                        {insights.recommendations.slice(0, 2).map((rec, index) => (
                                            <Alert key={index} color={rec.type} className="py-2 px-3 mb-2">
                                                <div className="d-flex align-items-start">
                                                    <i className={`ri-${rec.type === 'success' ? 'checkbox-circle' : rec.type === 'warning' ? 'alert' : rec.type === 'danger' ? 'error-warning' : 'information'}-line me-2 mt-1`}></i>
                                                    <div className="flex-grow-1">
                                                        <h6 className="alert-heading mb-1 fs-14">{rec.title}</h6>
                                                        <p className="mb-0 fs-12">{rec.message}</p>
                                                    </div>
                                                </div>
                                            </Alert>
                                        ))}
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        )}
                        
                    {/* Recent Activities */}
                    {preferences.showActivities && activities && activities.length > 0 && (
                        <Col xl={preferences.showInsights && insights?.recommendations ? 6 : 12} className="mb-3">
                            <Card className="h-100">
                                    <CardHeader>
                                        <h5 className="card-title mb-0 fw-semibold">
                                            <i className="ri-time-line me-2 text-secondary"></i>
                                            Recent Activities
                                        </h5>
                                    </CardHeader>
                                <CardBody>
                                    <div className="activity-list">
                                        {activities.slice(0, 6).map((activity, index) => (
                                            <div key={index} className="activity-item d-flex align-items-center py-2">
                                                <div className={`activity-icon me-3 ${
                                                    activity.activity_type === 'sale' ? 'bg-success-subtle text-success' :
                                                    activity.activity_type === 'purchase' ? 'bg-primary-subtle text-primary' :
                                                    'bg-info-subtle text-info'
                                                }`}>
                                                    <i className={`ri-${activity.activity_type === 'sale' ? 'arrow-up' : activity.activity_type === 'purchase' ? 'arrow-down' : 'exchange'}-line`}></i>
                                                </div>
                                                <div className="flex-grow-1 overflow-hidden">
                                                    <h6 className="mb-1 fs-14 text-truncate">{activity.reference}</h6>
                                                    <p className="text-muted mb-0 fs-12 text-truncate">
                                                        {activity.contact_name || 'Direct'} • {activity.timeAgo}
                                                    </p>
                                                </div>
                                                <div className="text-end">
                                                    <div className="fw-bold fs-13">{formatCurrency(activity.amount)}</div>
                                                                        <Badge 
                                                        color={activity.activity_type === 'sale' ? 'success' : 
                                                              activity.activity_type === 'purchase' ? 'primary' : 'info'}
                                                        className="badge-soft-sm"
                                                                        >
                                                        {activity.activity_type}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                        ))}
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        )}
                    </Row>

                {/* Business Overview */}
                {preferences.showBusinessOverview && (
                <Row className="mb-4">
                    <Col xl={4} lg={6} className="mb-3">
                        <Card className="overview-card h-100" onClick={() => navigateToSection('products')}>
                            <CardBody className="text-center p-4">
                                <div className="overview-icon bg-primary-subtle text-primary mb-3">
                                    <i className="ri-shopping-cart-line"></i>
                                </div>
                                <h3 className="mb-1 fw-bold">{formatNumber(quickStats.total_products)}</h3>
                                <p className="text-muted mb-0">Products</p>
                                <small className="text-muted">Inventory items</small>
                            </CardBody>
                        </Card>
                    </Col>
                    
                    <Col xl={4} lg={6} className="mb-3">
                        <Card className="overview-card h-100" onClick={() => navigateToSection('contacts')}>
                            <CardBody className="text-center p-4">
                                <div className="overview-icon bg-info-subtle text-info mb-3">
                                    <i className="ri-contacts-line"></i>
                                </div>
                                <h3 className="mb-1 fw-bold">{formatNumber(quickStats.total_contacts)}</h3>
                                <p className="text-muted mb-0">Contacts</p>
                                <small className="text-muted">Customers & vendors</small>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={4} lg={12} className="mb-3">
                        <Card className="h-100">
                            <CardBody className="text-center p-4">
                                <div className="overview-icon bg-success-subtle text-success mb-3">
                                    <i className="ri-calendar-check-line"></i>
                                </div>
                                {quickStats.today_sales > 0 ? (
                                    <>
                                        <h3 className="mb-1 fw-bold text-success">{formatCurrency(quickStats.today_sales)}</h3>
                                        <p className="text-muted mb-0">Today's Sales</p>
                                        <small className="text-success">Excellent performance</small>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="mb-1 fw-bold text-muted">₹0</h3>
                                        <p className="text-muted mb-0">Today's Sales</p>
                                        <small className="text-muted">No sales recorded today</small>
                                    </>
                                )}
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
                )}

                {/* Outstanding Payments */}
                {preferences.showOutstandingPayments && analytics.outstandingPayments?.length > 0 && (
                    <Card className="mb-4">
                                <CardHeader>
                                    <div className="d-flex justify-content-between align-items-center">
                                <h5 className="card-title mb-0 fw-semibold">
                                    <i className="ri-money-dollar-circle-line me-2 text-warning"></i>
                                    Outstanding Payments
                                    <Badge color="warning" className="badge-soft ms-2">
                                        {analytics.outstandingPayments.length}
                                    </Badge>
                                </h5>
                                <Button color="outline-primary" size="sm" onClick={() => navigateToSection('payments')}>
                                    <i className="ri-arrow-right-line ms-1"></i>
                                    Manage All
                                        </Button>
                                    </div>
                                </CardHeader>
                        <CardBody>
                                    <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                            <thead className="table-light">
                                                <tr>
                                            <th className="fw-semibold">Type</th>
                                            <th className="fw-semibold">Reference</th>
                                            <th className="fw-semibold">Contact</th>
                                            <th className="fw-semibold">Amount</th>
                                            <th className="fw-semibold">Status</th>
                                            <th className="fw-semibold">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.outstandingPayments
                                                    .sort((a, b) => b.days_overdue - a.days_overdue)
                                            .slice(0, 8)
                                                    .map((payment, index) => (
                                            <tr key={`${payment.type}-${payment.id}`}>
                                                        <td>
                                                            <Badge 
                                                                color={payment.type === 'sales' ? 'success' : 'primary'} 
                                                                className="badge-soft"
                                                            >
                                                        <i className={`ri-${payment.type === 'sales' ? 'arrow-up' : 'arrow-down'}-line me-1`}></i>
                                                                {payment.type}
                                                            </Badge>
                                                        </td>
                                                        <td>
                                                    <h6 className="mb-0 fw-medium">{payment.reference}</h6>
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
                                                    <Badge 
                                                        color={payment.days_overdue > 30 ? 'danger' : payment.days_overdue > 0 ? 'warning' : 'success'} 
                                                        className="badge-soft"
                                                    >
                                                        {payment.days_overdue > 30 ? 'Overdue' : payment.days_overdue > 0 ? 'Pending' : 'Current'}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <Button 
                                                        color="primary" 
                                                        size="sm" 
                                                        onClick={() => handleOutstandingPaymentClick(payment)}
                                                    >
                                                        <i className="ri-money-dollar-line me-1"></i>
                                                        Pay Now
                                                    </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardBody>
                            </Card>
                )}

                {/* No Outstanding Payments */}
                {preferences.showOutstandingPayments && analytics.outstandingPayments?.length === 0 && (
                    <Card className="mb-4">
                                <CardBody className="text-center py-4">
                            <i className="ri-checkbox-multiple-line display-4 text-success mb-3"></i>
                            <h5 className="text-success fw-semibold">All Payments Current</h5>
                            <p className="text-muted mb-3">No outstanding payments found. Excellent financial management!</p>
                            <Button color="outline-success" onClick={() => navigateToSection('payments')}>
                                <i className="ri-history-line me-1"></i>
                                        View Payment History
                                    </Button>
                                </CardBody>
                            </Card>
                )}

                {/* Modals */}
                <Modal isOpen={modals.filters} toggle={() => toggleModal('filters')} size="lg">
                    <ModalHeader toggle={() => toggleModal('filters')}>
                        <i className="ri-filter-line me-2"></i>
                        Dashboard Filters
                    </ModalHeader>
                    <ModalBody>
                        <DashboardFilters 
                            onFiltersChange={handleFiltersChange}
                            currentFilters={preferences.filters}
                            onRefresh={handleRefresh}
                        />
                    </ModalBody>
                </Modal>



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
                /* Professional Dashboard Styles */
                .metric-card {
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid var(--vz-border-color);
                }

                .metric-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                    border-color: var(--vz-primary);
                }

                .overview-card {
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid var(--vz-border-color);
                }

                .overview-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                    border-color: var(--vz-primary);
                }

                .metric-icon {
                    width: 2.25rem;
                    height: 2.25rem;
                    border-radius: 0.375rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                }

                .overview-icon {
                    width: 3rem;
                    height: 3rem;
                    border-radius: 0.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                }

                .activity-icon {
                    width: 2rem;
                    height: 2rem;
                    border-radius: 0.25rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.875rem;
                }

                .activity-item {
                    border-bottom: 1px solid var(--vz-border-color);
                    transition: all 0.2s ease;
                }

                .activity-item:last-child {
                    border-bottom: none;
                }

                .activity-item:hover {
                    background-color: var(--vz-light);
                    border-radius: 0.25rem;
                    margin: 0 -0.5rem;
                    padding-left: 0.5rem !important;
                    padding-right: 0.5rem !important;
                }

                .chart-container {
                    border: 1px solid var(--vz-border-color);
                    border-radius: 0.375rem;
                    padding: 1rem;
                    background: #fff;
                }

                .chart-title {
                    color: var(--vz-dark);
                    font-weight: 600;
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--vz-border-color);
                }

                .progress-sm {
                    height: 3px;
                    border-radius: 1.5px;
                }

                .badge-soft-sm {
                    font-size: 0.6875rem;
                    padding: 0.25rem 0.5rem;
                }

                .table-hover tbody tr:hover {
                    background-color: var(--vz-primary-bg-subtle);
                }

                .btn {
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .btn:hover {
                    transform: translateY(-1px);
                }

                .spin {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .fs-12 {
                    font-size: 0.75rem !important;
                }

                .fs-13 {
                    font-size: 0.8125rem !important;
                }

                .fs-14 {
                    font-size: 0.875rem !important;
                }

                .overflow-hidden {
                    overflow: hidden;
                }

                .text-truncate {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .cursor-pointer {
                    cursor: pointer;
                }

                .badge-soft {
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .badge-soft.cursor-pointer:hover {
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }

                /* Smooth transitions for all preference changes */
                .card, .chart-container, .activity-item {
                    transition: all 0.3s ease;
                }

                /* Compact mode styles */
                .compact-mode .card {
                    margin-bottom: 0.75rem;
                }

                .compact-mode .chart-container {
                    padding: 0.75rem;
                }

                .compact-mode .activity-item {
                    padding: 0.5rem 0;
                }

                /* Responsive Design */
                @media (max-width: 1200px) {
                    .chart-container {
                        margin-bottom: 1rem;
                    }
                }

                @media (max-width: 768px) {
                    .d-flex.gap-2 {
                        flex-wrap: wrap;
                        gap: 0.5rem !important;
                    }
                    
                    .metric-card:hover,
                    .overview-card:hover {
                        transform: none;
                    }
                    
                    .activity-item {
                        padding: 0.75rem 0;
                    }
                    
                    .chart-container {
                        padding: 0.75rem;
                    }
                }

                @media (max-width: 576px) {
                    .d-flex.align-items-center.gap-2 {
                        flex-direction: column;
                        align-items: stretch !important;
                    }
                    
                    .d-flex.align-items-center.gap-2 .btn {
                        margin-bottom: 0.25rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default BusinessDashboard; 
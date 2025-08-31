import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Badge } from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import { RiRefreshLine } from 'react-icons/ri';
import Loader from '../../Components/Common/Loader';
import { getBusinessAnalytics, getQuickStats } from '../../services/dashboard';
import useCompanySelectionState from '../../hooks/useCompanySelection';
import DashboardFilters from './DashboardFilters';

const BusinessDashboard = () => {
    const { selectedCompanyId } = useCompanySelectionState();
    const [state, setState] = useState({
        analytics: null,
        quickStats: null,
        loading: true,
        refreshing: false,
        filters: {}
    });

    const { analytics, quickStats, loading, refreshing, filters } = state;

    const fetchDashboardData = async (showRefreshing = false, customFilters = null) => {
        if (!selectedCompanyId) {
            console.log('❌ No company selected for dashboard');
            return;
        }

        const filtersToUse = customFilters || filters;
        console.log('🔍 Fetching dashboard data with filters:', filtersToUse);

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

    const handleRefresh = () => {
        fetchDashboardData(true);
    };

    const handleFiltersChange = (newFilters) => {
        console.log('🔍 Applying new filters:', newFilters);
        setState(prev => ({ ...prev, filters: newFilters }));
        // Pass the new filters directly to fetchDashboardData
        fetchDashboardData(false, newFilters);
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
                    <Card>
                        <CardBody className="text-center py-5">
                            <h5 className="text-muted">Please select a company to view analytics</h5>
                        </CardBody>
                    </Card>
                </Container>
            </div>
        );
    }

    // Only show data if we have valid responses from backend
    if (!analytics || !quickStats) {
        return (
            <div className="page-content">
                <Container fluid>
                    <Card>
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
                {/* Dashboard Filters */}
                <DashboardFilters 
                    onFiltersChange={handleFiltersChange}
                    currentFilters={filters}
                    onRefresh={handleRefresh}
                />

                {/* Financial Summary Cards - Using analytics.financialSummary data */}
                <Row className="mb-4">
                    <Col xl={2} md={6}>
                        <Card className="metric-card">
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-success-subtle d-flex align-items-center justify-content-center">
                                            <i className="ri-shopping-cart-line text-success fs-22"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="text-muted mb-1 fs-13">Total Sales</h6>
                                        <h4 className="mb-1">{formatCurrency(analytics.financialSummary.total_sales)}</h4>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_sales_count)} invoices</p>
                                        <div className="d-flex justify-content-between mt-1">
                                            <small className="text-success">
                                                Received: {formatCurrency(analytics.financialSummary.sales_received)}
                                            </small>
                                            <small className="text-warning">
                                                Pending: {formatCurrency(analytics.financialSummary.sales_pending)}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col xl={2} md={6}>
                        <Card className="metric-card">
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center">
                                            <i className="ri-shopping-bag-line text-primary fs-22"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="text-muted mb-1 fs-13">Total Purchases</h6>
                                        <h4 className="mb-1">{formatCurrency(analytics.financialSummary.total_purchases)}</h4>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_purchase_count)} invoices</p>
                                        <div className="d-flex justify-content-between mt-1">
                                            <small className="text-danger">
                                                Paid: {formatCurrency(analytics.financialSummary.purchases_paid)}
                                            </small>
                                            <small className="text-warning">
                                                Pending: {formatCurrency(analytics.financialSummary.purchases_pending)}
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col xl={2} md={6}>
                        <Card className="metric-card">
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-warning-subtle d-flex align-items-center justify-content-center">
                                            <i className="ri-money-dollar-box-line text-warning fs-22"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="text-muted mb-1 fs-13">Total Expenses</h6>
                                        <h4 className="mb-1">{formatCurrency(analytics.financialSummary.total_expenses)}</h4>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_expense_count)} entries</p>
                                        {(parseFloat(analytics.financialSummary.expenses_paid) > 0 || parseFloat(analytics.financialSummary.expenses_pending) > 0) && (
                                            <div className="d-flex justify-content-between mt-1">
                                                <small className="text-danger">
                                                    Paid: {formatCurrency(analytics.financialSummary.expenses_paid)}
                                                </small>
                                                <small className="text-warning">
                                                    Pending: {formatCurrency(analytics.financialSummary.expenses_pending)}
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col xl={2} md={6}>
                        <Card className="metric-card">
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-info-subtle d-flex align-items-center justify-content-center">
                                            <i className="ri-coins-line text-info fs-22"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="text-muted mb-1 fs-13">Other Income</h6>
                                        <h4 className="mb-1">{formatCurrency(analytics.financialSummary.total_incomes)}</h4>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(analytics.financialSummary.total_income_count)} entries</p>
                                        {(parseFloat(analytics.financialSummary.incomes_received) > 0 || parseFloat(analytics.financialSummary.incomes_pending) > 0) && (
                                            <div className="d-flex justify-content-between mt-1">
                                                <small className="text-success">
                                                    Received: {formatCurrency(analytics.financialSummary.incomes_received)}
                                                </small>
                                                <small className="text-warning">
                                                    Pending: {formatCurrency(analytics.financialSummary.incomes_pending)}
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col xl={2} md={6}>
                        <Card className="metric-card">
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avatar-sm rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center">
                                            <i className="ri-bank-line text-secondary fs-22"></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="text-muted mb-1 fs-13">Bank Balance</h6>
                                        <h4 className="mb-1">{formatCurrency(quickStats.total_balance)}</h4>
                                        <p className="text-muted mb-0 fs-11">{formatNumber(quickStats.active_bank_accounts)} accounts</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col xl={2} md={6}>
                        <Card className="metric-card">
                            <CardBody>
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className={`avatar-sm rounded-circle bg-${analytics.financialSummary.gross_profit >= 0 ? 'success' : 'danger'}-subtle d-flex align-items-center justify-content-center`}>
                                            <i className={`${analytics.financialSummary.gross_profit >= 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-${analytics.financialSummary.gross_profit >= 0 ? 'success' : 'danger'} fs-22`}></i>
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="text-muted mb-1 fs-13">Gross Profit</h6>
                                        <h4 className={`mb-1 ${analytics.financialSummary.gross_profit >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {formatCurrency(analytics.financialSummary.gross_profit)}
                                        </h4>
                                        <p className="text-muted mb-0 fs-11">Total profit</p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>

                {/* Today's Activity vs Monthly Comparison */}
                <Row className="mb-4">
                    <Col xl={6}>
                        <Card>
                            <CardHeader>
                                <h5 className="card-title mb-0">
                                    <i className="ri-calendar-check-line text-primary me-2"></i>
                                    Today's Activity
                                </h5>
                                <p className="text-muted mb-0">Today's transactions summary</p>
                            </CardHeader>
                            <CardBody>
                                <Row>
                                    <Col md={6}>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">Sales Today</h6>
                                            <h4 className="text-success mb-0">{formatCurrency(quickStats.today_sales)}</h4>
                                        </div>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">Purchases Today</h6>
                                            <h4 className="text-primary mb-0">{formatCurrency(quickStats.today_purchases)}</h4>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">Expenses Today</h6>
                                            <h4 className="text-warning mb-0">{formatCurrency(quickStats.today_expenses)}</h4>
                                        </div>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">Income Today</h6>
                                            <h4 className="text-info mb-0">{formatCurrency(quickStats.today_incomes)}</h4>
                                        </div>
                                    </Col>
                                </Row>
                                <div className="border-top pt-3">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="text-muted">Today's Net:</span>
                                        <span className={`fw-bold ${
                                            (parseFloat(quickStats.today_sales) + parseFloat(quickStats.today_incomes)) - 
                                            (parseFloat(quickStats.today_purchases) + parseFloat(quickStats.today_expenses)) >= 0 
                                            ? 'text-success' : 'text-danger'
                                        }`}>
                                            {formatCurrency(
                                                (parseFloat(quickStats.today_sales) + parseFloat(quickStats.today_incomes)) - 
                                                (parseFloat(quickStats.today_purchases) + parseFloat(quickStats.today_expenses))
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col xl={6}>
                        <Card>
                            <CardHeader>
                                <h5 className="card-title mb-0">
                                    <i className="ri-calendar-line text-info me-2"></i>
                                    Current Month vs Overall
                                </h5>
                                <p className="text-muted mb-0">Month performance comparison</p>
                            </CardHeader>
                            <CardBody>
                                <Row>
                                    <Col md={6}>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">This Month Sales</h6>
                                            <h4 className="text-success mb-0">{formatCurrency(quickStats.month_sales)}</h4>
                                            <small className="text-muted">
                                                vs Total: {formatCurrency(analytics.financialSummary.total_sales)}
                                            </small>
                                        </div>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">This Month Purchases</h6>
                                            <h4 className="text-primary mb-0">{formatCurrency(quickStats.month_purchases)}</h4>
                                            <small className="text-muted">
                                                vs Total: {formatCurrency(analytics.financialSummary.total_purchases)}
                                            </small>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">Collection Rate</h6>
                                            <h4 className="text-info mb-0">
                                                {analytics.financialSummary.total_sales > 0 
                                                    ? ((parseFloat(analytics.financialSummary.sales_received) / parseFloat(analytics.financialSummary.total_sales)) * 100).toFixed(1)
                                                    : 0}%
                                            </h4>
                                            <small className="text-muted">Sales collected</small>
                                        </div>
                                        <div className="mb-3">
                                            <h6 className="text-muted mb-1">Payment Rate</h6>
                                            <h4 className="text-warning mb-0">
                                                {analytics.financialSummary.total_purchases > 0 
                                                    ? ((parseFloat(analytics.financialSummary.purchases_paid) / parseFloat(analytics.financialSummary.total_purchases)) * 100).toFixed(1)
                                                    : 0}%
                                            </h4>
                                            <small className="text-muted">Suppliers paid</small>
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>



                {/* Business Statistics Summary */}
                <Row className="mb-4">
                    <Col xl={12}>
                        <Card>
                            <CardHeader>
                                <h5 className="card-title mb-0">
                                    <i className="ri-bar-chart-box-line text-success me-2"></i>
                                    Business Statistics Summary
                                </h5>
                                <p className="text-muted mb-0">Comprehensive business overview</p>
                            </CardHeader>
                            <CardBody>
                                <Row>
                                    <Col md={4}>
                                        <Card className="bg-light border-0">
                                            <CardBody className="text-center">
                                                <h6 className="text-muted mb-2">Cash Flow Analysis</h6>
                                                <h4 className={`mb-1 ${analytics.financialSummary.net_cash_flow >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {formatCurrency(analytics.financialSummary.net_cash_flow)}
                                                </h4>
                                                <small className="text-muted">Net Cash Flow</small>
                                                <div className="mt-2">
                                                    <Badge color={analytics.financialSummary.net_cash_flow >= 0 ? 'success' : 'danger'} className="badge-soft">
                                                        {analytics.financialSummary.net_cash_flow >= 0 ? 'Positive' : 'Negative'}
                                                    </Badge>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={4}>
                                        <Card className="bg-light border-0">
                                            <CardBody className="text-center">
                                                <h6 className="text-muted mb-2">Current Month</h6>
                                                <h4 className="text-success mb-1">{formatCurrency(quickStats.month_sales)}</h4>
                                                <small className="text-muted">Month Sales</small>
                                                <div className="mt-2">
                                                    <small className="text-muted">
                                                        {quickStats.month_sales > 0 ? 
                                                            `${((parseFloat(quickStats.month_sales) / parseFloat(analytics.financialSummary.total_sales)) * 100).toFixed(1)}% of total` :
                                                            'No sales this month'
                                                        }
                                                    </small>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={4}>
                                        <Card className="bg-light border-0">
                                            <CardBody className="text-center">
                                                <h6 className="text-muted mb-2">Business Data</h6>
                                                <div className="d-flex justify-content-between mb-1">
                                                    <small className="text-muted">Products:</small>
                                                    <span className="fw-semibold">{formatNumber(quickStats.total_products)}</span>
                                                </div>
                                                <div className="d-flex justify-content-between mb-1">
                                                    <small className="text-muted">Contacts:</small>
                                                    <span className="fw-semibold">{formatNumber(quickStats.total_contacts)}</span>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <small className="text-muted">Bank Accounts:</small>
                                                    <span className="fw-semibold">{formatNumber(quickStats.active_bank_accounts)}</span>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>



                {/* Top Products and Customers */}
                {(analytics.topProducts?.length > 0 || analytics.topCustomers?.length > 0) && (
                    <Row className="mb-4">
                        {analytics.topProducts?.length > 0 && (
                            <Col xl={6}>
                                <Card>
                                    <CardHeader>
                                        <h5 className="card-title mb-0">
                                            <i className="ri-trophy-line text-warning me-2"></i>
                                            Top Products
                                        </h5>
                                        <p className="text-muted mb-0">Best performing products by revenue</p>
                                    </CardHeader>
                                    <CardBody>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-nowrap mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Product</th>
                                                        <th>Revenue</th>
                                                        <th>Qty Sold</th>
                                                        <th>Invoices</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.topProducts.map((product, index) => (
                                                        <tr key={product.id}>
                                                            <td>
                                                                <div className="d-flex align-items-center">
                                                                    <Badge color={index === 0 ? 'warning' : index === 1 ? 'info' : 'secondary'} className="badge-soft me-2">
                                                                        #{index + 1}
                                                                    </Badge>
                                                                    <div>
                                                                        <h6 className="mb-0 fs-13">{product.name}</h6>
                                                                        <small className="text-muted">{product.itemcode}</small>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="fw-semibold text-success">
                                                                    {formatCurrency(product.total_sales_amount)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="fw-semibold">
                                                                    {formatNumber(product.total_quantity_sold)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="text-muted">
                                                                    {formatNumber(product.invoice_count)}
                                                                </span>
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
                            <Col xl={6}>
                                <Card>
                                    <CardHeader>
                                        <h5 className="card-title mb-0">
                                            <i className="ri-star-line text-info me-2"></i>
                                            Top Customers
                                        </h5>
                                        <p className="text-muted mb-0">Best customers by sales volume</p>
                                    </CardHeader>
                                    <CardBody>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-nowrap mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Customer</th>
                                                        <th>Total Sales</th>
                                                        <th>Invoices</th>
                                                        <th>Pending</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.topCustomers.map((customer, index) => (
                                                        <tr key={customer.id}>
                                                            <td>
                                                                <div className="d-flex align-items-center">
                                                                    <Badge color={index === 0 ? 'warning' : index === 1 ? 'info' : 'secondary'} className="badge-soft me-2">
                                                                        #{index + 1}
                                                                    </Badge>
                                                                    <div>
                                                                        <h6 className="mb-0 fs-13">{customer.name}</h6>
                                                                        {customer.gstin && (
                                                                            <small className="text-muted">{customer.gstin}</small>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="fw-semibold text-success">
                                                                    {formatCurrency(customer.total_sales)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="text-muted">
                                                                    {formatNumber(customer.invoice_count)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {parseFloat(customer.pending_amount) > 0 ? (
                                                                    <Badge color="warning" className="badge-soft-warning">
                                                                        {formatCurrency(customer.pending_amount)}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge color="success" className="badge-soft-success">
                                                                        Paid
                                                                    </Badge>
                                                                )}
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

                {/* Outstanding Payments - Only show if there are pending payments */}
                {analytics.outstandingPayments?.length > 0 && (
                    <Row>
                        <Col xl={12}>
                            <Card>
                                <CardHeader>
                                    <h5 className="card-title mb-0">
                                        <i className="ri-alert-line text-warning me-2"></i>
                                        Outstanding Payments
                                    </h5>
                                    <p className="text-muted mb-0">Pending and overdue transactions requiring attention</p>
                                </CardHeader>
                                <CardBody>
                                    <div className="table-responsive">
                                        <table className="table table-hover table-nowrap mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Reference</th>
                                                    <th>Contact</th>
                                                    <th>Amount</th>
                                                    <th>Date</th>
                                                    <th>Days Overdue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.outstandingPayments.map((payment, index) => (
                                                    <tr key={`${payment.type}-${payment.id}`}>
                                                        <td>
                                                            <Badge 
                                                                color={
                                                                    payment.type === 'sales' ? 'success' :
                                                                    payment.type === 'purchases' ? 'primary' :
                                                                    payment.type === 'expenses' ? 'warning' : 'info'
                                                                }
                                                                className="badge-soft"
                                                            >
                                                                {payment.type.toUpperCase()}
                                                            </Badge>
                                                        </td>
                                                        <td>
                                                            <span className="fw-semibold">{payment.reference}</span>
                                                        </td>
                                                        <td>
                                                            <span>{payment.contact_name || '—'}</span>
                                                        </td>
                                                        <td>
                                                            <span className="fw-semibold text-danger">
                                                                {formatCurrency(payment.amount)}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="text-muted">
                                                                {new Date(payment.date).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <Badge 
                                                                color={
                                                                    payment.days_overdue <= 0 ? 'success' :
                                                                    payment.days_overdue <= 7 ? 'warning' : 'danger'
                                                                }
                                                                className="badge-soft"
                                                            >
                                                                {payment.days_overdue <= 0 ? 'Current' : `${Math.floor(payment.days_overdue)} days`}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* Show message when all payments are up to date */}
                {analytics.outstandingPayments?.length === 0 && (
                    <Row>
                        <Col xl={12}>
                            <Card>
                                <CardBody className="text-center py-4">
                                    <i className="ri-checkbox-multiple-line text-success mb-3" style={{ fontSize: '3rem' }}></i>
                                    <h5 className="text-success">All Payments Up to Date!</h5>
                                    <p className="text-muted mb-0">No outstanding payments found. Great job!</p>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                )}
            </Container>

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .metric-card {
                    transition: transform 0.2s ease-in-out;
                    border: 1px solid rgba(0,0,0,0.05);
                }

                .metric-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
            `}</style>
        </div>
    );
};

export default BusinessDashboard; 
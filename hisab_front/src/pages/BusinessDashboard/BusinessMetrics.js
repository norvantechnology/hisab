import React from 'react';
import { Row, Col, Card, CardBody } from 'reactstrap';
import { RiArrowUpLine, RiArrowDownLine } from 'react-icons/ri';

const BusinessMetrics = ({ stats, formatCurrency, formatNumber }) => {
    const metrics = [
        {
            title: 'Total Sales',
            value: formatCurrency(stats.month_sales),
            icon: 'ri-shopping-cart-line',
            color: 'success',
            subValue: `${formatNumber(stats.total_sales_invoices)} invoices`,
            change: stats.today_sales > 0 ? `${formatCurrency(stats.today_sales)} today` : null
        },
        {
            title: 'Total Purchases', 
            value: formatCurrency(stats.month_purchases),
            icon: 'ri-shopping-bag-line',
            color: 'primary',
            subValue: `${formatNumber(stats.total_purchase_invoices)} invoices`,
            change: stats.today_purchases > 0 ? `${formatCurrency(stats.today_purchases)} today` : null
        },
        {
            title: 'Total Expenses',
            value: formatCurrency(stats.month_expenses),
            icon: 'ri-money-dollar-box-line',
            color: 'warning',
            subValue: `${formatNumber(stats.total_expense_count)} entries`,
            change: stats.today_expenses > 0 ? `${formatCurrency(stats.today_expenses)} today` : null
        },
        {
            title: 'Total Income',
            value: formatCurrency(stats.month_incomes),
            icon: 'ri-coins-line',
            color: 'info',
            subValue: `${formatNumber(stats.total_income_count)} entries`,
            change: stats.today_incomes > 0 ? `${formatCurrency(stats.today_incomes)} today` : null
        },
        {
            title: 'Bank Balance',
            value: formatCurrency(stats.total_balance),
            icon: 'ri-bank-line',
            color: stats.total_balance >= 0 ? 'success' : 'danger',
            subValue: `${formatNumber(stats.active_bank_accounts)} accounts`,
            change: null
        },
        {
            title: 'Monthly Profit',
            value: formatCurrency((stats.month_sales + stats.month_incomes) - (stats.month_purchases + stats.month_expenses)),
            icon: (stats.month_sales + stats.month_incomes) >= (stats.month_purchases + stats.month_expenses) ? 'ri-arrow-up-line' : 'ri-arrow-down-line',
            color: (stats.month_sales + stats.month_incomes) >= (stats.month_purchases + stats.month_expenses) ? 'success' : 'danger',
            subValue: 'This month',
            change: null
        }
    ];

    return (
        <Row className="mb-4">
            {metrics.map((metric, index) => (
                <Col xl={2} md={6} key={index}>
                    <Card className="metric-card">
                        <CardBody>
                            <div className="d-flex align-items-center">
                                <div className="flex-shrink-0">
                                    <div className={`avatar-sm rounded-circle bg-${metric.color}-subtle d-flex align-items-center justify-content-center`}>
                                        <i className={`${metric.icon} text-${metric.color} fs-22`}></i>
                                    </div>
                                </div>
                                <div className="flex-grow-1 ms-3">
                                    <h6 className="text-muted mb-1 fs-13">{metric.title}</h6>
                                    <h4 className="mb-1">{metric.value}</h4>
                                    <p className="text-muted mb-0 fs-11">{metric.subValue}</p>
                                    {metric.change && (
                                        <small className="text-success">
                                            <RiArrowUpLine className="me-1" />
                                            {metric.change}
                                        </small>
                                    )}
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
            ))}
        </Row>
    );
};

export default BusinessMetrics; 
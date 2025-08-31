import React from 'react';
import { Card, CardBody, CardHeader, Badge } from 'reactstrap';

const TopCustomers = ({ customers, formatCurrency, formatNumber }) => {
    return (
        <Card>
            <CardHeader>
                <h5 className="card-title mb-0">
                    <i className="ri-star-line text-info me-2"></i>
                    Top Customers
                </h5>
                <p className="text-muted mb-0">Customers by sales volume</p>
            </CardHeader>
            <CardBody>
                {customers && customers.length > 0 ? (
                    <div className="table-responsive">
                        <table className="table table-sm table-nowrap mb-0">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Customer</th>
                                    <th>Sales</th>
                                    <th>Pending</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.slice(0, 8).map((customer, index) => (
                                    <tr key={customer.id}>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                <div className={`avatar-xs rounded-circle bg-${
                                                    index === 0 ? 'warning' : 
                                                    index === 1 ? 'info' : 
                                                    index === 2 ? 'success' : 'secondary'
                                                }-subtle d-flex align-items-center justify-content-center me-2`}>
                                                    <span className={`text-${
                                                        index === 0 ? 'warning' : 
                                                        index === 1 ? 'info' : 
                                                        index === 2 ? 'success' : 'secondary'
                                                    } fs-12 fw-bold`}>
                                                        #{index + 1}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <h6 className="mb-0 fs-13">{customer.name}</h6>
                                                {customer.gstin && (
                                                    <small className="text-muted">{customer.gstin}</small>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="fw-semibold text-success">
                                                {formatCurrency(customer.total_sales)}
                                            </span>
                                            <br />
                                            <small className="text-muted">
                                                {formatNumber(customer.invoice_count)} invoices
                                            </small>
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
                ) : (
                    <div className="text-center py-4">
                        <i className="ri-star-line text-muted mb-3" style={{ fontSize: '2rem' }}></i>
                        <h6 className="text-muted">No customer data available</h6>
                        <p className="text-muted mb-0 fs-12">Add customers and record sales to see analytics</p>
                    </div>
                )}
            </CardBody>
        </Card>
    );
};

export default TopCustomers; 
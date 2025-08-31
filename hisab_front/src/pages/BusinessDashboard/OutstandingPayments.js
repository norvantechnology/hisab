import React from 'react';
import { Card, CardBody, CardHeader, Badge } from 'reactstrap';

const OutstandingPayments = ({ payments, formatCurrency }) => {
    return (
        <Card>
            <CardHeader>
                <h5 className="card-title mb-0">
                    <i className="ri-alert-line text-warning me-2"></i>
                    Outstanding Payments
                </h5>
                <p className="text-muted mb-0">Pending and overdue transactions</p>
            </CardHeader>
            <CardBody>
                {payments && payments.length > 0 ? (
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
                                {payments.map((payment, index) => (
                                    <tr key={payment.type + '-' + payment.id}>
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
                                                {new Date(payment.date).toLocaleDateString()}
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
                                                {payment.days_overdue <= 0 ? 'Current' : Math.floor(payment.days_overdue) + ' days'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <i className="ri-checkbox-multiple-line text-success mb-3" style={{ fontSize: '3rem' }}></i>
                        <h6 className="text-success">All Payments Up to Date!</h6>
                        <p className="text-muted mb-0">No outstanding payments found</p>
                    </div>
                )}
            </CardBody>
        </Card>
    );
};

export default OutstandingPayments;

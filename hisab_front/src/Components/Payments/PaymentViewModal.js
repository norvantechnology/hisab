import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Table, Card, CardBody, Row, Col, Alert } from 'reactstrap';
import { RiErrorWarningLine, RiBankLine, RiShoppingCartLine, RiWalletLine, RiStoreLine, RiFileTextLine, RiUserLine, RiCalendarLine } from 'react-icons/ri';

const PaymentViewModal = ({ isOpen, toggle, payment }) => {
    // Helper functions
    const parseAmount = (amount) => parseFloat(amount) || 0;
    const formatAmount = (amount) => parseAmount(amount).toFixed(2);

    const getTransactionTypeDisplay = (transaction) => {
        const type = transaction.allocationType || transaction.type || 'purchase';
        
        switch (type) {
            case 'current-balance':
                return {
                    icon: <RiWalletLine className="me-1" size={14} />,
                    label: 'Current Balance',
                    color: 'info'
                };
            case 'purchase':
                return {
                    icon: <RiShoppingCartLine className="me-1" size={14} />,
                    label: 'Purchase',
                    color: 'warning'
                };
            case 'sale':
                return {
                    icon: <RiStoreLine className="me-1" size={14} />,
                    label: 'Sale',
                    color: 'success'
                };
            case 'expense':
                return {
                    icon: <RiBankLine className="me-1" size={14} />,
                    label: 'Expense',
                    color: 'danger'
                };
            case 'income':
                return {
                    icon: <RiBankLine className="me-1" size={14} />,
                    label: 'Income',
                    color: 'success'
                };
            default:
                return {
                    icon: <RiShoppingCartLine className="me-1" size={14} />,
                    label: 'Transaction',
                    color: 'secondary'
                };
        }
    };

    // Calculate payment summary
    const calculatePaymentSummary = () => {
        if (!payment) return {};

        const baseAmount = parseAmount(payment.amount);
        const adjustmentValue = parseAmount(payment.adjustmentValue);

        let totalDeducted = baseAmount;
        let allocatableAmount = baseAmount;
        let adjustmentImpact = { label: 'No adjustment', amount: 0 };

        if (payment.adjustmentType !== 'none' && adjustmentValue > 0) {
            if (payment.adjustmentType === 'discount') {
                allocatableAmount = baseAmount + adjustmentValue;
                adjustmentImpact = {
                    label: `Discount (+₹${formatAmount(adjustmentValue)})`,
                    amount: adjustmentValue
                };
            } else {
                totalDeducted = baseAmount + adjustmentValue;
                adjustmentImpact = {
                    label: payment.adjustmentType === 'surcharge'
                        ? `Surcharge (+₹${formatAmount(adjustmentValue)})`
                        : `Extra Receipt (+₹${formatAmount(adjustmentValue)})`,
                    amount: adjustmentValue
                };
            }
        }

        const totalAllocated = payment.transactions?.reduce((sum, t) => sum + parseAmount(t.amount), 0) || 0;
        const remainingAmount = allocatableAmount - totalAllocated;
        const isBalanced = Math.abs(remainingAmount) < 0.01;

        return {
            baseAmount,
            adjustmentImpact,
            totalDeducted,
            allocatableAmount,
            totalAllocated,
            remainingAmount,
            isBalanced
        };
    };

    const paymentSummary = calculatePaymentSummary();

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="xl">
            <ModalHeader toggle={toggle} className="bg-light">
                <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center">
                        <RiWalletLine className="text-primary me-2" size={20} />
                        Payment Details
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <Badge color="info" className="badge-soft-info">
                            {payment?.paymentNumber || 'N/A'}
                        </Badge>
                        <Badge color={payment?.status === 'completed' ? 'success' : 'secondary'}
                               className={`badge-soft-${payment?.status === 'completed' ? 'success' : 'secondary'}`}>
                            {payment?.status?.charAt(0).toUpperCase() + payment?.status?.slice(1) || 'N/A'}
                        </Badge>
                    </div>
                </div>
            </ModalHeader>
            <ModalBody className="p-3">
                {payment && (
                    <div>
                        {/* Header Summary Card */}
                        <Card className="border-0 shadow-sm mb-3">
                            <CardBody className="bg-light">
                                <Row className="align-items-center">
                                    <Col md={2}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Date</h6>
                                            <div className="fw-bold text-dark">
                                                {new Date(payment.date).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Contact</h6>
                                            <Badge color="warning" className="badge-soft-warning px-2 py-1">
                                                {payment.contactName || 'N/A'}
                                            </Badge>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Bank Account</h6>
                                            <Badge color="success" className="badge-soft-success px-2 py-1">
                                                {payment.bankName || 'N/A'}
                                            </Badge>
                                        </div>
                                    </Col>
                                    <Col md={2}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Type</h6>
                                            <Badge color={payment.type === 'receivable' ? 'danger' : 'info'}
                                                   className={`badge-soft-${payment.type === 'receivable' ? 'danger' : 'info'} px-2 py-1`}>
                                                {payment.type === 'receivable' ? 'Receivable' : 'Payable'}
                                            </Badge>
                                        </div>
                                    </Col>
                                    <Col md={2}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Base Amount</h6>
                                            <div className="fw-bold text-primary fs-5">
                                                ₹{formatAmount(paymentSummary.baseAmount)}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        {/* Payment Summary - Compact Version */}
                        <Card className="border-0 shadow-sm mb-3">
                            <CardBody>
                                <h6 className="card-title text-muted mb-3">
                                    <RiBankLine className="me-2" />
                                    Payment Summary
                                </h6>
                                <Row className="text-center">
                                    <Col md={3}>
                                        <div className="border-end">
                                            <div className="text-muted small">Adjustment</div>
                                            <div className="h6 mb-0 text-info">
                                                {paymentSummary.adjustmentImpact.amount > 0 ? '+' : ''}₹{formatAmount(Math.abs(paymentSummary.adjustmentImpact.amount))}
                                            </div>
                                            <small className="text-muted">{paymentSummary.adjustmentImpact.label}</small>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="border-end">
                                            <div className="text-muted small">Total Deducted</div>
                                            <div className="h6 mb-0 text-danger">
                                                ₹{formatAmount(paymentSummary.totalDeducted)}
                                            </div>
                                            <small className="text-muted">From bank account</small>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="border-end">
                                            <div className="text-muted small">Allocatable</div>
                                            <div className="h6 mb-0 text-info">
                                                ₹{formatAmount(paymentSummary.allocatableAmount)}
                                            </div>
                                            <small className="text-muted">For transactions</small>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div>
                                            <div className="text-muted small">Remaining</div>
                                            <div className={`h6 mb-0 ${paymentSummary.remainingAmount < 0 ? 'text-danger' :
                                                paymentSummary.remainingAmount > 0 ? 'text-warning' : 'text-success'}`}>
                                                ₹{formatAmount(Math.abs(paymentSummary.remainingAmount))}
                                                {paymentSummary.remainingAmount < 0 ? ' (Over)' : ''}
                                            </div>
                                            <small className={`${paymentSummary.isBalanced ? 'text-success' : 'text-warning'}`}>
                                                {paymentSummary.isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
                                            </small>
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        {/* Description and Adjustment Details */}
                        <Row className="g-3 mb-3">
                            <Col md={payment.adjustmentType !== 'none' ? 6 : 12}>
                                <Card className="border-0 shadow-sm h-100">
                                    <CardBody>
                                        <h6 className="card-title text-muted mb-3">
                                            <RiFileTextLine className="me-2" />
                                            Description
                                        </h6>
                                        <div className="bg-light rounded p-3">
                                            <p className="mb-0">{payment.description || 'No description provided'}</p>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>

                            {/* Adjustment Details - Only show if there's an adjustment */}
                            {payment.adjustmentType !== 'none' && (
                                <Col md={6}>
                                    <Card className="border-0 shadow-sm h-100">
                                        <CardBody>
                                            <h6 className="card-title text-muted mb-3">
                                                <RiWalletLine className="me-2" />
                                                Adjustment Details
                                            </h6>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <div className="fw-medium">
                                                        {payment.adjustmentType === 'discount' ? 'Discount' :
                                                            payment.adjustmentType === 'extra_receipt' ? 'Extra Receipt' :
                                                                payment.adjustmentType === 'surcharge' ? 'Surcharge' : 'N/A'}
                                                    </div>
                                                    <small className="text-muted">Adjustment type</small>
                                                </div>
                                                <div className="text-end">
                                                    <div className="fw-bold text-primary">
                                                        ₹{formatAmount(payment.adjustmentValue || 0)}
                                                    </div>
                                                    <small className="text-muted">Value</small>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </Col>
                            )}
                        </Row>

                        {/* Transactions Table */}
                        <Card className="border-0 shadow-sm mb-3">
                            <CardBody>
                                <h6 className="card-title text-muted mb-3">
                                    <RiShoppingCartLine className="me-2" />
                                    Applied Transactions ({payment.transactions?.length || 0})
                                </h6>
                                {payment.transactions?.length > 0 ? (
                                    <div className="table-responsive">
                                        <Table className="table-sm">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Description</th>
                                                    <th className="text-center">Date</th>
                                                    <th className="text-center">Type</th>
                                                    <th className="text-center">Balance Type</th>
                                                    <th className="text-end">Original Amount</th>
                                                    <th className="text-end">Allocated Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {payment.transactions.map((transaction, index) => {
                                                    const typeDisplay = getTransactionTypeDisplay(transaction);
                                                    return (
                                                        <tr key={transaction.transactionId || index}>
                                                            <td>
                                                                <div className="fw-medium">{transaction.description || 'N/A'}</div>
                                                            </td>
                                                            <td className="text-center">
                                                                <small>{transaction.date ? new Date(transaction.date).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                }) : 'N/A'}</small>
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge color={typeDisplay.color} className={`badge-soft-${typeDisplay.color} d-flex align-items-center justify-content-center`} style={{ width: 'fit-content', margin: '0 auto' }}>
                                                                    {typeDisplay.icon}
                                                                    <small>{typeDisplay.label}</small>
                                                                </Badge>
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge color={transaction.balanceType === 'payable' ? 'warning' : 'success'}
                                                                       className={`badge-soft-${transaction.balanceType === 'payable' ? 'warning' : 'success'}`}>
                                                                    <small>{transaction.balanceType === 'payable' ? 'Payable' : 'Receivable'}</small>
                                                                </Badge>
                                                            </td>
                                                            <td className="text-end">₹{formatAmount(transaction.originalAmount)}</td>
                                                            <td className="text-end fw-bold">₹{formatAmount(transaction.amount)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted">
                                        <RiFileTextLine size={32} className="mb-2" />
                                        <div>No transactions applied to this payment</div>
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        {/* Unbalanced Warning */}
                        {payment.transactions?.length > 0 && !paymentSummary.isBalanced && (
                            <Alert color="warning" className="mb-3">
                                <RiErrorWarningLine className="me-2" />
                                The allocated amounts don't match the allocatable amount.
                            </Alert>
                        )}

                        {/* Contact Billing Address - Only show if exists */}
                        {(payment.contactBillingAddress1 || payment.contactBillingCity || payment.contactBillingState) && (
                            <Card className="border-0 shadow-sm mb-3">
                                <CardBody>
                                    <h6 className="card-title text-muted mb-3">
                                        <i className="ri-map-pin-line me-2"></i>
                                        Contact Billing Address
                                    </h6>
                                    <div className="bg-light rounded p-3">
                                        <address className="mb-0">
                                            {payment.contactBillingAddress1 && (
                                                <div>{payment.contactBillingAddress1}</div>
                                            )}
                                            {payment.contactBillingAddress2 && (
                                                <div>{payment.contactBillingAddress2}</div>
                                            )}
                                            <div>
                                                {[
                                                    payment.contactBillingCity,
                                                    payment.contactBillingState,
                                                    payment.contactBillingPincode
                                                ].filter(Boolean).join(', ')}
                                            </div>
                                            {payment.contactBillingCountry && (
                                                <div>{payment.contactBillingCountry}</div>
                                            )}
                                        </address>
                                    </div>
                                </CardBody>
                            </Card>
                        )}

                        {/* Metadata Card */}
                        <Card className="border-0 shadow-sm">
                            <CardBody className="bg-light">
                                <h6 className="card-title text-muted mb-3">
                                    <RiUserLine className="me-2" />
                                    Record Information
                                </h6>
                                <Row>
                                    <Col md={payment.updatedAt ? 6 : 12}>
                                        <div className="text-center">
                                            <label className="form-label text-muted small">Created By</label>
                                            <div className="fw-medium">{payment.createdByName || 'System'}</div>
                                            <small className="text-muted">
                                                {new Date(payment.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </small>
                                        </div>
                                    </Col>
                                    {payment.updatedAt && (
                                        <Col md={6}>
                                            <div className="text-center">
                                                <label className="form-label text-muted small">Last Updated By</label>
                                                <div className="fw-medium">{payment.updatedByName || 'N/A'}</div>
                                                <small className="text-muted">
                                                    {new Date(payment.updatedAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </small>
                                            </div>
                                        </Col>
                                    )}
                                </Row>
                            </CardBody>
                        </Card>
                    </div>
                )}
            </ModalBody>
            <ModalFooter className="bg-light">
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default PaymentViewModal;
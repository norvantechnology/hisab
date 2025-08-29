import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Table, Card, CardBody, Row, Col, Alert } from 'reactstrap';
import { RiErrorWarningLine, RiBankLine, RiShoppingCartLine, RiWalletLine, RiStoreLine } from 'react-icons/ri';

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
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle}>Payment Details</ModalHeader>
            <ModalBody>
                {payment && (
                    <div>
                        {/* Basic Information */}
                        <Row>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Payment Number</h6>
                                    <p>
                                        <Badge color="info" className="badge-soft-info">
                                            {payment.paymentNumber || 'N/A'}
                                        </Badge>
                                    </p>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Date</h6>
                                    <p>{new Date(payment.date).toLocaleDateString()}</p>
                                </div>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Contact</h6>
                                    <p>
                                        <Badge color="warning" className="badge-soft-warning">
                                            {payment.contactName || 'N/A'}
                                        </Badge>
                                    </p>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Bank Account</h6>
                                    <p>
                                        <Badge color="success" className="badge-soft-success">
                                            {payment.bankName || 'N/A'}
                                        </Badge>
                                        {payment.accountNumber && (
                                            <small className="text-muted d-block">{payment.accountNumber}</small>
                                        )}
                                    </p>
                                </div>
                            </Col>
                        </Row>

                        {/* Contact Billing Address */}
                        {(payment.contactBillingAddress1 || payment.contactBillingCity || payment.contactBillingState) && (
                            <Row>
                                <Col md={12}>
                                    <div className="mb-3">
                                        <h6 className="text-muted">
                                            <i className="ri-map-pin-line me-2"></i>
                                            Contact Billing Address
                                        </h6>
                                        <div className="border rounded p-3 bg-light">
                                            {payment.contactBillingAddress1 && (
                                                <div className="mb-1">{payment.contactBillingAddress1}</div>
                                            )}
                                            {payment.contactBillingAddress2 && (
                                                <div className="mb-1">{payment.contactBillingAddress2}</div>
                                            )}
                                            <div className="mb-1">
                                                {[
                                                    payment.contactBillingCity,
                                                    payment.contactBillingState,
                                                    payment.contactBillingPincode
                                                ].filter(Boolean).join(', ')}
                                            </div>
                                            {payment.contactBillingCountry && (
                                                <div>{payment.contactBillingCountry}</div>
                                            )}
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        )}

                        <Row>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Type</h6>
                                    <p>
                                        <Badge color={payment.type === 'receivable' ? 'danger' : 'info'}
                                            className={`badge-soft-${payment.type === 'receivable' ? 'danger' : 'info'}`}>
                                            {payment.type === 'receivable' ? 'Receivable' : 'Payable'}
                                        </Badge>
                                    </p>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Status</h6>
                                    <p>
                                        <Badge color={payment.status === 'completed' ? 'success' : 'secondary'}
                                            className={`badge-soft-${payment.status === 'completed' ? 'success' : 'secondary'}`}>
                                            {payment.status?.charAt(0).toUpperCase() + payment.status?.slice(1) || 'N/A'}
                                        </Badge>
                                    </p>
                                </div>
                            </Col>
                        </Row>

                        {/* Payment Summary */}
                        <Card className="mb-3">
                            <CardBody className="bg-light">
                                <h6 className="mb-3">Payment Summary</h6>
                                <Row>
                                    <Col md={3} className="mb-2">
                                        <div className="text-center">
                                            <div className="text-muted small">Base Amount</div>
                                            <div className="h5 mb-0 text-primary font-weight-bold">
                                                ₹{formatAmount(paymentSummary.baseAmount)}
                                            </div>
                                            <small className="text-muted">Base payment</small>
                                        </div>
                                    </Col>
                                    <Col md={3} className="mb-2">
                                        <div className="text-center">
                                            <div className="text-muted small">Adjustment</div>
                                            <div className="h5 mb-0">
                                                {paymentSummary.adjustmentImpact.amount > 0 ? '+' : ''}
                                                ₹{formatAmount(Math.abs(paymentSummary.adjustmentImpact.amount))}
                                            </div>
                                            <small className="text-muted">{paymentSummary.adjustmentImpact.label}</small>
                                        </div>
                                    </Col>
                                    <Col md={3} className="mb-2">
                                        <div className="text-center">
                                            <div className="text-muted small">Total Deducted</div>
                                            <div className="h5 mb-0 text-danger">
                                                ₹{formatAmount(paymentSummary.totalDeducted)}
                                            </div>
                                            <small className="text-muted">From bank account</small>
                                        </div>
                                    </Col>
                                    <Col md={3} className="mb-2">
                                        <div className="text-center">
                                            <div className="text-muted small">Allocatable Amount</div>
                                            <div className="h5 mb-0 text-info">
                                                ₹{formatAmount(paymentSummary.allocatableAmount)}
                                            </div>
                                            <small className="text-muted">For transactions</small>
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        {/* Adjustment Details */}
                        {payment.adjustmentType !== 'none' && (
                            <div className="mb-3">
                                <Row>
                                    <Col md={6}>
                                        <h6 className="text-muted">Adjustment Type</h6>
                                        <p>
                                            {payment.adjustmentType === 'discount' ? 'Discount' :
                                                payment.adjustmentType === 'extra_receipt' ? 'Extra Receipt' :
                                                    payment.adjustmentType === 'surcharge' ? 'Surcharge' : 'N/A'}
                                        </p>
                                    </Col>
                                    <Col md={6}>
                                        <h6 className="text-muted">Adjustment Value</h6>
                                        <p>₹{formatAmount(payment.adjustmentValue || 0)}</p>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        {/* Description */}
                        <div className="mb-3">
                            <h6 className="text-muted">Description</h6>
                            <p>{payment.description || 'No description provided'}</p>
                        </div>

                        {/* Transactions */}
                        <div className="mb-3">
                            <h6 className="text-muted">Applied Transactions</h6>
                            {payment.transactions?.length > 0 ? (
                                <Table bordered responsive>
                                    <thead>
                                        <tr>
                                            <th>Description</th>
                                            <th>Date</th>
                                            <th>Transaction Type</th>
                                            <th>Balance Type</th>
                                            <th>Original Amount</th>
                                            <th>Allocated Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payment.transactions.map((transaction) => {
                                            const typeDisplay = getTransactionTypeDisplay(transaction);
                                            return (
                                                <tr key={transaction.transactionId}>
                                                    <td>{transaction.description || 'N/A'}</td>
                                                    <td>{transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}</td>
                                                    <td>
                                                        <Badge color={typeDisplay.color} className="d-flex align-items-center w-fit">
                                                            {typeDisplay.icon}
                                                            {typeDisplay.label}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        <Badge color={transaction.balanceType === 'payable' ? 'warning' : 'success'}>
                                                            {transaction.balanceType === 'payable' ? 'Payable' : 'Receivable'}
                                                        </Badge>
                                                    </td>
                                                    <td>₹{formatAmount(transaction.originalAmount)}</td>
                                                    <td>₹{formatAmount(transaction.amount)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            ) : (
                                <p className="text-muted">No transactions applied to this payment</p>
                            )}
                        </div>

                        {/* Allocation Summary */}
                        {payment.transactions?.length > 0 && (
                            <Card className="mb-3">
                                <CardBody className="bg-light">
                                    <h6 className="mb-3">Allocation Summary</h6>
                                    <Row>
                                        <Col md={3} className="mb-2">
                                            <div className="text-center">
                                                <div className="text-muted small">Allocatable Amount</div>
                                                <div className="h5 mb-0 text-primary">
                                                    ₹{formatAmount(paymentSummary.allocatableAmount)}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col md={3} className="mb-2">
                                            <div className="text-center">
                                                <div className="text-muted small">Total Allocated</div>
                                                <div className="h5 mb-0">
                                                    ₹{formatAmount(paymentSummary.totalAllocated)}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col md={3} className="mb-2">
                                            <div className="text-center">
                                                <div className="text-muted small">Remaining</div>
                                                <div className={`h5 mb-0 ${paymentSummary.remainingAmount < 0 ? 'text-danger' :
                                                    paymentSummary.remainingAmount > 0 ? 'text-warning' : 'text-success'}`}>
                                                    ₹{formatAmount(Math.abs(paymentSummary.remainingAmount))}
                                                    {paymentSummary.remainingAmount < 0 ? ' (Over)' : ''}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col md={3} className="mb-2">
                                            <div className="text-center">
                                                <div className="text-muted small">Status</div>
                                                <div className={`h5 mb-0 ${paymentSummary.isBalanced ? 'text-success' : 'text-warning'}`}>
                                                    {paymentSummary.isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                </CardBody>
                            </Card>
                        )}

                        {/* Unbalanced Warning */}
                        {payment.transactions?.length > 0 && !paymentSummary.isBalanced && (
                            <Alert color="warning" className="mt-3">
                                <RiErrorWarningLine className="me-2" />
                                The allocated amounts don't match the allocatable amount.
                            </Alert>
                        )}

                        {/* Metadata */}
                        <div className="mt-4 pt-3 border-top">
                            <Row>
                                <Col md={6}>
                                    <div className="mb-3">
                                        <h6 className="text-muted">Created By</h6>
                                        <p>{payment.createdByName || 'System'}</p>
                                    </div>
                                </Col>
                                <Col md={6}>
                                    <div className="mb-3">
                                        <h6 className="text-muted">Created At</h6>
                                        <p>{new Date(payment.createdAt).toLocaleString()}</p>
                                    </div>
                                </Col>
                            </Row>
                            {payment.updatedAt && (
                                <Row>
                                    <Col md={6}>
                                        <div className="mb-3">
                                            <h6 className="text-muted">Last Updated By</h6>
                                            <p>{payment.updatedByName || 'N/A'}</p>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="mb-3">
                                            <h6 className="text-muted">Last Updated At</h6>
                                            <p>{new Date(payment.updatedAt).toLocaleString()}</p>
                                        </div>
                                    </Col>
                                </Row>
                            )}
                        </div>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default PaymentViewModal;
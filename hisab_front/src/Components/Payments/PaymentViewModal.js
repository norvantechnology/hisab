import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Table, Card, CardBody, Row, Col, Alert } from 'reactstrap';
import { RiErrorWarningLine, RiBankLine, RiShoppingCartLine, RiWalletLine, RiStoreLine, RiFileTextLine, RiUserLine, RiCalendarLine, RiCashLine, RiMapPinLine } from 'react-icons/ri';

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
        <Modal isOpen={isOpen} toggle={toggle} size="lg" className="payment-view-modal">
            <ModalHeader toggle={toggle} className="pb-2">
                    <div className="d-flex align-items-center">
                    <div className="rounded bg-primary-subtle d-flex align-items-center justify-content-center me-2" style={{width: '1.75rem', height: '1.75rem'}}>
                        <RiCashLine className="text-primary" size={16} />
                    </div>
                    <div>
                        <h5 className="modal-title mb-0">Payment Details</h5>
                        <p className="text-muted mb-0 small">
                            {payment?.paymentNumber || 'Payment Information'} • 
                            <span className="ms-1">
                            {payment?.status?.charAt(0).toUpperCase() + payment?.status?.slice(1) || 'N/A'}
                            </span>
                        </p>
                    </div>
                </div>
            </ModalHeader>
            <ModalBody className="py-3">
                {payment && (
                    <div>
                        {/* Compact Payment Header */}
                        <div className="bg-light rounded p-3 mb-3 border">
                                <Row className="align-items-center">
                                <Col md={8}>
                                    <div className="d-flex flex-wrap gap-2 align-items-center">
                                        <Badge color="light" className="px-2 py-1" style={{backgroundColor: 'var(--vz-light-bg-subtle)', color: 'var(--vz-secondary-color)', border: '1px solid var(--vz-border-color)', fontWeight: '500', fontSize: '0.75rem'}}>
                                                {new Date(payment.date).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                        </Badge>
                                        <Badge color="light" className="px-2 py-1" style={{backgroundColor: 'var(--vz-light-bg-subtle)', color: 'var(--vz-secondary-color)', border: '1px solid var(--vz-border-color)', fontWeight: '500', fontSize: '0.75rem'}}>
                                                {payment.contactName || 'N/A'}
                                            </Badge>
                                        <Badge color="light" className="px-2 py-1" style={{backgroundColor: 'var(--vz-light-bg-subtle)', color: 'var(--vz-secondary-color)', border: '1px solid var(--vz-border-color)', fontWeight: '500', fontSize: '0.75rem'}}>
                                                {payment.bankName || 'N/A'}
                                            </Badge>
                                        <Badge color={payment.type === 'receivable' ? 'success' : 'warning'} className="badge-soft px-2 py-1">
                                                {payment.type === 'receivable' ? 'Receivable' : 'Payable'}
                                            </Badge>
                                        </div>
                                    </Col>
                                <Col md={4}>
                                    <div className="text-end">
                                        <div className="text-muted small mb-1">Amount</div>
                                        <div className="h3 text-success fw-bold mb-0">
                                                ₹{formatAmount(paymentSummary.baseAmount)}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                        </div>

                        {/* Separator Line */}
                        <hr style={{border: 'none', height: '1px', background: 'linear-gradient(90deg, transparent, var(--vz-border-color), transparent)', margin: '1.5rem 0', opacity: '0.6'}} />

                        {/* Compact Payment Summary */}
                        <div className="mb-3" style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', marginBottom: '0'}}>
                            <h6 className="mb-3" style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 1rem 0'}}>
                                <RiBankLine className="me-1" size={14} />
                                    Payment Summary
                                </h6>
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem'}}>
                                <div style={{textAlign: 'center', padding: '1rem 0.75rem', background: 'var(--vz-light-bg-subtle)', borderRadius: '8px', border: '1px solid var(--vz-border-color)', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)', transition: 'transform 0.2s ease, box-shadow 0.2s ease'}}>
                                    <div style={{fontSize: '0.75rem', color: 'var(--vz-secondary-color)', fontWeight: '500', marginBottom: '0.25rem'}}>Adjustment</div>
                                    <div className="text-info" style={{fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem'}}>
                                                {paymentSummary.adjustmentImpact.amount > 0 ? '+' : ''}₹{formatAmount(Math.abs(paymentSummary.adjustmentImpact.amount))}
                                            </div>
                                    <div style={{fontSize: '0.7rem', color: 'var(--vz-secondary-color)'}}>{paymentSummary.adjustmentImpact.label}</div>
                                        </div>
                                <div style={{textAlign: 'center', padding: '1rem 0.75rem', background: 'var(--vz-light-bg-subtle)', borderRadius: '8px', border: '1px solid var(--vz-border-color)', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)', transition: 'transform 0.2s ease, box-shadow 0.2s ease'}}>
                                    <div style={{fontSize: '0.75rem', color: 'var(--vz-secondary-color)', fontWeight: '500', marginBottom: '0.25rem'}}>Total Deducted</div>
                                                                         <div className="text-danger" style={{fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem'}}>
                                                ₹{formatAmount(paymentSummary.totalDeducted)}
                                            </div>
                                    <div style={{fontSize: '0.7rem', color: 'var(--vz-secondary-color)'}}>From bank account</div>
                                        </div>
                                <div style={{textAlign: 'center', padding: '1rem 0.75rem', background: 'var(--vz-light-bg-subtle)', borderRadius: '8px', border: '1px solid var(--vz-border-color)', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)', transition: 'transform 0.2s ease, box-shadow 0.2s ease'}}>
                                    <div style={{fontSize: '0.75rem', color: 'var(--vz-secondary-color)', fontWeight: '500', marginBottom: '0.25rem'}}>Allocatable</div>
                                                                         <div className="text-info" style={{fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem'}}>
                                                ₹{formatAmount(paymentSummary.allocatableAmount)}
                                            </div>
                                    <div style={{fontSize: '0.7rem', color: 'var(--vz-secondary-color)'}}>For transactions</div>
                                        </div>
                                <div style={{textAlign: 'center', padding: '1rem 0.75rem', background: 'var(--vz-light-bg-subtle)', borderRadius: '8px', border: '1px solid var(--vz-border-color)', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)', transition: 'transform 0.2s ease, box-shadow 0.2s ease'}}>
                                    <div style={{fontSize: '0.75rem', color: 'var(--vz-secondary-color)', fontWeight: '500', marginBottom: '0.25rem'}}>Remaining</div>
                                                                         <div className={`${paymentSummary.remainingAmount < 0 ? 'text-danger' :
                                                paymentSummary.remainingAmount > 0 ? 'text-warning' : 'text-success'}`} style={{fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem'}}>
                                                ₹{formatAmount(Math.abs(paymentSummary.remainingAmount))}
                                                {paymentSummary.remainingAmount < 0 ? ' (Over)' : ''}
                                            </div>
                                    <div style={{fontSize: '0.7rem', color: 'var(--vz-secondary-color)'}}>
                                                {paymentSummary.isBalanced ? '✓ Balanced' : '⚠ Unbalanced'}
                                    </div>
                                </div>
                            </div>
                                        </div>

                        {/* Separator Line */}
                        <hr style={{border: 'none', height: '1px', background: 'linear-gradient(90deg, transparent, var(--vz-border-color), transparent)', margin: '1.5rem 0', opacity: '0.6'}} />

                        {/* Description and Adjustment Details */}
                        <Row className="g-2 mb-3">
                            <Col md={payment.adjustmentType !== 'none' ? 6 : 12}>
                                                                 <div className="mb-3" style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', marginBottom: '0'}}>
                                     <h6 className="mb-3" style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 1rem 0'}}>
                                        <RiFileTextLine className="me-1" size={14} />
                                            Description
                                        </h6>
                                    <div style={{background: 'var(--vz-light-bg-subtle)', borderRadius: '4px', padding: '0.5rem', borderLeft: '3px solid var(--vz-primary)'}}>
                                        <p className="mb-0 small text-body">{payment.description || 'No description provided'}</p>
                                    </div>
                                        </div>
                            </Col>

                            {/* Adjustment Details - Only show if there's an adjustment */}
                            {payment.adjustmentType !== 'none' && (
                                <Col md={6}>
                                                                         <div className="mb-3" style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', marginBottom: '0'}}>
                                         <h6 className="mb-3" style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 1rem 0'}}>
                                            <RiWalletLine className="me-1" size={14} />
                                                Adjustment Details
                                            </h6>
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                                <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Type:</span>
                                                <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>
                                                        {payment.adjustmentType === 'discount' ? 'Discount' :
                                                            payment.adjustmentType === 'extra_receipt' ? 'Extra Receipt' :
                                                                payment.adjustmentType === 'surcharge' ? 'Surcharge' : 'N/A'}
                                                </span>
                                                    </div>
                                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                                <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Value:</span>
                                                <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>
                                                        ₹{formatAmount(payment.adjustmentValue || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Col>
                            )}
                        </Row>

                        {/* Separator Line */}
                        <hr style={{border: 'none', height: '1px', background: 'linear-gradient(90deg, transparent, var(--vz-border-color), transparent)', margin: '1.5rem 0', opacity: '0.6'}} />

                        {/* Compact Transactions Table */}
                        <div className="mb-3" style={{background: 'var(--vz-light-bg-subtle)', border: '1px solid var(--vz-border-color)', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', marginBottom: '0'}}>
                            <h6 className="mb-3" style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 1rem 0'}}>
                                <RiShoppingCartLine className="me-1" size={14} />
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
                                                                <Badge color="light" className="badge-simple d-flex align-items-center justify-content-center" style={{ width: 'fit-content', margin: '0 auto' }}>
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
                        </div>

                        {/* Unbalanced Warning */}
                        {payment.transactions?.length > 0 && !paymentSummary.isBalanced && (
                            <Alert color="warning" className="mb-3">
                                <RiErrorWarningLine className="me-2" />
                                The allocated amounts don't match the allocatable amount.
                            </Alert>
                        )}

                        {/* Contact Billing Address - Only show if exists */}
                        {(payment.contactBillingAddress1 || payment.contactBillingCity || payment.contactBillingState) && (
                            <>
                            <hr style={{border: 'none', height: '1px', background: 'linear-gradient(90deg, transparent, var(--vz-border-color), transparent)', margin: '1.5rem 0', opacity: '0.6'}} />
                                                         <div className="mb-3" style={{background: 'var(--vz-body-bg)', border: '1px solid var(--vz-border-color)', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', marginBottom: '0'}}>
                                 <h6 className="mb-3" style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 1rem 0'}}>
                                    <RiMapPinLine className="me-1" size={14} />
                                        Contact Billing Address
                                    </h6>
                                <div style={{background: 'var(--vz-light-bg-subtle)', borderRadius: '4px', padding: '0.5rem'}}>
                                    <address className="mb-0 small text-muted">
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
                            </div>
                            </>
                        )}

                        {/* Separator Line */}
                        <hr style={{border: 'none', height: '1px', background: 'linear-gradient(90deg, transparent, var(--vz-border-color), transparent)', margin: '1.5rem 0', opacity: '0.6'}} />

                        {/* Compact System Information */}
                        <div className="mb-3" style={{background: 'var(--vz-light-bg-subtle)', border: '1px solid var(--vz-border-color)', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', marginBottom: '0'}}>
                            <h6 className="mb-3" style={{color: 'var(--vz-secondary-color)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 1rem 0'}}>
                                <RiUserLine className="me-1" size={14} />
                                System Information
                                </h6>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Created By:</span>
                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>{payment.createdByName || 'System'}</span>
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Created Date:</span>
                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>
                                                {new Date(payment.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                    </span>
                                </div>
                                {payment.updatedAt && (
                                    <>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                            <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Updated By:</span>
                                            <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>{payment.updatedByName || 'N/A'}</span>
                                        </div>
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: 'none'}}>
                                            <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Updated Date:</span>
                                            <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>
                                                    {new Date(payment.updatedAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                            </span>
                                            </div>
                                    </>
                                    )}
                            </div>
                        </div>
                    </div>
                )}
            </ModalBody>
            <ModalFooter className="py-2">
                <Button color="light" onClick={toggle} className="px-3">Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default PaymentViewModal;
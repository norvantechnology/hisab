import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Row, Col, Card, CardBody } from 'reactstrap';
import { RiWalletLine, RiBankLine, RiUser3Line, RiCalendarLine, RiAlarmWarningLine, RiArrowRightLine, RiFileTextLine, RiPriceTag3Line } from 'react-icons/ri';
import { getPaymentsForTransaction, getPaymentDetails } from '../../services/payment';
import PaymentViewModal from '../Payments/PaymentViewModal';
import { toast } from 'react-toastify';

const ExpenseViewModal = ({ isOpen, toggle, expense }) => {
    const [relatedPayments, setRelatedPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        if (isOpen && expense?.id) {
            fetchRelatedPayments();
        }
    }, [isOpen, expense?.id]);

    const fetchRelatedPayments = async () => {
        if (!expense?.id) return;
        
        setPaymentsLoading(true);
        try {
            const response = await getPaymentsForTransaction('expense', expense.id);
            if (response.success) {
                setRelatedPayments(response.payments || []);
            }
        } catch (error) {
            console.error('Error fetching related payments:', error);
            setRelatedPayments([]);
        } finally {
            setPaymentsLoading(false);
        }
    };

    const handlePaymentClick = async (payment) => {
        try {
            // Fetch complete payment details including allocations
            const response = await getPaymentDetails(payment.id);
            if (response.success) {
                setSelectedPayment(response); // Use flat response structure
                setShowPaymentModal(true);
            } else {
                toast.error('Failed to load payment details');
            }
        } catch (error) {
            console.error('Error fetching payment details:', error);
            toast.error('Failed to load payment details');
        }
    };

    const getPaymentMethodDisplay = () => {
        const { bankAccountName, contactName, status } = expense || {};
        
        // Direct bank payment
        if (bankAccountName && !contactName) {
            return (
                <div className="d-flex align-items-center">
                    <RiBankLine className="text-info me-2" size={18} />
                    <div>
                        <div className="fw-medium">Direct Bank Payment</div>
                        <small className="text-muted">{bankAccountName}</small>
                    </div>
                </div>
            );
        }
        
        // Contact payment - pending
        if (contactName && !bankAccountName) {
            return (
                <div className="d-flex align-items-center">
                    <RiUser3Line className="text-warning me-2" size={18} />
                    <div>
                        <div className="fw-medium">Contact Payment</div>
                        <small className="text-muted">{contactName}</small>
                    </div>
                </div>
            );
        }
        
        // Contact payment - paid (has both contact and bank account)
        if (contactName && bankAccountName) {
            return (
                <div>
                    <div className="d-flex align-items-center mb-2">
                        <RiUser3Line className="text-warning me-2" size={18} />
                        <div>
                            <div className="fw-medium">Contact Payment (Paid)</div>
                            <small className="text-muted">{contactName}</small>
                        </div>
                    </div>
                    <div className="d-flex align-items-center text-muted ps-3">
                        <RiArrowRightLine className="me-2" size={14} />
                        <RiBankLine className="text-info me-2" size={14} />
                        <small><strong>Paid via:</strong> {bankAccountName}</small>
                    </div>
                </div>
            );
        }
        
        return <span className="text-muted">Not specified</span>;
    };

    const getStatusBadge = () => {
        const { bankAccountName, contactName, status } = expense || {};
        
        // Direct bank payment - always paid
        if (bankAccountName && !contactName) {
            return <Badge color="success" className="badge-soft-success px-3 py-2">Paid</Badge>;
        }
        
        // Contact payments - show actual status
        if (contactName) {
            if (status === 'pending') {
                return <Badge color="warning" className="badge-soft-warning px-3 py-2">Pending</Badge>;
            } else if (status === 'paid') {
                return <Badge color="success" className="badge-soft-success px-3 py-2">Paid</Badge>;
            }
        }
        
        return <span className="text-muted">—</span>;
    };

    const getTypeBadge = () => {
        const { bankAccountName, contactName } = expense || {};
        
        if (bankAccountName && !contactName) {
            return <Badge color="info" className="badge-soft-info px-3 py-2">Direct Payment</Badge>;
        }
        
        if (contactName) {
            return <Badge color="secondary" className="badge-soft-secondary px-3 py-2">Contact Payment</Badge>;
        }
        
        return <span className="text-muted">—</span>;
    };

    const getDueDateDisplay = () => {
        const { contactName, status, dueDate } = expense || {};
        
        // Only show for pending contact payments
        if (contactName && status === 'pending' && dueDate) {
            const dueDateObj = new Date(dueDate);
            const today = new Date();
            const isOverdue = dueDateObj < today;
            
            return (
                <div className="d-flex align-items-center">
                    {isOverdue ? (
                        <RiAlarmWarningLine className="text-danger me-2" size={18} />
                    ) : (
                        <RiCalendarLine className="text-muted me-2" size={18} />
                    )}
                    <div>
                        <span className={isOverdue ? 'text-danger fw-semibold' : 'fw-medium'}>
                            {dueDateObj.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </span>
                        {isOverdue && (
                            <small className="d-block text-danger">
                                (Overdue)
                            </small>
                        )}
                    </div>
                </div>
            );
        }
        return <span className="text-muted">—</span>;
    };

    return (
        <>
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle} className="bg-light">
                <div className="d-flex align-items-center">
                    <RiWalletLine className="text-danger me-2" size={20} />
                    Expense Details
                </div>
            </ModalHeader>
            <ModalBody className="p-3">
                {expense && (
                    <div>
                        {/* Header Card with Key Information */}
                        <Card className="border-0 shadow-sm mb-3">
                            <CardBody className="bg-light">
                                <Row className="align-items-center">
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Date</h6>
                                            <div className="fw-bold text-dark">
                                                {new Date(expense.date).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Category</h6>
                                            <Badge color="primary" className="badge-soft-primary px-2 py-1">
                                                {expense.categoryName || 'N/A'}
                                            </Badge>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Status</h6>
                                            <div>{getStatusBadge()}</div>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Amount</h6>
                                            <div className="fw-bold text-danger fs-4">
                                                ₹{parseFloat(expense.amount || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        {/* Payment and Due Date Information */}
                        <Row className="g-3 mb-3">
                            <Col md={expense.contactName && expense.status === 'pending' ? 6 : 12}>
                                <Card className="border-0 shadow-sm h-100">
                                    <CardBody>
                                        <h6 className="card-title text-muted mb-3">
                                            <RiBankLine className="me-2" />
                                            Payment Method
                                        </h6>
                                        <div className="d-flex align-items-center justify-content-between">
                                            <div className="flex-grow-1">
                                                {getPaymentMethodDisplay()}
                                            </div>
                                            <div className="ms-3">
                                                {getTypeBadge()}
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>

                            {expense.contactName && expense.status === 'pending' && (
                                <Col md={6}>
                                    <Card className="border-0 shadow-sm h-100">
                                        <CardBody>
                                            <h6 className="card-title text-muted mb-3">
                                                <RiCalendarLine className="me-2" />
                                                Due Date
                                            </h6>
                                            <div className="d-flex align-items-center justify-content-center">
                                                {getDueDateDisplay()}
                                            </div>
                                        </CardBody>
                                    </Card>
                                </Col>
                            )}
                        </Row>

                        {/* Notes Section - Only show if notes exist */}
                        {expense.notes && (
                            <Card className="border-0 shadow-sm mb-3">
                                <CardBody>
                                    <h6 className="card-title text-muted mb-3">
                                        <RiFileTextLine className="me-2" />
                                        Notes
                                    </h6>
                                    <div className="bg-light rounded p-3">
                                        <p className="mb-0">{expense.notes}</p>
                                    </div>
                                </CardBody>
                            </Card>
                        )}

                        {/* Metadata Card */}
                        <Card className="border-0 shadow-sm">
                            <CardBody className="bg-light">
                                <h6 className="card-title text-muted mb-2">
                                    <RiCalendarLine className="me-2" />
                                    Record Information
                                </h6>
                                <div className="text-center">
                                    <label className="form-label text-muted small">Created At</label>
                                    <div className="fw-medium">
                                        {new Date(expense.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                )}

                {/* Payment Details Section - Always show */}
                <Card className="border-0 shadow-sm mb-3">
                    <CardBody>
                        <h6 className="card-title text-danger mb-3 d-flex align-items-center">
                            <RiWalletLine className="me-2" />
                            Payment Details
                        </h6>
                        {paymentsLoading ? (
                            <div className="text-center py-2">
                                <div className="spinner-border spinner-border-sm text-danger" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <small className="text-muted ms-2">Loading payments...</small>
                            </div>
                        ) : relatedPayments.length > 0 ? (
                            <div className="payment-list">
                                {relatedPayments.map((payment, index) => (
                                    <div 
                                        key={payment.id} 
                                        className="d-flex justify-content-between align-items-center py-2 px-2 border rounded mb-2 bg-white cursor-pointer"
                                        onClick={() => handlePaymentClick(payment)}
                                        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                        onMouseEnter={(e) => e.target.closest('div').style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                                        onMouseLeave={(e) => e.target.closest('div').style.boxShadow = 'none'}
                                    >
                                        <div className="flex-grow-1">
                                            <div className="fw-medium small text-danger">{payment.paymentNumber}</div>
                                            <div className="text-muted small">{new Date(payment.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="text-end me-2">
                                            <div className="fw-bold small text-danger">₹{parseFloat(payment.paidAmount || 0).toFixed(2)}</div>
                                            {payment.adjustmentType && payment.adjustmentType !== 'none' && (
                                                <div className="text-muted small">
                                                    {payment.adjustmentType === 'extra_receipt' ? '+' : 
                                                     payment.adjustmentType === 'discount' ? '-' : '+'}
                                                    ₹{parseFloat(payment.adjustmentValue || 0).toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                        <RiArrowRightLine className="text-muted" size={14} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-3 text-muted">
                                <RiWalletLine size={24} className="mb-2 opacity-50" />
                                <div>No payments found</div>
                                <small>This expense has not been paid through the payment module</small>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </ModalBody>
            <ModalFooter className="bg-light">
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>

        {/* Payment View Modal */}
        {selectedPayment && (
            <PaymentViewModal
                isOpen={showPaymentModal}
                toggle={() => {
                    setShowPaymentModal(false);
                    setSelectedPayment(null);
                }}
                payment={selectedPayment}
            />
        )}
        </>
    );
};

export default ExpenseViewModal;
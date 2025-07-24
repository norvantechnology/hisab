import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Row, Col } from 'reactstrap';
import { RiBankLine, RiUser3Line, RiCalendarLine, RiAlarmWarningLine, RiArrowRightLine } from 'react-icons/ri';

const ExpenseViewModal = ({ isOpen, toggle, expense }) => {
    const getPaymentMethodDisplay = () => {
        const { bankAccountName, contactName, status } = expense || {};
        
        // Direct bank payment
        if (bankAccountName && !contactName) {
            return (
                <div>
                    <div className="d-flex align-items-center mb-2">
                        <RiBankLine className="text-info me-2" size={18} />
                        <span className="fw-medium">Direct Bank Payment</span>
                    </div>
                    <div className="text-muted">
                        <strong>Bank Account:</strong> {bankAccountName}
                    </div>
                </div>
            );
        }
        
        // Contact payment - pending
        if (contactName && !bankAccountName) {
            return (
                <div>
                    <div className="d-flex align-items-center mb-2">
                        <RiUser3Line className="text-warning me-2" size={18} />
                        <span className="fw-medium">Contact Payment</span>
                    </div>
                    <div className="text-muted">
                        <strong>Contact:</strong> {contactName}
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
                        <span className="fw-medium">Contact Payment (Paid)</span>
                    </div>
                    <div className="text-muted mb-2">
                        <strong>Contact:</strong> {contactName}
                    </div>
                    <div className="d-flex align-items-center text-muted">
                        <RiArrowRightLine className="me-2" size={16} />
                        <RiBankLine className="text-info me-2" size={16} />
                        <span><strong>Paid via:</strong> {bankAccountName}</span>
                    </div>
                </div>
            );
        }
        
        return 'N/A';
    };

    const getStatusBadge = () => {
        const { bankAccountName, contactName, status } = expense || {};
        
        // Direct bank payment - always paid
        if (bankAccountName && !contactName) {
            return <Badge color="success" className="badge-soft-success">Paid</Badge>;
        }
        
        // Contact payments - show actual status
        if (contactName) {
            if (status === 'pending') {
                return <Badge color="warning" className="badge-soft-warning">Pending</Badge>;
            } else if (status === 'paid') {
                return <Badge color="success" className="badge-soft-success">Paid</Badge>;
            }
        }
        
        return <span className="text-muted">—</span>;
    };

    const getTypeBadge = () => {
        const { bankAccountName, contactName } = expense || {};
        
        if (bankAccountName && !contactName) {
            return <Badge color="info" className="badge-soft-info">Direct Payment</Badge>;
        }
        
        if (contactName) {
            return <Badge color="secondary" className="badge-soft-secondary">Contact Payment</Badge>;
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
                        <span className={isOverdue ? 'text-danger fw-semibold' : ''}>
                            {dueDateObj.toLocaleDateString('en-US', {
                                weekday: 'short',
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
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle}>Expense Details</ModalHeader>
            <ModalBody>
                {expense && (
                    <div>
                        <Row>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted mb-1">Date</h6>
                                    <p className="mb-0 fw-medium">
                                        {new Date(expense.date).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted mb-1">Amount</h6>
                                    <p className="mb-0 fw-semibold fs-5 text-success">
                                        ₹{parseFloat(expense.amount || 0).toFixed(2)}
                                    </p>
                                </div>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted mb-1">Category</h6>
                                    <Badge color="primary" className="badge-soft-primary fs-6">
                                        {expense.categoryName || 'N/A'}
                                    </Badge>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted mb-1">Type</h6>
                                    <div>{getTypeBadge()}</div>
                                </div>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted mb-1">Status</h6>
                                    <div>{getStatusBadge()}</div>
                                </div>
                            </Col>
                            {expense.contactName && expense.status === 'pending' && (
                                <Col md={6}>
                                    <div className="mb-3">
                                        <h6 className="text-muted mb-1">Due Date</h6>
                                        <div>{getDueDateDisplay()}</div>
                                    </div>
                                </Col>
                            )}
                        </Row>

                        <Row>
                            <Col md={12}>
                                <div className="mb-3">
                                    <h6 className="text-muted mb-1">Payment Details</h6>
                                    <div className="p-3 bg-light rounded">
                                        {getPaymentMethodDisplay()}
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {expense.notes && (
                            <Row>
                                <Col md={12}>
                                    <div className="mb-3">
                                        <h6 className="text-muted mb-1">Notes</h6>
                                        <div className="p-3 bg-light rounded">
                                            <p className="mb-0">{expense.notes}</p>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        )}

                        <Row>
                            <Col md={12}>
                                <div className="mb-0">
                                    <h6 className="text-muted mb-1">Created</h6>
                                    <p className="mb-0 text-muted small">
                                        {new Date(expense.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </Col>
                        </Row>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default ExpenseViewModal;
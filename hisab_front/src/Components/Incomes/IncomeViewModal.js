import React from 'react';
import { Modal, ModalHeader, ModalBody, Row, Col, Badge } from 'reactstrap';
import { RiBankLine, RiUser3Line, RiArrowRightLine } from 'react-icons/ri';

const IncomeViewModal = ({ isOpen, toggle, income }) => {
    if (!income) return null;

    const getPaymentMethodDisplay = () => {
        const { bankAccountName, contactName, status } = income;
        
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
        else if (contactName && !bankAccountName) {
            return (
                <div>
                    <div className="d-flex align-items-center mb-2">
                        <RiUser3Line className="text-warning me-2" size={18} />
                        <span className="fw-medium">Contact Payment (Pending)</span>
                    </div>
                    <div className="text-muted">
                        <strong>Contact:</strong> {contactName}
                    </div>
                </div>
            );
        }
        // Contact payment - paid via bank
        else if (contactName && bankAccountName) {
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
                        <span><strong>Received via:</strong> {bankAccountName}</span>
                    </div>
                </div>
            );
        }
        
        return <span className="text-muted">Not specified</span>;
    };

    const getStatusBadge = () => {
        const { bankAccountName, contactName, status } = income;
        
        // For direct bank payments, always show "Paid"
        if (bankAccountName && !contactName) {
            return (
                <Badge color="success" className="badge-soft-success">
                    Paid
                </Badge>
            );
        }
        
        // For contact payments, show actual status
        if (contactName && status) {
            const badgeColor = status === 'paid' ? 'success' : 'warning';
            return (
                <Badge color={badgeColor} className={`badge-soft-${badgeColor}`}>
                    {status === 'paid' ? 'Paid' : 'Pending'}
                </Badge>
            );
        }
        
        return <span className="text-muted">N/A</span>;
    };

    const getTypeBadge = () => {
        const { bankAccountName, contactName } = income;
        const isDirect = bankAccountName && !contactName;
        
        return (
            <Badge color={isDirect ? "info" : "warning"} className={`badge-soft-${isDirect ? "info" : "warning"}`}>
                {isDirect ? "Direct Payment" : "Contact Payment"}
            </Badge>
        );
    };

    const getDueDateDisplay = () => {
        const { contactName, status, dueDate } = income;
        
        // Only show due date for pending contact payments
        if (contactName && status === 'pending' && dueDate) {
            const dueDateObj = new Date(dueDate);
            const today = new Date();
            const isOverdue = dueDateObj < today;
            
            return (
                <span className={isOverdue ? 'text-danger fw-medium' : ''}>
                    {dueDateObj.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                    {isOverdue && <div className="text-danger small mt-1">⚠️ Overdue</div>}
                </span>
            );
        }
        
        return <span className="text-muted">N/A</span>;
    };

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle}>
                Income Details
            </ModalHeader>
            <ModalBody>
                <Row className="mb-4">
                    <Col md={6}>
                        <div className="mb-3">
                            <label className="form-label text-muted">Date</label>
                            <div className="fw-medium">
                                {new Date(income.date).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="mb-3">
                            <label className="form-label text-muted">Category</label>
                            <div>
                                <Badge color="success" className="badge-soft-success">
                                    {income.categoryName || 'N/A'}
                                </Badge>
                            </div>
                        </div>
                    </Col>
                </Row>

                <Row className="mb-4">
                    <Col md={6}>
                        <div className="mb-3">
                            <label className="form-label text-muted">Amount</label>
                            <div className="fw-bold text-success fs-4">
                                ₹{parseFloat(income.amount || 0).toFixed(2)}
                            </div>
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="mb-3">
                            <label className="form-label text-muted">Type</label>
                            <div>
                                {getTypeBadge()}
                            </div>
                        </div>
                    </Col>
                </Row>

                <Row className="mb-4">
                    <Col md={6}>
                        <div className="mb-3">
                            <label className="form-label text-muted">Payment Method</label>
                            <div>
                                {getPaymentMethodDisplay()}
                            </div>
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="mb-3">
                            <label className="form-label text-muted">Status</label>
                            <div>
                                {getStatusBadge()}
                            </div>
                        </div>
                    </Col>
                </Row>

                {income.contactName && income.status === 'pending' && (
                    <Row className="mb-4">
                        <Col md={12}>
                            <div className="mb-3">
                                <label className="form-label text-muted">Due Date</label>
                                <div>
                                    {getDueDateDisplay()}
                                </div>
                            </div>
                        </Col>
                    </Row>
                )}

                {income.notes && (
                    <Row className="mb-4">
                        <Col md={12}>
                            <div className="mb-3">
                                <label className="form-label text-muted">Notes</label>
                                <div className="bg-light p-3 rounded">
                                    {income.notes}
                                </div>
                            </div>
                        </Col>
                    </Row>
                )}

                <Row>
                    <Col md={6}>
                        <div className="mb-3">
                            <label className="form-label text-muted">Created At</label>
                            <div className="small text-muted">
                                {new Date(income.createdAt).toLocaleString()}
                            </div>
                        </div>
                    </Col>
                    {income.updatedAt && income.updatedAt !== income.createdAt && (
                        <Col md={6}>
                            <div className="mb-3">
                                <label className="form-label text-muted">Last Updated</label>
                                <div className="small text-muted">
                                    {new Date(income.updatedAt).toLocaleString()}
                                </div>
                            </div>
                        </Col>
                    )}
                </Row>
            </ModalBody>
        </Modal>
    );
};

export default IncomeViewModal;
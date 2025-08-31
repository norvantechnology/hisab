import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Row, Col, Card, CardBody } from 'reactstrap';
import { RiCoinLine, RiBankLine, RiUser3Line, RiArrowRightLine, RiCalendarLine, RiFileTextLine, RiPriceTag3Line } from 'react-icons/ri';

const IncomeViewModal = ({ isOpen, toggle, income }) => {
    if (!income) return null;

    const getPaymentMethodDisplay = () => {
        const { bankAccountName, contactName, status } = income;
        
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
        else if (contactName && !bankAccountName) {
            return (
                <div className="d-flex align-items-center">
                    <RiUser3Line className="text-warning me-2" size={18} />
                    <div>
                        <div className="fw-medium">Contact Payment (Pending)</div>
                        <small className="text-muted">{contactName}</small>
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
                        <div>
                            <div className="fw-medium">Contact Payment (Paid)</div>
                            <small className="text-muted">{contactName}</small>
                        </div>
                    </div>
                    <div className="d-flex align-items-center text-muted ps-3">
                        <RiArrowRightLine className="me-2" size={14} />
                        <RiBankLine className="text-info me-2" size={14} />
                        <small><strong>Received via:</strong> {bankAccountName}</small>
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
                <Badge color="success" className="badge-soft-success px-3 py-2">
                    Paid
                </Badge>
            );
        }
        
        // For contact payments, show actual status
        if (contactName && status) {
            const badgeColor = status === 'paid' ? 'success' : 'warning';
            return (
                <Badge color={badgeColor} className={`badge-soft-${badgeColor} px-3 py-2`}>
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
            <Badge color={isDirect ? "info" : "warning"} className={`badge-soft-${isDirect ? "info" : "warning"} px-3 py-2`}>
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
                <div className="d-flex align-items-center">
                    <RiCalendarLine className={isOverdue ? "text-danger me-2" : "text-muted me-2"} size={18} />
                    <div>
                        <span className={isOverdue ? 'text-danger fw-semibold' : 'fw-medium'}>
                            {dueDateObj.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </span>
                        {isOverdue && <div className="text-danger small mt-1">⚠️ Overdue</div>}
                    </div>
                </div>
            );
        }
        
        return <span className="text-muted">—</span>;
    };

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle} className="bg-light">
                <div className="d-flex align-items-center">
                    <RiCoinLine className="text-success me-2" size={20} />
                    Income Details
                </div>
            </ModalHeader>
            <ModalBody className="p-3">
                {/* Header Card with Key Information */}
                <Card className="border-0 shadow-sm mb-3">
                    <CardBody className="bg-light">
                        <Row className="align-items-center">
                            <Col md={3}>
                                <div className="text-center">
                                    <h6 className="text-muted mb-1">Date</h6>
                                    <div className="fw-bold text-dark">
                                        {new Date(income.date).toLocaleDateString('en-US', {
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
                                    <Badge color="success" className="badge-soft-success px-2 py-1">
                                        {income.categoryName || 'N/A'}
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
                                    <div className="fw-bold text-success fs-4">
                                        ₹{parseFloat(income.amount || 0).toFixed(2)}
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </CardBody>
                </Card>

                {/* Payment and Due Date Information */}
                <Row className="g-3 mb-3">
                    <Col md={income.contactName && income.status === 'pending' ? 6 : 12}>
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

                    {income.contactName && income.status === 'pending' && (
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
                {income.notes && (
                    <Card className="border-0 shadow-sm mb-3">
                        <CardBody>
                            <h6 className="card-title text-muted mb-3">
                                <RiFileTextLine className="me-2" />
                                Notes
                            </h6>
                            <div className="bg-light rounded p-3">
                                <p className="mb-0">{income.notes}</p>
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
                        <Row>
                            <Col md={income.updatedAt && income.updatedAt !== income.createdAt ? 6 : 12}>
                                <div className="text-center">
                                    <label className="form-label text-muted small">Created At</label>
                                    <div className="fw-medium">
                                        {new Date(income.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </Col>
                            {income.updatedAt && income.updatedAt !== income.createdAt && (
                                <Col md={6}>
                                    <div className="text-center">
                                        <label className="form-label text-muted small">Last Updated</label>
                                        <div className="fw-medium">
                                            {new Date(income.updatedAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                </Col>
                            )}
                        </Row>
                    </CardBody>
                </Card>
            </ModalBody>
            <ModalFooter className="bg-light">
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default IncomeViewModal;
import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Card, CardBody, Row, Col } from 'reactstrap';
import { RiExchangeDollarLine, RiCalendarLine, RiBankLine, RiFileTextLine, RiUserLine, RiNumbersLine } from 'react-icons/ri';

const BankTransferViewModal = ({ isOpen, toggle, transfer }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle} className="bg-light">
                <div className="d-flex align-items-center">
                    <RiExchangeDollarLine className="text-primary me-2" size={20} />
                    Bank Transfer Details
                </div>
            </ModalHeader>
            <ModalBody className="p-3">
                {transfer && (
                    <div>
                        {/* Header Card with Key Information */}
                        <Card className="border-0 shadow-sm mb-3">
                            <CardBody className="bg-light">
                                <Row className="align-items-center">
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Transfer Number</h6>
                                            <Badge color="info" className="fs-6 px-3 py-2">
                                                {transfer.transferNumber || 'N/A'}
                                            </Badge>
                                        </div>
                                    </Col>
                                    <Col md={3}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Date</h6>
                                            <div className="fw-bold text-dark">
                                                {new Date(transfer.date).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="text-center">
                                            <h6 className="text-muted mb-1">Amount</h6>
                                            <div className="fw-bold text-primary fs-4">
                                                ₹{parseFloat(transfer.amount || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        {/* Transfer Details */}
                        <Row className="g-3">
                            <Col md={6}>
                                <Card className="border-0 shadow-sm h-100">
                                    <CardBody>
                                        <h6 className="card-title text-muted mb-3">
                                            <RiBankLine className="me-2" />
                                            Transfer Flow
                                        </h6>
                                        
                                        <div className="mb-3">
                                            <label className="form-label text-muted small">From Account</label>
                                            <div>
                                                <Badge color="danger" className="badge-soft-danger px-3 py-2">
                                                    {transfer.fromBankName || 'N/A'}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="text-center my-2">
                                            <i className="ri-arrow-down-line text-muted" style={{ fontSize: '1.5rem' }}></i>
                                        </div>

                                        <div>
                                            <label className="form-label text-muted small">To Account</label>
                                            <div>
                                                <Badge color="success" className="badge-soft-success px-3 py-2">
                                                    {transfer.toBankName || 'N/A'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>

                            <Col md={6}>
                                <Card className="border-0 shadow-sm h-100">
                                    <CardBody>
                                        <h6 className="card-title text-muted mb-3">
                                            <RiFileTextLine className="me-2" />
                                            Transfer Information
                                        </h6>
                                        
                                        <div className="mb-3">
                                            <label className="form-label text-muted small">Description</label>
                                            <div className="bg-light rounded p-2">
                                                <small>{transfer.description || 'No description provided'}</small>
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label text-muted small">Reference Number</label>
                                            <div className="d-flex align-items-center">
                                                <RiNumbersLine className="text-muted me-1" size={14} />
                                                <span className="small">{transfer.referenceNumber || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        </Row>

                        {/* Metadata Card */}
                        <Card className="border-0 shadow-sm mt-3">
                            <CardBody className="bg-light">
                                <h6 className="card-title text-muted mb-3">
                                    <RiUserLine className="me-2" />
                                    Record Information
                                </h6>
                                <Row>
                                    <Col md={6}>
                                        <div className="text-center">
                                            <label className="form-label text-muted small">Created By</label>
                                            <div className="fw-medium">{transfer.createdByName || 'System'}</div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="text-center">
                                            <label className="form-label text-muted small">Created At</label>
                                            <div className="fw-medium">
                                                {new Date(transfer.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </Col>
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

export default BankTransferViewModal;
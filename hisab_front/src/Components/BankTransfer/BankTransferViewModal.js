import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge } from 'reactstrap';

const BankTransferViewModal = ({ isOpen, toggle, transfer }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} size="md">
            <ModalHeader toggle={toggle}>Bank Transfer Details</ModalHeader>
            <ModalBody>
                {transfer && (
                    <div>
                        <div className="mb-3">
                            <h6 className="text-muted">Transfer Number</h6>
                            <p>
                                <Badge color="info" className="badge-soft-info">
                                    {transfer.transferNumber || 'N/A'}
                                </Badge>
                            </p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Date</h6>
                            <p>{new Date(transfer.date).toLocaleDateString()}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">From Account</h6>
                            <p>
                                <Badge color="warning" className="badge-soft-warning">
                                    {transfer.fromBankName || 'N/A'}
                                </Badge>
                            </p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">To Account</h6>
                            <p>
                                <Badge color="success" className="badge-soft-success">
                                    {transfer.toBankName || 'N/A'}
                                </Badge>
                            </p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Amount</h6>
                            <p className="fw-semibold text-primary">
                                ₹{parseFloat(transfer.amount || 0).toFixed(2)}
                            </p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Description</h6>
                            <p>{transfer.description || 'No description provided'}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Reference Number</h6>
                            <p>{transfer.referenceNumber || 'N/A'}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Created By</h6>
                            <p>{transfer.createdByName || 'System'}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Created At</h6>
                            <p>{new Date(transfer.createdAt).toLocaleString()}</p>
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

export default BankTransferViewModal;
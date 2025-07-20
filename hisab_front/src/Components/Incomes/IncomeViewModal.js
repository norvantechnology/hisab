import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';

const IncomeViewModal = ({ isOpen, toggle, income }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle}>
            <ModalHeader toggle={toggle}>Income Details</ModalHeader>
            <ModalBody>
                {income && (
                    <div>
                        <div className="mb-3">
                            <h6 className="text-muted">Date</h6>
                            <p>{new Date(income.date).toLocaleDateString()}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Category</h6>
                            <p>{income.categoryName || 'N/A'}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Amount</h6>
                            <p className="fw-semibold">₹{parseFloat(income.amount || 0).toFixed(2)}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Bank Account</h6>
                            <p>{income.bankAccountName || 'N/A'}</p>
                        </div>
                        <div className="mb-3">
                            <h6 className="text-muted">Notes</h6>
                            <p>{income.notes || 'No notes provided'}</p>
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

export default IncomeViewModal;
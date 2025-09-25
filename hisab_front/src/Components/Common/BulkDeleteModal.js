import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Alert } from 'reactstrap';

const BulkDeleteModal = ({
    isOpen,
    toggle,
    selectedCount,
    itemType = 'items',
    onConfirm,
    isLoading = false,
    errors = null
}) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} centered>
            <ModalHeader toggle={toggle} className="border-bottom">
                <div className="d-flex align-items-center">
                    <i className="ri-delete-bin-line me-2 text-danger fs-18"></i>
                    Bulk Delete Confirmation
                </div>
            </ModalHeader>
            <ModalBody>
                <div className="text-center mb-3">
                    <div className="avatar-md mx-auto mb-3">
                        <div className="avatar-title bg-danger-subtle text-danger rounded-circle fs-24">
                            <i className="ri-delete-bin-line"></i>
                        </div>
                    </div>
                    <h5 className="mb-2">Are you sure?</h5>
                    <p className="text-muted mb-3">
                        You are about to delete <strong>{selectedCount}</strong> {itemType}. 
                        This action cannot be undone.
                    </p>
                </div>

                {errors && errors.length > 0 && (
                    <Alert color="warning" className="mb-3">
                        <h6 className="alert-heading mb-2">
                            <i className="ri-alert-line me-1"></i>
                            Some items could not be deleted:
                        </h6>
                        <ul className="mb-0">
                            {errors.map((error, index) => (
                                <li key={index} className="small">{error}</li>
                            ))}
                        </ul>
                    </Alert>
                )}

                <div className="bg-light rounded p-3">
                    <div className="d-flex align-items-center">
                        <i className="ri-information-line me-2 text-info"></i>
                        <div>
                            <h6 className="mb-1">What will happen:</h6>
                            <ul className="mb-0 small text-muted">
                                <li>Selected {itemType} will be permanently deleted</li>
                                <li>Related payment allocations will be handled automatically</li>
                                <li>Inventory changes will be reversed (if applicable)</li>
                                <li>Bank and contact balances will be updated</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button
                    color="light"
                    onClick={toggle}
                    disabled={isLoading}
                >
                    Cancel
                </Button>
                <Button
                    color="danger"
                    onClick={onConfirm}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <i className="ri-loader-4-line spin me-1"></i>
                            Deleting...
                        </>
                    ) : (
                        <>
                            <i className="ri-delete-bin-line me-1"></i>
                            Delete {selectedCount} {itemType}
                        </>
                    )}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default BulkDeleteModal; 
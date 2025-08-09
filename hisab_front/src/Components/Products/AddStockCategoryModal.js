import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label, Input, Button } from 'reactstrap';

const AddStockCategoryModal = ({ isOpen, toggle, categoryName, onCategoryNameChange, onAddCategory, isLoading = false }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle}>
            <ModalHeader toggle={toggle}>Add New Stock Category</ModalHeader>
            <ModalBody>
                <FormGroup>
                    <Label>Stock Category Name</Label>
                    <Input
                        type="text"
                        value={categoryName}
                        onChange={onCategoryNameChange}
                        placeholder="Enter stock category name"
                        autoFocus
                        disabled={isLoading}
                    />
                </FormGroup>
            </ModalBody>
            <ModalFooter>
                <Button color="light" onClick={toggle} disabled={isLoading}>
                    Cancel
                </Button>
                <Button color="primary" onClick={onAddCategory} disabled={isLoading || !categoryName.trim()}>
                    {isLoading ? 'Adding...' : 'Add Category'}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default AddStockCategoryModal; 
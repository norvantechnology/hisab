import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label, Input, Button } from 'reactstrap';

const AddCategoryModal = ({ isOpen, toggle, categoryName, onCategoryNameChange, onAddCategory }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle}>
            <ModalHeader toggle={toggle}>Add New Category</ModalHeader>
            <ModalBody>
                <FormGroup>
                    <Label>Category Name</Label>
                    <Input
                        type="text"
                        value={categoryName}
                        onChange={onCategoryNameChange}
                        placeholder="Enter category name"
                        autoFocus
                    />
                </FormGroup>
            </ModalBody>
            <ModalFooter>
                <Button color="light" onClick={toggle}>Cancel</Button>
                <Button color="primary" onClick={onAddCategory}>Add Category</Button>
            </ModalFooter>
        </Modal>
    );
};

export default AddCategoryModal;
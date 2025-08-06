import React from 'react';
import { Modal, ModalBody, Row, Col, Button, Form, Input, Label } from 'reactstrap';
import { RiPencilLine, RiAddLine, RiCloseLine, RiLoader4Line, RiBankLine, RiShieldCheckLine, RiErrorWarningLine } from 'react-icons/ri';
import { FormField, SelectField } from './FormFields';
import { ACCOUNT_TYPES } from './index';

const AccountModal = ({ isOpen, toggle, isEdit, validation }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} centered size="md">
            <ModalBody className="p-0">
                <div className="modal-header bg-primary-subtle">
                    <h5 className="modal-title text-primary">
                        {isEdit ? <><RiPencilLine className="me-2" />Edit Bank Account</> : <><RiAddLine className="me-2" />Add New Bank Account</>}
                    </h5>
                    <Button type="button" className="btn-close" onClick={toggle}></Button>
                </div>
                <div className="p-4">
                    <Form onSubmit={validation.handleSubmit}>
                        <Row>
                            <Col lg={12}>
                                <FormField
                                    label="Account Name"
                                    name="accountName"
                                    type="text"
                                    placeholder="Enter account name"
                                    validation={validation}
                                    icon={<RiBankLine />}
                                />
                            </Col>
                            <Col lg={12}>
                                <SelectField
                                    label="Account Type"
                                    name="accountType"
                                    options={Object.entries(ACCOUNT_TYPES).map(([value, config]) => ({
                                        value,
                                        label: config.label
                                    }))}
                                    validation={validation}
                                    icon={<RiBankLine />}
                                />
                            </Col>
                            <Col lg={12}>
                                <FormField
                                    label={isEdit ? "Current Balance" : "Opening Balance"}
                                    name="openingBalance"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder={`Enter ${isEdit ? 'current' : 'opening'} balance`}
                                    validation={validation}
                                    icon={<RiBankLine />}
                                />
                            </Col>
                            <Col lg={12}>
                                <div className="form-check form-switch mb-3">
                                    <Input
                                        type="switch"
                                        id="isActive"
                                        name="isActive"
                                        checked={validation.values.isActive}
                                        onChange={validation.handleChange}
                                        className="form-check-input"
                                    />
                                    <Label htmlFor="isActive" className="form-check-label">
                                        <RiShieldCheckLine className="me-1" />
                                        Active Account
                                    </Label>
                                </div>
                            </Col>
                        </Row>
                        <div className="hstack gap-2 justify-content-end mt-4 pt-3 border-top">
                            <Button type="button" color="light" onClick={toggle}>
                                <RiCloseLine className="me-1" />Cancel
                            </Button>
                            <Button type="submit" color="primary" disabled={validation.isSubmitting}>
                                {validation.isSubmitting ? (
                                    <>
                                        <RiLoader4Line className="me-1" />
                                        {isEdit ? "Updating..." : "Creating..."}
                                    </>
                                ) : (
                                    <>
                                        {isEdit ? <RiPencilLine className="me-1" /> : <RiAddLine className="me-1" />}
                                        {isEdit ? "Update Account" : "Create Account"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </Form>
                </div>
            </ModalBody>
        </Modal>
    );
};

export default AccountModal;
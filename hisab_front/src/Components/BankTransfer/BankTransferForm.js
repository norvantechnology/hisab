import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button, Row, Col } from 'reactstrap';
import { RiLoader4Line } from 'react-icons/ri';
import ReactSelect from 'react-select';
import * as Yup from "yup";
import { useFormik } from "formik";
import { ACCOUNT_TYPES } from '../BankAccounts/index';
import { getTodayDate } from '../../utils/dateUtils';

const BankTransferForm = ({
    isOpen,
    toggle,
    isEditMode,
    bankAccounts,
    selectedTransfer,
    onSubmit,
    isLoading = false
}) => {
    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: selectedTransfer?.id || '',
            date: selectedTransfer?.date?.split('T')[0] || getTodayDate(),
            fromBankId: selectedTransfer?.fromBankId || '',  // Changed from fromBankAccountId to match API
            toBankId: selectedTransfer?.toBankId || '',      // Changed from toBankAccountId to match API
            amount: selectedTransfer ? parseFloat(selectedTransfer.amount || 0) : 0,
            description: selectedTransfer?.description || '', // Added description field
            referenceNumber: selectedTransfer?.referenceNumber || '' // Added referenceNumber field
        },
        validationSchema: Yup.object({
            date: Yup.date().required("Date is required"),
            fromBankId: Yup.string()
                .required("From account is required")
                .notOneOf([Yup.ref('toBankId')], "Accounts must be different"),
            toBankId: Yup.string()
                .required("To account is required")
                .notOneOf([Yup.ref('fromBankId')], "Accounts must be different"),
            amount: Yup.number()
                .transform((value) => (isNaN(value) ? undefined : value))
                .min(0.01, "Amount must be at least 0.01")
                .required("Amount is required"),
            description: Yup.string()
                .max(500, "Description must be 500 characters or less"),
            referenceNumber: Yup.string()
                .max(50, "Reference number must be 50 characters or less")
        }),
        onSubmit: async (values) => {
            await onSubmit(values);
        }
    });

    const isProcessing = validation.isSubmitting || isLoading;

    const getCurrentFromAccount = () => {
        const accountId = validation.values.fromBankId;
        if (!accountId || !bankAccounts.length) return null;
        const account = bankAccounts.find(a => String(a.id) === String(accountId));
        return account ? formatAccountOption(account) : null;
    };

    const getCurrentToAccount = () => {
        const accountId = validation.values.toBankId;
        if (!accountId || !bankAccounts.length) return null;
        const account = bankAccounts.find(a => String(a.id) === String(accountId));
        return account ? formatAccountOption(account) : null;
    };

    const formatAccountOption = (account) => {
        const accountType = ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank;
        return {
            value: account.id,
            label: account.accountName,
            account: account,
            icon: accountType.icon,
            color: accountType.color
        };
    };

    const formatOptionLabel = (option) => (
        <div className="d-flex align-items-center">
            <span className={`text-${option.color} me-2`}>
                {option.icon}
            </span>
            <span>
                {option.label}
                {!option.account.isActive && <span className="text-muted"> (Inactive)</span>}
                <small className="text-muted d-block">{option.account.accountNumber}</small>
            </span>
        </div>
    );

    const filteredToAccounts = bankAccounts.filter(
        account => String(account.id) !== String(validation.values.fromBankId)
    );

    const filteredFromAccounts = bankAccounts.filter(
        account => String(account.id) !== String(validation.values.toBankId)
    );

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle}>
                {isEditMode ? 'Edit Bank Transfer' : 'Create Bank Transfer'}
            </ModalHeader>
            <ModalBody>
                <Form onSubmit={validation.handleSubmit}>
                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Date <span className="text-danger">*</span></Label>
                                <Input
                                    type="date"
                                    name="date"
                                    value={validation.values.date}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.date && !!validation.errors.date}
                                    disabled={isProcessing}
                                />
                                <FormFeedback>{validation.errors.date}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Amount <span className="text-danger">*</span></Label>
                                <Input
                                    type="number"
                                    name="amount"
                                    step="0.01"
                                    min="0.01"
                                    value={validation.values.amount}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.amount && !!validation.errors.amount}
                                    disabled={isProcessing}
                                />
                                <FormFeedback>{validation.errors.amount}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>From Account <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={filteredFromAccounts.map(formatAccountOption)}
                                    value={getCurrentFromAccount()}
                                    onChange={(selectedOption) => {
                                        validation.setFieldValue('fromBankId', selectedOption?.value || '');
                                    }}
                                    onBlur={() => validation.setFieldTouched('fromBankId', true)}
                                    className={`react-select-container ${validation.touched.fromBankId && validation.errors.fromBankId ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Source Account"
                                    formatOptionLabel={formatOptionLabel}
                                    isOptionDisabled={(option) => !option.account.isActive}
                                    isDisabled={isProcessing}
                                />
                                {validation.touched.fromBankId && validation.errors.fromBankId && (
                                    <div className="invalid-feedback d-block">{validation.errors.fromBankId}</div>
                                )}
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>To Account <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={filteredToAccounts.map(formatAccountOption)}
                                    value={getCurrentToAccount()}
                                    onChange={(selectedOption) => {
                                        validation.setFieldValue('toBankId', selectedOption?.value || '');
                                    }}
                                    onBlur={() => validation.setFieldTouched('toBankId', true)}
                                    className={`react-select-container ${validation.touched.toBankId && validation.errors.toBankId ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Destination Account"
                                    formatOptionLabel={formatOptionLabel}
                                    isOptionDisabled={(option) => !option.account.isActive}
                                    isDisabled={isProcessing}
                                />
                                {validation.touched.toBankId && validation.errors.toBankId && (
                                    <div className="invalid-feedback d-block">{validation.errors.toBankId}</div>
                                )}
                            </FormGroup>
                        </Col>
                    </Row>

                    <FormGroup>
                        <Label>Description</Label>
                        <Input
                            type="textarea"
                            name="description"
                            rows="2"
                            value={validation.values.description}
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            placeholder="Purpose of the transfer"
                            invalid={validation.touched.description && !!validation.errors.description}
                            disabled={isProcessing}
                        />
                        <FormFeedback>{validation.errors.description}</FormFeedback>
                    </FormGroup>

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Reference Number</Label>
                                <Input
                                    type="text"
                                    name="referenceNumber"
                                    value={validation.values.referenceNumber}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    placeholder="Optional reference number"
                                    invalid={validation.touched.referenceNumber && !!validation.errors.referenceNumber}
                                    disabled={isProcessing}
                                />
                                <FormFeedback>{validation.errors.referenceNumber}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    <ModalFooter>
                        <Button
                            color="light"
                            onClick={toggle}
                            disabled={isProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            type="submit"
                            disabled={isProcessing || !validation.isValid}
                        >
                            {isProcessing ? (
                                <>
                                    <RiLoader4Line className="spin me-1" />
                                    {isEditMode ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                isEditMode ? 'Update Transfer' : 'Create Transfer'
                            )}
                        </Button>
                    </ModalFooter>
                </Form>
            </ModalBody>
        </Modal>
    );
};

export default BankTransferForm;
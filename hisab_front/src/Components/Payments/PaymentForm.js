import React, { useState, useEffect, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button, Row, Col, Table, Card, CardBody } from 'reactstrap';
import { RiLoader2Line } from 'react-icons/ri';
import ReactSelect from 'react-select';
import * as Yup from "yup";
import { useFormik } from "formik";
import { ACCOUNT_TYPES } from '../BankAccounts/index';
import { getPendingTransactions } from '../../services/payment';
import { adjustmentOptions } from './Constant';

const PaymentForm = ({
    isOpen,
    toggle,
    isEditMode = false,
    bankAccounts = [],
    contacts = [],
    selectedPayment = null,
    onSubmit,
    isLoading = false
}) => {
    const [pendingTransactions, setPendingTransactions] = useState([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [transactionAllocations, setTransactionAllocations] = useState({});

    const parseAmount = useCallback((amount) => {
        const parsed = parseFloat(amount);
        return isNaN(parsed) ? 0 : parsed;
    }, []);

    const formatAmount = useCallback((amount) => parseAmount(amount).toFixed(2), [parseAmount]);

    const extractTransactionData = useCallback((payment) => {
        if (!payment?.allocations) return { ids: [], allocations: {} };
        const ids = [];
        const allocations = {};
        payment.allocations.forEach(allocation => {
            const transactionId = allocation.allocationType === 'current-balance' ? 'current-balance' : allocation.purchaseId || allocation.id;
            ids.push(transactionId);
            allocations[transactionId] = parseAmount(allocation.paidAmount || allocation.amount);
        });
        return { ids, allocations };
    }, [parseAmount]);

    const resetStates = useCallback(() => {
        setPendingTransactions([]);
        setTransactionAllocations({});
        setIsLoadingTransactions(false);
    }, []);

    // Check if any allocation exceeds maximum amount
    const hasOverAllocation = useCallback(() => {
        return pendingTransactions.some(transaction => {
            const allocatedAmount = parseAmount(transactionAllocations[transaction.id] || 0);
            const maxAmount = getMaxAmount(transaction);
            return allocatedAmount > maxAmount;
        });
    }, [pendingTransactions, transactionAllocations, getMaxAmount]);

    // Check if any selected transaction has zero allocation
    const hasZeroAllocation = useCallback(() => {
        return validation.values.transactionIds.some(id => {
            const allocatedAmount = parseAmount(transactionAllocations[id] || 0);
            return allocatedAmount <= 0;
        });
    }, [validation.values.transactionIds, transactionAllocations]);

    const validationSchema = Yup.object({
        date: Yup.date().required("Date is required"),
        contactId: Yup.string().required("Contact is required"),
        bankId: Yup.string().required("Bank account is required"),
        description: Yup.string().max(500, "Description must be 500 characters or less"),
        adjustmentType: Yup.string().required("Adjustment type is required"),
        adjustmentValue: Yup.number()
            .min(0, "Adjustment value must be positive")
            .when('adjustmentType', ([adjustmentType], schema) => {
                return adjustmentType !== 'none'
                    ? schema.required("Adjustment value is required")
                    : schema;
            }),
        transactionIds: Yup.array().min(1, "At least one transaction must be selected")
    });

    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: selectedPayment?.id || '',
            date: selectedPayment?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            contactId: selectedPayment?.contactId || '',
            bankId: selectedPayment?.bankId || '',
            description: selectedPayment?.description || '',
            adjustmentType: selectedPayment?.adjustmentType || 'none',
            adjustmentValue: selectedPayment?.adjustmentValue || 0,
            transactionIds: extractTransactionData(selectedPayment).ids
        },
        validationSchema,
        onSubmit: async (values) => {
            const bankImpact = calculations.bankImpact();
            const transactionAllocationsData = values.transactionIds.map(id => {
                const transaction = pendingTransactions.find(t => t.id === id);
                return {
                    transactionId: id,
                    amount: transaction?.pendingAmount || 0,
                    paidAmount: transactionAllocations[id] || 0,
                    type: transaction?.balanceType || 'receivable'
                };
            });
            await onSubmit({
                ...values,
                transactionAllocations: transactionAllocationsData
            });
        }
    });

    const formatOptions = {
        contact: (contact) => ({ value: contact.id, label: contact.name }),
        bank: (account) => {
            const accountType = ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank;
            return {
                value: account.id,
                label: account.accountName,
                icon: accountType.icon,
                color: accountType.color
            };
        }
    };

    const getCurrentOption = (type, value, items) => {
        if (!value || !items.length) return null;
        const item = items.find(i => String(i.id) === String(value));
        return item ? formatOptions[type](item) : null;
    };

    const calculations = {
        totalReceivable: () => {
            return validation.values.transactionIds.reduce((sum, id) => {
                const transaction = pendingTransactions.find(t => t.id === id);
                const allocatedAmount = parseAmount(transactionAllocations[id] || 0);
                return transaction?.balanceType === 'receivable' ? sum + allocatedAmount : sum;
            }, 0);
        },
        totalPayable: () => {
            return validation.values.transactionIds.reduce((sum, id) => {
                const transaction = pendingTransactions.find(t => t.id === id);
                const allocatedAmount = parseAmount(transactionAllocations[id] || 0);
                return transaction?.balanceType === 'payable' ? sum + allocatedAmount : sum;
            }, 0);
        },
        adjustmentImpact: () => {
            const adjustmentAmount = parseAmount(validation.values.adjustmentValue || 0);
            const adjustmentType = validation.values.adjustmentType || 'none';
            return adjustmentType === 'none' ? 0 : adjustmentAmount;
        },
        bankImpact: () => {
            const receivableTotal = calculations.totalReceivable();
            const payableTotal = calculations.totalPayable();
            const adjustmentAmount = calculations.adjustmentImpact();
            const adjustmentType = validation.values.adjustmentType || 'none';
            let net = receivableTotal - payableTotal;
            if (adjustmentType === 'discount') net = net + adjustmentAmount;
            else if (adjustmentType === 'surcharge' || adjustmentType === 'extra_receipt') net = net - adjustmentAmount;
            return {
                amount: Math.abs(net),
                type: net >= 0 ? 'receipt' : 'payment',
                label: net >= 0 ? 'Amount to receive' : 'Amount to pay'
            };
        }
    };

    const transformAllocationsToPendingTransactions = useCallback((allocations) => {
        return allocations.map(allocation => {
            const isCurrentBalance = allocation.allocationType === 'current-balance';
            const transactionId = isCurrentBalance ? 'current-balance' : allocation.purchaseId;
            return {
                id: transactionId,
                description: isCurrentBalance ? 'Opening Balance' : `Purchase #${allocation.purchaseInvoiceNumber || allocation.purchaseId}`,
                date: allocation.createdAt,
                amount: parseAmount(allocation.amount || 0),
                pendingAmount: parseAmount(allocation.pendingAmount || 0),
                paidAmount: parseAmount(allocation.paidAmount || 0),
                balanceType: allocation.balanceType,
                isOpeningBalance: isCurrentBalance,
                maxAmount: parseAmount(allocation.paidAmount || 0) + parseAmount(allocation.pendingAmount || 0)
            };
        });
    }, [parseAmount]);

    const getExistingTransactionIds = useCallback(() => {
        return selectedPayment?.allocations ? selectedPayment.allocations.map(allocation =>
            allocation.allocationType === 'current-balance' ? 'current-balance' : allocation.purchaseId || allocation.id
        ) : [];
    }, [selectedPayment]);

    const fetchPendingTransactions = useCallback(async (contactId) => {
        if (!contactId) return;
        setIsLoadingTransactions(true);
        try {
            let allTransactions = [];

            if (isEditMode && selectedPayment?.allocations) {
                const existingTransactions = transformAllocationsToPendingTransactions(selectedPayment.allocations);
                allTransactions = [...existingTransactions];
            }

            const existingIds = isEditMode ? getExistingTransactionIds() : [];

            // Only send contactId — do not pass excludeIds to API
            const response = await getPendingTransactions({
                contactId
            });

            // Manually filter out already existing transaction IDs
            const newTransactions = (response.transactions || []).filter(
                txn => !existingIds.includes(txn.id)
            );

            allTransactions = [...allTransactions, ...newTransactions];
            console.log("allTransactions", allTransactions);
            setPendingTransactions(allTransactions);
        } finally {
            setIsLoadingTransactions(false);
        }
    }, [isEditMode, selectedPayment, getExistingTransactionIds, transformAllocationsToPendingTransactions]);

    const initializeEditMode = useCallback(() => {
        if (selectedPayment?.allocations) {
            const initialAllocations = {};
            selectedPayment.allocations.forEach(allocation => {
                const transactionId = allocation.allocationType === 'current-balance' ? 'current-balance' : allocation.purchaseId || allocation.id;
                initialAllocations[transactionId] = parseAmount(allocation.paidAmount || allocation.amount);
            });
            setTransactionAllocations(initialAllocations);
        }
    }, [selectedPayment, parseAmount]);

    useEffect(() => {
        if (isOpen) {
            resetStates();
            if (isEditMode && selectedPayment) {
                initializeEditMode();
                const contactId = selectedPayment.contactId;
                if (contactId) {
                    fetchPendingTransactions(contactId);
                }
            } else {
                const contactId = validation.values.contactId;
                if (contactId) {
                    fetchPendingTransactions(contactId);
                }
            }
        } else {
            validation.resetForm();
            resetStates();
        }
    }, [isOpen, isEditMode, selectedPayment, resetStates, initializeEditMode, fetchPendingTransactions]);

    useEffect(() => {
        if (isOpen && !isEditMode) {
            const contactId = validation.values.contactId;
            if (contactId) fetchPendingTransactions(contactId);
        }
    }, [isOpen, isEditMode, validation.values.contactId, fetchPendingTransactions]);

    const toggleTransactionSelection = (transactionId) => {
        const currentIds = [...validation.values.transactionIds];
        const index = currentIds.indexOf(transactionId);
        if (index === -1) {
            currentIds.push(transactionId);
            const transaction = pendingTransactions.find(t => t.id === transactionId);
            if (transaction) {
                const defaultAmount = isEditMode ? transaction.paidAmount : transaction.pendingAmount;
                setTransactionAllocations(prev => ({
                    ...prev,
                    [transactionId]: parseAmount(defaultAmount)
                }));
            }
        } else {
            currentIds.splice(index, 1);
            setTransactionAllocations(prev => {
                const newAllocations = { ...prev };
                delete newAllocations[transactionId];
                return newAllocations;
            });
        }
        validation.setFieldValue('transactionIds', currentIds);
    };

    const updateAllocationAmount = (transactionId, amount) => {
        const parsedAmount = amount === '' ? 0 : parseAmount(amount);
        setTransactionAllocations(prev => ({
            ...prev,
            [transactionId]: parsedAmount
        }));
    };

    const getMaxAmount = useCallback((transaction) => {
        return isEditMode ? transaction.maxAmount || (transaction.paidAmount + transaction.pendingAmount) : transaction.pendingAmount;
    }, [isEditMode]);

    // Updated form validation logic
    const isFormValid = validation.isValid &&
        validation.values.transactionIds.length > 0 &&
        !hasOverAllocation() &&
        !hasZeroAllocation();

    // Debug validation status
    const debugValidation = {
        isValid: validation.isValid,
        hasTransactions: validation.values.transactionIds.length > 0,
        noOverAllocation: !hasOverAllocation(),
        noZeroAllocation: !hasZeroAllocation(),
        transactionIds: validation.values.transactionIds,
        allocations: transactionAllocations,
        errors: validation.errors,
        touched: validation.touched,
        values: validation.values,
        adjustmentType: validation.values.adjustmentType,
        adjustmentValue: validation.values.adjustmentValue,
        isAdjustmentValid: validation.values.adjustmentType === 'none' || (validation.values.adjustmentValue > 0)
    };

    console.log('PaymentForm Debug:', debugValidation);

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="xl">
            <ModalHeader toggle={toggle}>
                {isEditMode ? 'Edit Payment' : 'Create Payment'}
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
                                    disabled={isLoading}
                                />
                                <FormFeedback>{validation.errors.date}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Contact <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={contacts.map(formatOptions.contact)}
                                    value={getCurrentOption('contact', validation.values.contactId, contacts)}
                                    onChange={(option) => {
                                        validation.setFieldValue('contactId', option?.value || '');
                                        if (!isEditMode) {
                                            validation.setFieldValue('transactionIds', []);
                                            setTransactionAllocations({});
                                        }
                                    }}
                                    onBlur={() => validation.setFieldTouched('contactId', true)}
                                    className={`react-select-container ${validation.touched.contactId && validation.errors.contactId ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Contact"
                                    isDisabled={isLoading || isEditMode}
                                />
                                {validation.touched.contactId && validation.errors.contactId && (
                                    <div className="invalid-feedback d-block">{validation.errors.contactId}</div>
                                )}
                                {!validation.touched.contactId && validation.errors.contactId && (
                                    <div className="text-danger small">{validation.errors.contactId}</div>
                                )}
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Bank Account <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={bankAccounts.map(formatOptions.bank)}
                                    value={getCurrentOption('bank', validation.values.bankId, bankAccounts)}
                                    onChange={(option) => validation.setFieldValue('bankId', option?.value || '')}
                                    onBlur={() => validation.setFieldTouched('bankId', true)}
                                    className={`react-select-container ${validation.touched.bankId && validation.errors.bankId ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Bank Account"
                                    formatOptionLabel={(option) => (
                                        <div className="d-flex align-items-center">
                                            <span className={`text-${option.color} me-2`}>{option.icon}</span>
                                            <span>{option.label}</span>
                                        </div>
                                    )}
                                    isDisabled={isLoading}
                                />
                                {validation.touched.bankId && validation.errors.bankId && (
                                    <div className="invalid-feedback d-block">{validation.errors.bankId}</div>
                                )}
                                {!validation.touched.bankId && validation.errors.bankId && (
                                    <div className="text-danger small">{validation.errors.bankId}</div>
                                )}
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Description</Label>
                                <Input
                                    type="textarea"
                                    name="description"
                                    rows="2"
                                    value={validation.values.description}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    placeholder="Purpose of the payment"
                                    invalid={validation.touched.description && !!validation.errors.description}
                                    disabled={isLoading}
                                />
                                <FormFeedback>{validation.errors.description}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Adjustment Type <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={adjustmentOptions}
                                    value={adjustmentOptions.find(opt => opt.value === validation.values.adjustmentType)}
                                    onChange={(option) => {
                                        validation.setFieldValue('adjustmentType', option?.value || 'none');
                                        if (option?.value === 'none') validation.setFieldValue('adjustmentValue', 0);
                                    }}
                                    onBlur={() => validation.setFieldTouched('adjustmentType', true)}
                                    className={`react-select-container ${validation.touched.adjustmentType && validation.errors.adjustmentType ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Adjustment Type"
                                    isDisabled={isLoading}
                                />
                                {validation.touched.adjustmentType && validation.errors.adjustmentType && (
                                    <div className="invalid-feedback d-block">{validation.errors.adjustmentType}</div>
                                )}
                                {!validation.touched.adjustmentType && validation.errors.adjustmentType && (
                                    <div className="text-danger small">{validation.errors.adjustmentType}</div>
                                )}
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>
                                    {validation.values.adjustmentType === 'discount' ? 'Discount Amount' :
                                        validation.values.adjustmentType === 'extra_receipt' ? 'Extra Receipt Amount' :
                                            validation.values.adjustmentType === 'surcharge' ? 'Surcharge Amount' :
                                                'Adjustment Value'}
                                    {validation.values.adjustmentType !== 'none' && <span className="text-danger"> *</span>}
                                </Label>
                                <Input
                                    type="number"
                                    name="adjustmentValue"
                                    min="0"
                                    step="0.01"
                                    value={validation.values.adjustmentValue}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    disabled={isLoading || validation.values.adjustmentType === 'none'}
                                    invalid={validation.touched.adjustmentValue && !!validation.errors.adjustmentValue}
                                />
                                <FormFeedback>{validation.errors.adjustmentValue}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    <div className="mb-4">
                        <h5 className="mb-3">
                            {isEditMode ? 'Payment Allocations' : 'Pending Transactions'}
                        </h5>

                        {isLoadingTransactions ? (
                            <div className="text-center py-3">
                                <RiLoader2Line className="spin" />
                                <span className="ms-2">Loading transactions...</span>
                            </div>
                        ) : pendingTransactions.length > 0 ? (
                            <>
                                <Table bordered responsive>
                                    <thead>
                                        <tr>
                                            <th width="50px"></th>
                                            <th>Description</th>
                                            <th>Date</th>
                                            <th>Pending Amount</th>
                                            <th>Type</th>
                                            <th width="150px">Payment Amount (Max: {isEditMode ? 'Total' : 'Pending'})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingTransactions.map((transaction) => {
                                            const isSelected = validation.values.transactionIds.includes(transaction.id);
                                            const allocatedAmount = parseAmount(transactionAllocations[transaction.id] || 0);
                                            const maxAmount = getMaxAmount(transaction);
                                            const isOverAllocated = allocatedAmount > maxAmount;
                                            const isZeroAllocated = isSelected && allocatedAmount <= 0;

                                            return (
                                                <tr key={transaction.id} className={isSelected ? 'table-active' : ''}>
                                                    <td>
                                                        <Input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleTransactionSelection(transaction.id)}
                                                            disabled={isLoading}
                                                        />
                                                    </td>
                                                    <td>
                                                        {transaction.isOpeningBalance ? 'Opening Balance' : transaction.description}
                                                    </td>
                                                    <td>
                                                        {transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td>
                                                        <strong>${formatAmount(transaction.pendingAmount)}</strong>
                                                    </td>
                                                    <td>
                                                        <span className={`badge bg-${transaction.balanceType === 'payable' ? 'warning' : 'success'}`}>
                                                            {transaction.balanceType === 'payable' ? 'Payable' : 'Receivable'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {isSelected ? (
                                                            <div>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max={maxAmount}
                                                                    value={allocatedAmount || ''}
                                                                    onChange={(e) => updateAllocationAmount(transaction.id, e.target.value)}
                                                                    disabled={isLoading}
                                                                    invalid={isOverAllocated || isZeroAllocated}
                                                                />
                                                                <small className="text-muted">Max: ${formatAmount(maxAmount)}</small>
                                                                {isOverAllocated && (
                                                                    <div className="text-danger small">Exceeds maximum amount</div>
                                                                )}
                                                                {isZeroAllocated && (
                                                                    <div className="text-danger small">Amount must be greater than 0</div>
                                                                )}
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>

                                {validation.values.transactionIds.length > 0 && (
                                    <Card className="mt-3">
                                        <CardBody className="bg-light">
                                            <Row>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">Total Receivable</div>
                                                    <div className="h5 text-success">${formatAmount(calculations.totalReceivable())}</div>
                                                </Col>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">Total Payable</div>
                                                    <div className="h5 text-warning">${formatAmount(calculations.totalPayable())}</div>
                                                </Col>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">
                                                        {validation.values.adjustmentType === 'discount' ? 'Discount' :
                                                            validation.values.adjustmentType === 'extra_receipt' ? 'Extra Receipt' :
                                                                validation.values.adjustmentType === 'surcharge' ? 'Surcharge' : 'Adjustment'}
                                                    </div>
                                                    <div className={`h5 ${validation.values.adjustmentType === 'discount' ? 'text-success' : 'text-danger'}`}>
                                                        {validation.values.adjustmentType === 'discount' ? '-' : '+'}${formatAmount(calculations.adjustmentImpact())}
                                                    </div>
                                                </Col>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">{calculations.bankImpact().label}</div>
                                                    <div className={`h5 ${calculations.bankImpact().type === 'receivable' ? 'text-success' : 'text-danger'}`}>
                                                        ${formatAmount(calculations.bankImpact().amount)}
                                                    </div>
                                                </Col>
                                            </Row>
                                        </CardBody>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <div className="text-muted py-3 text-center">
                                {validation.values.contactId ? "No pending transactions found" : "Select a contact to view transactions"}
                            </div>
                        )}

                        {/* Enhanced validation messages */}
                        {validation.values.transactionIds.length === 0 && validation.errors.transactionIds && (
                            <div className="text-danger small mt-2">At least one transaction must be selected</div>
                        )}
                        {hasOverAllocation() && (
                            <div className="text-danger small mt-2">Some allocated amounts exceed the maximum allowed</div>
                        )}
                        {hasZeroAllocation() && (
                            <div className="text-danger small mt-2">All selected transactions must have an amount greater than 0</div>
                        )}

                        {/* Debug validation status - remove this in production */}
                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-3 p-2 bg-light border rounded">
                                <small className="text-muted">Debug Info:</small>
                                <div className="small">
                                    <div>Form Valid: {validation.isValid ? '✅' : '❌'}</div>
                                    <div>Has Transactions: {validation.values.transactionIds.length > 0 ? '✅' : '❌'}</div>
                                    <div>No Over Allocation: {!hasOverAllocation() ? '✅' : '❌'}</div>
                                    <div>No Zero Allocation: {!hasZeroAllocation() ? '✅' : '❌'}</div>
                                    <div>Adjustment Type: {validation.values.adjustmentType}</div>
                                    <div>Adjustment Value: {validation.values.adjustmentValue}</div>
                                    <div>Adjustment Valid: {(validation.values.adjustmentType === 'none' || validation.values.adjustmentValue > 0) ? '✅' : '❌'}</div>
                                    <div>Button Enabled: {isFormValid ? '✅' : '❌'}</div>
                                    <div>Form Errors: {Object.keys(validation.errors).length > 0 ? Object.keys(validation.errors).join(', ') : 'None'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button color="light" onClick={toggle} disabled={isLoading}>
                    Cancel
                </Button>
                <Button
                    color="primary"
                    type="submit"
                    onClick={validation.handleSubmit}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <RiLoader2Line className="spin me-1" />
                            {isEditMode ? 'Updating...' : 'Creating...'}
                        </>
                    ) : isEditMode ? 'Update Payment' : 'Create Payment'}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default PaymentForm;
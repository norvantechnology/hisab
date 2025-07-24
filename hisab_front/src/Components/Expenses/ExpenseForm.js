import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button } from 'reactstrap';
import { RiLoader2Line } from 'react-icons/ri';
import ReactSelect from 'react-select';
import * as Yup from "yup";
import { useFormik } from "formik";
import BankAccountContactDropdown from '../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../Common/BankAccountDropdown';

const ExpenseForm = ({ isOpen, toggle, isEditMode, categories, selectedExpense, onSubmit }) => {
    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: selectedExpense?.id || '',
            date: selectedExpense?.date?.split('T')[0] || '',
            categoryId: selectedExpense?.categoryId || '',
            bankAccountId: selectedExpense?.bankAccountId || '',
            contactId: selectedExpense?.contactId || '',
            paymentMethod: selectedExpense?.bankAccountId && !selectedExpense?.contactId ? 'bank' : selectedExpense?.contactId ? 'contact' : 'bank',
            amount: selectedExpense ? parseFloat(selectedExpense.amount || 0) : 0,
            notes: selectedExpense?.notes || '',
            status: selectedExpense?.status || 'paid',
            dueDate: selectedExpense?.dueDate?.split('T')[0] || '',

        },
        validationSchema: Yup.object({
            date: Yup.date().required("Date is required"),
            categoryId: Yup.string().required("Category is required"),
            bankAccountId: Yup.string().when(['paymentMethod', 'status'], {
                is: (paymentMethod, status) => paymentMethod === 'bank' || (paymentMethod === 'contact' && status === 'paid'),
                then: () => Yup.string().required("Bank account is required"),
                otherwise: () => Yup.string()
            }),
            contactId: Yup.string().when('paymentMethod', {
                is: 'contact',
                then: () => Yup.string().required("Contact is required"),
                otherwise: () => Yup.string()
            }),
            amount: Yup.number()
                .transform((value) => (isNaN(value) ? undefined : value))
                .min(0, "Amount must be positive")
                .required("Amount is required"),
            status: Yup.string().when('paymentMethod', {
                is: 'contact',
                then: () => Yup.string().required("Status is required"),
                otherwise: () => Yup.string()
            }),
            dueDate: Yup.date().when(['paymentMethod', 'status'], {
                is: (paymentMethod, status) => paymentMethod === 'contact' && status === 'pending',
                then: () => Yup.date().required("Due date is required"),
                otherwise: () => Yup.date()
            })
        }),
        onSubmit: async (values) => {
            await onSubmit(values);
        }
    });

    const getCurrentCategory = () => {
        const categoryId = validation.values.categoryId;
        if (!categoryId || !categories.length) return null;
        const category = categories.find(c => String(c.id) === String(categoryId));
        return category ? { value: category.id, label: category.name } : null;
    };

    const getCurrentPaymentMethod = () => {
        const { paymentMethod, bankAccountId, contactId } = validation.values;
        
        if (paymentMethod === 'bank' && bankAccountId) {
            return `bank_${bankAccountId}`;
        }
        
        if (paymentMethod === 'contact' && contactId) {
            return `contact_${contactId}`;
        }
        
        return null;
    };





    const handlePaymentMethodChange = (selectedOption) => {
        if (!selectedOption) {
            validation.setFieldValue('paymentMethod', '');
            validation.setFieldValue('bankAccountId', '');
            validation.setFieldValue('contactId', '');
            validation.setFieldValue('paidFromBankAccountId', '');
            return;
        }

        const [type, id] = selectedOption.value.split('_');
        validation.setFieldValue('paymentMethod', type);
        
        if (type === 'bank') {
            validation.setFieldValue('bankAccountId', id);
            validation.setFieldValue('contactId', '');
            validation.setFieldValue('paidFromBankAccountId', '');
            // Reset contact-specific fields
            validation.setFieldValue('status', 'paid');
            validation.setFieldValue('dueDate', '');
        } else if (type === 'contact') {
            validation.setFieldValue('contactId', id);
            validation.setFieldValue('bankAccountId', '');
            validation.setFieldValue('paidFromBankAccountId', '');
            // Set default values for contact-specific fields
            validation.setFieldValue('status', 'pending');
            const today = new Date();
            validation.setFieldValue('dueDate', today.toISOString().split('T')[0]);
        }
    };

    const handleStatusChange = (e) => {
        const newStatus = e.target.value;
        validation.setFieldValue('status', newStatus);
        
        // Clear bankAccountId when switching to pending (contact payments only)
        if (newStatus === 'pending') {
            validation.setFieldValue('bankAccountId', '');
            // Set due date to today if not already set
            if (!validation.values.dueDate) {
                const today = new Date();
                validation.setFieldValue('dueDate', today.toISOString().split('T')[0]);
            }
        } else if (newStatus === 'paid') {
            // Clear due date when switching to paid
            validation.setFieldValue('dueDate', '');
        }
    };

    const isContactSelected = validation.values.paymentMethod === 'contact';
    const isContactPaid = isContactSelected && validation.values.status === 'paid';
    const isContactPending = isContactSelected && validation.values.status === 'pending';

    return (
        <Modal isOpen={isOpen} toggle={toggle}>
            <ModalHeader toggle={toggle}>
                {isEditMode ? 'Edit Expense' : 'Add New Expense'}
            </ModalHeader>
            <ModalBody>
                <Form onSubmit={validation.handleSubmit}>
                    <FormGroup>
                        <Label>Date</Label>
                        <Input
                            type="date"
                            name="date"
                            value={validation.values.date}
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            invalid={validation.touched.date && !!validation.errors.date}
                        />
                        <FormFeedback>{validation.errors.date}</FormFeedback>
                    </FormGroup>

                    <FormGroup>
                        <Label>Category</Label>
                        <ReactSelect
                            options={categories.map(category => ({
                                value: category.id,
                                label: category.name
                            }))}
                            value={getCurrentCategory()}
                            onChange={(selectedOption) => {
                                validation.setFieldValue('categoryId', selectedOption?.value || '');
                            }}
                            onBlur={() => validation.setFieldTouched('categoryId', true)}
                            className={`react-select-container ${validation.touched.categoryId && validation.errors.categoryId ? 'is-invalid' : ''}`}
                            classNamePrefix="react-select"
                            placeholder="Select Category"
                        />
                        {validation.touched.categoryId && validation.errors.categoryId && (
                            <div className="invalid-feedback d-block">{validation.errors.categoryId}</div>
                        )}
                    </FormGroup>

                    <FormGroup>
                        <Label>Payment Method</Label>
                        <BankAccountContactDropdown
                            value={getCurrentPaymentMethod()}
                            onChange={handlePaymentMethodChange}
                            onBlur={() => {
                                validation.setFieldTouched('bankAccountId', true);
                                validation.setFieldTouched('contactId', true);
                            }}
                            placeholder="Select Payment Method"
                            error={validation.errors.bankAccountId || validation.errors.contactId}
                            touched={validation.touched.bankAccountId || validation.touched.contactId}
                        />
                        {((validation.touched.bankAccountId && validation.errors.bankAccountId) ||
                          (validation.touched.contactId && validation.errors.contactId)) && (
                            <div className="invalid-feedback d-block">
                                {validation.errors.bankAccountId || validation.errors.contactId}
                            </div>
                        )}
                    </FormGroup>

                    {isContactSelected && (
                        <>
                            <FormGroup>
                                <Label>Status</Label>
                                <Input
                                    type="select"
                                    name="status"
                                    value={validation.values.status}
                                    onChange={handleStatusChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.status && !!validation.errors.status}
                                >
                                    <option value="">Select Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                </Input>
                                <FormFeedback>{validation.errors.status}</FormFeedback>
                            </FormGroup>

                            {isContactPaid && (
                                <FormGroup>
                                    <Label>Paid From (Bank Account)</Label>
                                    <BankAccountDropdown
                                        value={validation.values.bankAccountId}
                                        onChange={(selectedOption) => {
                                            validation.setFieldValue('bankAccountId', selectedOption?.value || '');
                                        }}
                                        onBlur={() => validation.setFieldTouched('bankAccountId', true)}
                                        error={validation.errors.bankAccountId}
                                        touched={validation.touched.bankAccountId}
                                        placeholder="Select Bank Account"
                                    />
                                    {validation.touched.bankAccountId && validation.errors.bankAccountId && (
                                        <div className="invalid-feedback d-block">{validation.errors.bankAccountId}</div>
                                    )}
                                </FormGroup>
                            )}

                            {isContactPending && (
                                <FormGroup>
                                    <Label>Due Date</Label>
                                    <Input
                                        type="date"
                                        name="dueDate"
                                        value={validation.values.dueDate}
                                        onChange={validation.handleChange}
                                        onBlur={validation.handleBlur}
                                        invalid={validation.touched.dueDate && !!validation.errors.dueDate}
                                    />
                                    <FormFeedback>{validation.errors.dueDate}</FormFeedback>
                                </FormGroup>
                            )}
                        </>
                    )}

                    <FormGroup>
                        <Label>Amount</Label>
                        <Input
                            type="number"
                            name="amount"
                            step="0.01"
                            min="0"
                            value={validation.values.amount}
                            onChange={validation.handleChange}
                            onBlur={validation.handleBlur}
                            invalid={validation.touched.amount && !!validation.errors.amount}
                        />
                        <FormFeedback>{validation.errors.amount}</FormFeedback>
                    </FormGroup>

                    <FormGroup>
                        <Label>Notes</Label>
                        <Input
                            type="textarea"
                            name="notes"
                            rows="3"
                            value={validation.values.notes}
                            onChange={validation.handleChange}
                            placeholder="Optional notes about the expense"
                        />
                    </FormGroup>

                    <ModalFooter>
                        <Button color="light" onClick={toggle}>Cancel</Button>
                        <Button color="primary" type="submit" disabled={validation.isSubmitting}>
                            {isEditMode ? 'Update Expense' : 'Create Expense'}
                            {validation.isSubmitting && <RiLoader2Line className="ms-1 spin" />}
                        </Button>
                    </ModalFooter>
                </Form>
            </ModalBody>
        </Modal>
    );
};

export default ExpenseForm;
import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button } from 'reactstrap';
import { RiLoader2Line } from 'react-icons/ri';
import ReactSelect from 'react-select';
import * as Yup from "yup";
import { useFormik } from "formik";
import { ACCOUNT_TYPES } from '../BankAccounts';

const IncomeForm = ({ isOpen, toggle, isEditMode, categories, bankAccounts, selectedIncome, onSubmit, isLoading }) => {
    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: selectedIncome?.id || '',
            date: selectedIncome?.date?.split('T')[0] || '',
            categoryId: selectedIncome?.categoryId || '',
            bankAccountId: selectedIncome?.bankAccountId || '',
            amount: selectedIncome ? parseFloat(selectedIncome.amount || 0) : 0,
            notes: selectedIncome?.notes || ''
        },
        validationSchema: Yup.object({
            date: Yup.date().required("Date is required"),
            categoryId: Yup.string().required("Category is required"),
            bankAccountId: Yup.string().required("Bank account is required"),
            amount: Yup.number()
                .transform((value) => (isNaN(value) ? undefined : value))
                .min(0, "Amount must be positive")
                .required("Amount is required")
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

    const getCurrentBankAccount = () => {
        const bankAccountId = validation.values.bankAccountId;
        if (!bankAccountId || !bankAccounts.length) return null;
        const account = bankAccounts.find(a => String(a.id) === String(bankAccountId));
        return account ? {
            value: account.id,
            label: account.accountName,
            account: account
        } : null;
    };

    return (
        <Modal isOpen={isOpen} toggle={toggle}>
            <ModalHeader toggle={toggle}>
                {isEditMode ? 'Edit Income' : 'Add New Income'}
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
                        <Label>Income Category</Label>
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
                            placeholder="Select Income Category"
                        />
                        {validation.touched.categoryId && validation.errors.categoryId && (
                            <div className="invalid-feedback d-block">{validation.errors.categoryId}</div>
                        )}
                    </FormGroup>

                    <FormGroup>
                        <Label>Bank Account</Label>
                        <ReactSelect
                            options={bankAccounts.map(account => ({
                                value: account.id,
                                label: account.accountName,
                                account: account
                            }))}
                            value={getCurrentBankAccount()}
                            onChange={(selectedOption) => {
                                validation.setFieldValue('bankAccountId', selectedOption?.value || '');
                            }}
                            onBlur={() => validation.setFieldTouched('bankAccountId', true)}
                            className={`react-select-container ${validation.touched.bankAccountId && validation.errors.bankAccountId ? 'is-invalid' : ''}`}
                            classNamePrefix="react-select"
                            placeholder="Select Bank Account"
                            formatOptionLabel={(option) => {
                                const account = option.account;
                                const accountType = ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank;
                                return (
                                    <div className="d-flex align-items-center">
                                        <span className={`text-${accountType.color} me-2`}>
                                            {accountType.icon}
                                        </span>
                                        <span>
                                            {account.accountName}
                                            {!account.isActive && <span className="text-muted"> (Inactive)</span>}
                                        </span>
                                    </div>
                                );
                            }}
                        />
                        {validation.touched.bankAccountId && validation.errors.bankAccountId && (
                            <div className="invalid-feedback d-block">{validation.errors.bankAccountId}</div>
                        )}
                    </FormGroup>

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
                            placeholder="Optional notes about the income"
                        />
                    </FormGroup>

                    <ModalFooter>
                        <Button color="light" onClick={toggle}>Cancel</Button>
                        <Button color="primary" type="submit" disabled={isLoading}>
                            {isEditMode ? 'Update Income' : 'Create Income'}
                            {isLoading && <RiLoader2Line className="ms-1 spin" />}
                        </Button>
                    </ModalFooter>
                </Form>
            </ModalBody>
        </Modal>
    );
};

export default IncomeForm;
                                                                                            import React, { useMemo, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button, Row, Col } from 'reactstrap';
import { RiLoader4Line, RiBankLine, RiUser3Line } from 'react-icons/ri';
import ReactSelect from 'react-select';
import * as Yup from "yup";
import { useFormik } from "formik";
import BankAccountContactDropdown from '../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../Common/BankAccountDropdown';
import PaymentAdjustmentModal from '../Common/PaymentAdjustmentModal';
import { getTodayDate } from '../../utils/dateUtils';
import CategoryDropdown from '../Common/CategoryDropdown';

const IncomeForm = ({ isOpen, toggle, isEditMode, categories, selectedIncome, onSubmit, isLoading, onAddCategory }) => {
    const [paymentAdjustmentModal, setPaymentAdjustmentModal] = React.useState({
        isOpen: false,
        paymentInfo: null,
        pendingFormData: null
    });

    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: selectedIncome?.id || '',
            date: selectedIncome?.date?.split('T')[0] || getTodayDate(),
            categoryId: selectedIncome?.categoryId || '',
            paymentMethod: selectedIncome?.bankAccountId && !selectedIncome?.contactId ? 'bank' : selectedIncome?.contactId ? 'contact' : 'bank',
            bankAccountId: selectedIncome?.bankAccountId || '',
            contactId: selectedIncome?.contactId || '',
            status: selectedIncome?.status || (selectedIncome?.contactId ? 'pending' : 'paid'),
            dueDate: selectedIncome?.dueDate?.split('T')[0] || '',
            amount: selectedIncome ? parseFloat(selectedIncome.amount || 0) : 0,
            notes: selectedIncome?.notes || ''
        },
        validationSchema: Yup.object({
            date: Yup.date().required("Date is required"),
            categoryId: Yup.string().required("Category is required"),
            paymentMethod: Yup.string().required("Payment method is required"),
            bankAccountId: Yup.string().when('paymentMethod', {
                is: 'bank',
                then: () => Yup.string().required("Bank account is required"),
                otherwise: () => Yup.string()
            }),
            contactId: Yup.string().when('paymentMethod', {
                is: 'contact',
                then: () => Yup.string().required("Contact is required"),
                otherwise: () => Yup.string()
            }),
            status: Yup.string().when('paymentMethod', {
                is: 'contact',
                then: () => Yup.string().required("Status is required"),
                otherwise: () => Yup.string()
            }),
            dueDate: Yup.date().when(['paymentMethod', 'status'], {
                is: (paymentMethod, status) => paymentMethod === 'contact' && status === 'pending',
                then: () => Yup.date().required("Due date is required"),
                otherwise: () => Yup.date()
            }),
            amount: Yup.number()
                .transform((value) => (isNaN(value) ? undefined : value))
                .min(0, "Amount must be positive")
                .required("Amount is required")
        }),
        onSubmit: async (values) => {
            console.log('🚀 IncomeForm onSubmit called with values:', values);
            console.log('🔍 Form validation state at submission:', {
                isValid: validation.isValid,
                errors: validation.errors,
                touched: validation.touched
            });
            
            try {
                console.log('📤 Calling parent onSubmit function...');
                await onSubmit(values);
                console.log('✅ Parent onSubmit completed successfully');
            } catch (error) {
                console.error('❌ Error in IncomeForm onSubmit:', error);
                if (error.status === 409 && error.data?.requiresPaymentAdjustment) {
                    // Payment adjustment required - show adjustment modal
                    console.log('✅ Income: Payment adjustment modal should open now');
                    setPaymentAdjustmentModal({
                        isOpen: true,
                        paymentInfo: error.data.paymentInfo,
                        pendingFormData: values
                    });
                    return; // Don't close the form yet
                }
                // Re-throw other errors to be handled by parent
                throw error;
            }
        }
    });

    // Handle payment adjustment choice
    const handlePaymentAdjustmentChoice = async (choice) => {
        try {
            const formData = {
                ...paymentAdjustmentModal.pendingFormData,
                paymentAdjustmentChoice: choice
            };
            
            await onSubmit(formData);
            
            // Close the payment adjustment modal
            setPaymentAdjustmentModal({
                isOpen: false,
                paymentInfo: null,
                pendingFormData: null
            });
        } catch (error) {
            console.error('Error handling payment adjustment:', error);
            // Keep the modal open and let parent handle the error
            throw error;
        }
    };

    // Reset form when modal opens or selectedIncome changes
    useEffect(() => {
        if (isOpen && selectedIncome) {
            // Force form to reinitialize with fresh data
            validation.setValues({
                id: selectedIncome.id || '',
                date: selectedIncome.date?.split('T')[0] || getTodayDate(),
                categoryId: selectedIncome.categoryId || '',
                paymentMethod: selectedIncome.bankAccountId && !selectedIncome.contactId ? 'bank' : selectedIncome.contactId ? 'contact' : 'bank',
                bankAccountId: selectedIncome.bankAccountId || '',
                contactId: selectedIncome.contactId || '',
                status: selectedIncome.status || (selectedIncome.contactId ? 'pending' : 'paid'),
                dueDate: selectedIncome.dueDate?.split('T')[0] || '',
                amount: parseFloat(selectedIncome.amount || 0),
                notes: selectedIncome.notes || ''
            });
        }
    }, [isOpen, selectedIncome?.id]);

    // Handle modal close
    const handleModalClose = () => {
        validation.resetForm();
        toggle();
    };


    const handlePaymentMethodChange = (selectedOption) => {
        if (!selectedOption) {
            validation.setFieldValue('paymentMethod', '');
            validation.setFieldValue('bankAccountId', '');
            validation.setFieldValue('contactId', '');
            validation.setFieldValue('status', '');
            validation.setFieldValue('dueDate', '');
            return;
        }

        const [type, id] = selectedOption.value.split('_');
        validation.setFieldValue('paymentMethod', type);
        
        if (type === 'bank') {
            validation.setFieldValue('bankAccountId', id);
            validation.setFieldValue('contactId', '');
            validation.setFieldValue('status', 'paid');
            validation.setFieldValue('dueDate', '');
        } else if (type === 'contact') {
            validation.setFieldValue('contactId', id);
            validation.setFieldValue('bankAccountId', '');
            validation.setFieldValue('status', 'pending'); // Set default status for contact
            validation.setFieldValue('dueDate', '');
        }
    };

    const handleStatusChange = (selectedOption) => {
        const status = selectedOption?.value;
        
        // Prevent status change if bank account is selected (should always be 'paid')
        if (validation.values.paymentMethod === 'bank') {
            console.log(`🚫 Cannot change status when bank account is selected. Status remains 'paid'.`);
            return;
        }
        
        validation.setFieldValue('status', status);
        
        if (status === 'pending') {
            validation.setFieldValue('bankAccountId', '');
        } else if (status === 'paid') {
            validation.setFieldValue('dueDate', '');
        }
    };

    const getCurrentPaymentMethod = () => {
        const { paymentMethod, bankAccountId, contactId } = validation.values;
        
        if (paymentMethod === 'bank' && bankAccountId) {
            return `bank_${bankAccountId}`;
        } else if (paymentMethod === 'contact' && contactId) {
            return `contact_${contactId}`;
        }
        return null;
    };

    const getCurrentCategory = () => {
        const categoryId = validation.values.categoryId;
        if (!categoryId) return null;
        
        if (categories.length > 0) {
            const category = categories.find(c => String(c.id) === String(categoryId));
            return category ? { value: category.id, label: category.name } : null;
        }
        
        // Fallback: if categories aren't loaded yet but we have an ID, create a temporary option
        if (selectedIncome?.categoryName) {
            return { value: categoryId, label: selectedIncome.categoryName };
        }
        
        return null;
    };

    const getCurrentBankAccount = () => {
        const bankAccountId = validation.values.bankAccountId;
        if (!bankAccountId) return null;
        
        return { 
            value: bankAccountId, 
            label: selectedIncome?.bankAccountName || `Bank Account ${bankAccountId}`,
            account: { id: bankAccountId, accountName: selectedIncome?.bankAccountName || `Bank Account ${bankAccountId}`, accountType: 'bank' }
        };
    };

    const isContactSelected = validation.values.paymentMethod === 'contact';
    const isContactPaid = isContactSelected && validation.values.status === 'paid';
    const isContactPending = isContactSelected && validation.values.status === 'pending';

    return (
        <Modal isOpen={isOpen} toggle={handleModalClose} size="lg">
            <ModalHeader toggle={handleModalClose}>
                {isEditMode ? 'Edit Income' : 'Add New Income'}
            </ModalHeader>
            <ModalBody>
                <Form onSubmit={validation.handleSubmit}>
                    <Row>
                        <Col md={6}>
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
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Income Category</Label>
                                <CategoryDropdown
                                    categories={categories}
                                    value={validation.values.categoryId}
                                    onChange={(selectedValue) => {
                                        validation.setFieldValue('categoryId', selectedValue);
                                    }}
                                    onBlur={() => validation.setFieldTouched('categoryId', true)}
                                    onAddCategory={onAddCategory}
                                    placeholder="Select Income Category"
                                    addNewLabel="Add New Income Category"
                                    isInvalid={validation.touched.categoryId && !!validation.errors.categoryId}
                                    isDisabled={isLoading}
                                />
                                {validation.touched.categoryId && validation.errors.categoryId && (
                                    <div className="invalid-feedback d-block">{validation.errors.categoryId}</div>
                                )}
                            </FormGroup>
                        </Col>
                    </Row>

                    <FormGroup>
                        <Label>Payment Method</Label>
                        <BankAccountContactDropdown
                            value={getCurrentPaymentMethod()}
                            onChange={handlePaymentMethodChange}
                            onBlur={() => validation.setFieldTouched('paymentMethod', true)}
                            disabled={isLoading}
                            placeholder="Select Payment Method"
                            error={validation.errors.paymentMethod}
                            touched={validation.touched.paymentMethod}
                        />
                        {validation.touched.paymentMethod && validation.errors.paymentMethod && (
                            <div className="invalid-feedback d-block">{validation.errors.paymentMethod}</div>
                        )}
                    </FormGroup>

                    {isContactSelected && !isEditMode && (
                        <FormGroup>
                            <Label>Status</Label>
                            <ReactSelect
                                options={[
                                    { value: 'paid', label: 'Paid' },
                                    { value: 'pending', label: 'Pending' }
                                ]}
                                value={validation.values.status ? { value: validation.values.status, label: validation.values.status === 'paid' ? 'Paid' : 'Pending' } : null}
                                onChange={handleStatusChange}
                                onBlur={() => validation.setFieldTouched('status', true)}
                                className={`react-select-container ${validation.touched.status && validation.errors.status ? 'is-invalid' : ''}`}
                                classNamePrefix="react-select"
                                placeholder="Select Status"
                            />
                            {validation.touched.status && validation.errors.status && (
                                <div className="invalid-feedback d-block">{validation.errors.status}</div>
                            )}
                        </FormGroup>
                    )}

                    {isContactSelected && isEditMode && (
                        <FormGroup>
                            <Label>Status</Label>
                            <Input
                                type="text"
                                value={validation.values.status === 'paid' ? 'Paid' : 'Pending'}
                                disabled
                                className="form-control-plaintext"
                            />
                            <small className="text-muted">Status is managed by payments and cannot be changed in edit mode</small>
                        </FormGroup>
                    )}

                    {isContactPaid && !isEditMode && (
                        <FormGroup>
                            <Label>Received From (Bank Account)</Label>
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

                    <Row>
                        <Col md={6}>
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
                        </Col>
                        <Col md={6}>
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
                        </Col>
                    </Row>

                    <ModalFooter>
                        <Button color="light" onClick={handleModalClose}>Cancel</Button>
                        <Button 
                            color="primary" 
                            type="submit" 
                            disabled={isLoading}
                            onClick={() => {
                                console.log('🔍 Update Income button clicked');
                                console.log('Form validation state:', {
                                    isValid: validation.isValid,
                                    errors: validation.errors,
                                    values: validation.values,
                                    isLoading
                                });
                            }}
                        >
                            {isEditMode ? 'Update Income' : 'Create Income'}
                            {isLoading && <RiLoader4Line className="ms-1 spin" />}
                        </Button>
                    </ModalFooter>
                </Form>
            </ModalBody>

            {/* Payment Adjustment Modal */}
            <PaymentAdjustmentModal
                isOpen={paymentAdjustmentModal.isOpen}
                toggle={() => setPaymentAdjustmentModal(prev => ({ ...prev, isOpen: false }))}
                paymentInfo={paymentAdjustmentModal.paymentInfo}
                newAmount={paymentAdjustmentModal.pendingFormData?.amount}
                onConfirm={handlePaymentAdjustmentChoice}
                isLoading={isLoading}
                transactionType="income"
            />
        </Modal>
    );
};

export default IncomeForm;
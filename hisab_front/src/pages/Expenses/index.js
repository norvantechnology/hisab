import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import { RiDownload2Line, RiAddLine, RiDeleteBin6Line } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import ExpenseFilters from '../../Components/Expenses/ExpenseFilters';
import ExpenseTable from '../../Components/Expenses/ExpenseTable';
import ExpenseForm from '../../Components/Expenses/ExpenseForm';
import ExpenseViewModal from '../../Components/Expenses/ExpenseViewModal';
import AddCategoryModal from '../../Components/Expenses/AddCategoryModal';
import PaymentForm from '../../Components/Payments/PaymentForm';
import DeleteModal from "../../Components/Common/DeleteModal";
import BulkDeleteModal from "../../Components/Common/BulkDeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getExpenseCategories, createExpenseCategory } from '../../services/categories';
import { createExpense, getExpenses, updateExpense, deleteExpense, bulkDeleteExpenses } from '../../services/expenses';
import { createPayment } from '../../services/payment';
import { getBankAccounts } from '../../services/bankAccount';
import { getContacts } from '../../services/contacts';
import { getCurrentMonthRange } from '../../utils/dateUtils';
import useCompanySelectionState from '../../hooks/useCompanySelection';

const ExpensesPage = () => {
    const currentMonthRange = getCurrentMonthRange();

    // State management
    const [state, setState] = useState({
        expenses: [],
        categories: [],
        bankAccounts: [],
        contacts: [],
        loading: false,
        searchTerm: '',
        pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
            currentPage: 1
        },
        filters: {
            categoryId: '',
            status: '',
            startDate: currentMonthRange.startDate,
            endDate: currentMonthRange.endDate
        },
        modals: {
            delete: false,
            main: false,
            category: false,
            view: false,
            export: false,
            bulkDelete: false,
            payment: false
        },
        selectedExpense: null,
        selectedExpenseForPayment: null,
        selectedItems: [],
        bulkDeleteLoading: false,
        isEditMode: false,
        newCategoryName: '',
        apiLoading: false
    });

    const {
        expenses, categories, bankAccounts, contacts, loading, searchTerm,
        pagination, filters, modals, selectedExpense, selectedExpenseForPayment, isEditMode,
        selectedItems, bulkDeleteLoading, newCategoryName, apiLoading
    } = state;

    // Use the modern company selection hook
    const { selectedCompanyId } = useCompanySelectionState();

    // API calls with loading states
    const fetchData = async () => {
        // Don't proceed if no company is selected
        if (!selectedCompanyId) {
            console.log('No company selected, skipping expenses fetch');
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const [expensesRes, categoriesRes, accountsRes, contactsRes] = await Promise.all([
                getExpenses({
                    page: pagination.page,
                    limit: pagination.limit,
                    categoryId: filters.categoryId,
                    status: filters.status,
                    startDate: filters.startDate,
                    endDate: filters.endDate
                }),
                getExpenseCategories(),
                getBankAccounts(),
                getContacts({ skipPagination: true })
            ]);

            setState(prev => ({
                ...prev,
                expenses: expensesRes.success ? expensesRes.expenses || [] : [],
                categories: categoriesRes.success ? categoriesRes.categories || [] : prev.categories,
                bankAccounts: accountsRes.success ? accountsRes.accounts || [] : prev.bankAccounts,
                contacts: contactsRes.success ? contactsRes.contacts || [] : prev.contacts,
                pagination: expensesRes.success ? {
                    page: expensesRes.pagination.currentPage || 1,
                    limit: expensesRes.pagination.limit || 10,
                    total: expensesRes.pagination.total || 0,
                    totalPages: expensesRes.pagination.totalPages || 1,
                    currentPage: expensesRes.pagination.currentPage || 1
                } : prev.pagination,
                loading: false,
                apiLoading: false
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                apiLoading: false,
                expenses: []
            }));
            toast.error("Failed to load data");
        }
    };

    useEffect(() => {
        if (selectedCompanyId) {
        fetchData();
        }
    }, [pagination.page, filters.categoryId, filters.status, filters.startDate, filters.endDate, selectedCompanyId]);

    // Modal handlers
    const toggleModal = (modalName, value) => {
        setState(prev => {
            const newModals = { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] };
            
            // Clear selectedExpense when main modal closes
            if (modalName === 'main' && !newModals[modalName]) {
                return {
                    ...prev,
                    modals: newModals,
                    selectedExpense: null,
                    isEditMode: false
                };
            }
            
            return {
                ...prev,
                modals: newModals
            };
        });
    };

    const handleAddClick = () => {
        // Clear any previous data and open modal for new expense
        setState(prev => ({
            ...prev,
            isEditMode: false,
            selectedExpense: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = (expense) => {
        // Use the current expense data directly - it should be fresh from the table
        setState(prev => ({
            ...prev,
            selectedExpense: expense,
            isEditMode: true,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleViewClick = (expense) => {
        setState(prev => ({
            ...prev,
            selectedExpense: expense,
            modals: { ...prev.modals, view: true }
        }));
    };

    const handleDeleteClick = (expense) => {
        setState(prev => ({
            ...prev,
            selectedExpense: expense,
            modals: { ...prev.modals, delete: true }
        }));
    };

    // CRUD operations
    const handleDeleteExpense = async () => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await deleteExpense(selectedExpense.id);
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    expenses: prev.expenses.filter(exp => exp.id !== selectedExpense.id),
                    modals: { ...prev.modals, delete: false },
                    apiLoading: false,
                    pagination: {
                        ...prev.pagination,
                        total: prev.pagination.total - 1
                    }
                }));
                toast.success("Expense deleted successfully");
                fetchData(); // Refresh the data to ensure pagination is correct
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error("Failed to delete expense");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedItems.length === 0) {
            toast.warning("Please select items to delete");
            return;
        }

        try {
            setState(prev => ({ ...prev, bulkDeleteLoading: true }));
            const response = await bulkDeleteExpenses(selectedItems);
            
            if (response.success) {
                toast.success(`${response.successCount} expenses deleted successfully`);
                if (response.errorCount > 0) {
                    toast.warning(`${response.errorCount} expenses could not be deleted`);
                }
                setState(prev => ({ 
                    ...prev, 
                    selectedItems: [],
                    modals: { ...prev.modals, bulkDelete: false }
                }));
                fetchData();
            } else {
                toast.error(response.message || "Failed to delete expenses");
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error("Failed to delete expenses");
        } finally {
            setState(prev => ({ ...prev, bulkDeleteLoading: false }));
        }
    };

    const handleSelectionChange = (newSelectedItems) => {
        setState(prev => ({ ...prev, selectedItems: newSelectedItems }));
    };

    const handleCreatePayment = (expense) => {
        // Only allow payment for pending expenses with remaining amount
        if (expense.status !== 'pending' || parseFloat(expense.remaining_amount || 0) <= 0) {
            toast.error("Payment can only be created for pending expenses with remaining amount");
            return;
        }

        setState(prev => ({
            ...prev,
            selectedExpenseForPayment: expense,
            modals: { ...prev.modals, payment: true }
        }));
    };

    const handleSubmitPayment = async (paymentData) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));

            const response = await createPayment(paymentData);

            if (response.success) {
                toast.success("Payment created successfully");
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, payment: false },
                    selectedExpenseForPayment: null,
                    apiLoading: false
                }));
                
                // Refresh the data to show updated amounts
                fetchData();
            } else {
                throw new Error(response.message || "Failed to create payment");
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message || "Failed to create payment");
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            toast.error("Category name cannot be empty");
            return;
        }

        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await createExpenseCategory(newCategoryName.trim());
            if (response.success) {
                toast.success("Category added successfully");
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, category: false },
                    newCategoryName: '',
                    apiLoading: false
                }));
                fetchData();
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.response?.data?.message || "Failed to add category");
        }
    };

    const handleSubmitExpense = async (values) => {
        try {
            console.log('handleSubmitExpense called with values:', values);
            setState(prev => ({ ...prev, apiLoading: true }));
            const payload = {
                id: values.id,
                date: values.date,
                categoryId: values.categoryId,
                amount: values.amount.toString(),
                notes: values.notes || '',
                paymentAdjustmentChoice: values.paymentAdjustmentChoice // Include payment adjustment choice
            };

            // Always include all payment-related fields to ensure proper clearing
            if (values.paymentMethod === 'bank') {
                // Direct bank payment - clear contact fields
                payload.bankAccountId = values.bankAccountId;
                payload.contactId = null;
                payload.status = 'paid'; // Direct bank payments are always paid
                payload.dueDate = null;
            } else if (values.paymentMethod === 'contact') {
                // Contact payment
                payload.contactId = values.contactId;
                payload.status = values.status;
                
                if (values.status === 'pending') {
                    payload.dueDate = values.dueDate;
                    payload.bankAccountId = null; // Clear bank account for pending
                } else if (values.status === 'paid') {
                    payload.bankAccountId = values.bankAccountId; // The bank account used to pay to the contact
                    payload.dueDate = null; // Clear due date for paid
                }
            }

            console.log('Final payload:', payload);

            const response = isEditMode
                ? await updateExpense(payload)
                : await createExpense(payload);

            console.log('API response:', response);

            if (response.success) {
                toast.success(`Expense ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false
                }));
                fetchData();
            }
        } catch (error) {
            console.error('Error in handleSubmitExpense:', error);
            setState(prev => ({ ...prev, apiLoading: false }));
            
            // If it's a payment conflict (409), let the form component handle it
            if (error.status === 409 && error.data?.paymentConflict) {
                throw error; // Re-throw to let ExpenseForm handle the payment adjustment modal
            }
            
            // Handle other errors with toast
            toast.error(error.data?.message || error.message || `Failed to ${isEditMode ? 'update' : 'create'} expense`);
        }
    };

    // Filter and pagination
    const handlePageChange = (page) => {
        setState(prev => ({
            ...prev,
            pagination: {
                ...prev.pagination,
                page: page,
                currentPage: page
            }
        }));
    };

    const handleFilterChange = (newFilters) => {
        setState(prev => ({
            ...prev,
            filters: newFilters,
            pagination: { ...prev.pagination, page: 1 }
        }));
    };

    const prepareExportData = () => {
        // Export only selected items if any are selected, otherwise export all
        const itemsToExport = selectedItems.length > 0 
            ? expenses.filter(expense => selectedItems.includes(expense.id))
            : expenses;

        console.log('📊 Expenses CSV Export:', {
            totalExpenses: expenses.length,
            selectedCount: selectedItems.length,
            exportingCount: itemsToExport.length,
            exportType: selectedItems.length > 0 ? 'Selected items only' : 'All items'
        });

        return itemsToExport.map(expense => ({
            'Date': new Date(expense.date).toLocaleDateString(),
            'Category': expense.categoryName || 'N/A',
            'Amount': parseFloat(expense.amount || 0).toFixed(2),
            'Contact': expense.contactName || 'N/A',
            'Bank Account': expense.bankAccountName || 'N/A',
            'Notes': expense.notes || '',
            'Status': expense.status ? expense.status.charAt(0).toUpperCase() + expense.status.slice(1) : '',
            'Created At': new Date(expense.createdAt).toLocaleString()
        }));
    };

    const filteredExpenses = useMemo(() => {
        if (!searchTerm) return expenses;
        const term = searchTerm.toLowerCase();
        return expenses.filter(expense =>
            expense.notes?.toLowerCase().includes(term) ||
            (expense.categoryName?.toLowerCase().includes(term)) ||
            (expense.bankAccountName?.toLowerCase().includes(term))
        );
    }, [expenses, searchTerm]);

    return (
        <div className="page-content">
            <Container fluid>
                <BreadCrumb title="Expenses" pageTitle="Finance" />

                <ExpenseFilters
                    categories={categories}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    currentMonthRange={currentMonthRange}
                    onAddCategory={() => toggleModal('category', true)}
                />

                <Row className="mb-3">
                    <Col sm={12} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-middle me-1" /> Export
                            </Button>
                            {selectedItems.length > 0 && (
                                <Button color="danger" onClick={() => toggleModal('bulkDelete', true)}>
                                    <RiDeleteBin6Line className="align-middle me-1" /> Delete ({selectedItems.length})
                                </Button>
                            )}
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-middle me-1" /> Add Expense
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <ExpenseTable
                        expenses={filteredExpenses}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onView={handleViewClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onCreatePayment={handleCreatePayment}
                        selectedItems={selectedItems}
                        onSelectionChange={handleSelectionChange}
                    />
                )}

                <ExpenseForm
                    key={`expense-form-${selectedExpense?.id || 'new'}`}
                    isOpen={modals.main}
                    toggle={() => toggleModal('main')}
                    isEditMode={isEditMode}
                    categories={categories}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    selectedExpense={selectedExpense}
                    onSubmit={handleSubmitExpense}
                    isLoading={apiLoading}
                    onAddCategory={() => toggleModal('category', true)}
                />

                <ExpenseViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    expense={selectedExpense}
                />

                <AddCategoryModal
                    isOpen={modals.category}
                    toggle={() => toggleModal('category')}
                    categoryName={newCategoryName}
                    onCategoryNameChange={(e) => setState(prev => ({ ...prev, newCategoryName: e.target.value }))}
                    onAddCategory={handleAddCategory}
                    isLoading={apiLoading}
                />

                <DeleteModal
                    show={modals.delete}
                    onDeleteClick={handleDeleteExpense}
                    onCloseClick={() => toggleModal('delete', false)}
                    isLoading={apiLoading}
                />

                <BulkDeleteModal
                    isOpen={modals.bulkDelete}
                    toggle={() => toggleModal('bulkDelete', false)}
                    selectedCount={selectedItems.length}
                    onConfirm={handleBulkDelete}
                    isLoading={bulkDeleteLoading}
                />

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="expenses"
                />

                <PaymentForm
                    isOpen={modals.payment}
                    toggle={() => toggleModal('payment', false)}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    onSubmit={handleSubmitPayment}
                    isLoading={apiLoading}
                    selectedInvoice={selectedExpenseForPayment}
                    invoiceType="expense"
                />

                <PaymentForm
                    isOpen={modals.payment}
                    toggle={() => toggleModal('payment', false)}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    onSubmit={handleSubmitPayment}
                    isLoading={apiLoading}
                    selectedInvoice={selectedExpenseForPayment}
                    invoiceType="expense"
                />
            </Container>
            <ToastContainer closeButton={false} position="top-right" />
        </div>
    );
};

export default ExpensesPage;
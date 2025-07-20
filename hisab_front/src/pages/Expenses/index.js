import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast } from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import ExpenseFilters from '../../Components/Expenses/ExpenseFilters';
import ExpenseTable from '../../Components/Expenses/ExpenseTable';
import ExpenseForm from '../../Components/Expenses/ExpenseForm';
import ExpenseViewModal from '../../Components/Expenses/ExpenseViewModal';
import AddCategoryModal from '../../Components/Expenses/AddCategoryModal';
import DeleteModal from "../../Components/Common/DeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getExpenseCategories, createExpenseCategory } from '../../services/categories';
import { createExpense, getExpenses, updateExpense, deleteExpense } from '../../services/expenses';
import { getBankAccounts } from '../../services/bankAccount';
import { getCurrentMonthRange } from '../../utils/dateUtils';

const ExpensesPage = () => {
    const currentMonthRange = getCurrentMonthRange();

    // State management
    const [state, setState] = useState({
        expenses: [],
        categories: [],
        bankAccounts: [],
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
            startDate: currentMonthRange.startDate,
            endDate: currentMonthRange.endDate
        },
        modals: {
            delete: false,
            main: false,
            category: false,
            view: false,
            export: false
        },
        selectedExpense: null,
        isEditMode: false,
        newCategoryName: '',
        apiLoading: false
    });

    const {
        expenses, categories, bankAccounts, loading, searchTerm,
        pagination, filters, modals, selectedExpense, isEditMode,
        newCategoryName, apiLoading
    } = state;

    // API calls with loading states
    const fetchData = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const [expensesRes, categoriesRes, accountsRes] = await Promise.all([
                getExpenses({
                    page: pagination.page,
                    limit: pagination.limit,
                    categoryId: filters.categoryId,
                    startDate: filters.startDate,
                    endDate: filters.endDate
                }),
                getExpenseCategories(),
                getBankAccounts()
            ]);

            setState(prev => ({
                ...prev,
                expenses: expensesRes.success ? expensesRes.expenses || [] : [],
                categories: categoriesRes.success ? categoriesRes.categories || [] : prev.categories,
                bankAccounts: accountsRes.success ? accountsRes.accounts || [] : prev.bankAccounts,
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
        fetchData();
    }, [pagination.page, filters.categoryId, filters.startDate, filters.endDate]);

    // Modal handlers
    const toggleModal = (modalName, value) => {
        setState(prev => ({
            ...prev,
            modals: { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] }
        }));
    };

    const handleAddClick = () => {
        setState(prev => ({
            ...prev,
            isEditMode: false,
            selectedExpense: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = (expense) => {
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
            setState(prev => ({ ...prev, apiLoading: true }));
            const payload = {
                id: values.id,
                date: values.date,
                categoryId: values.categoryId,
                bankAccountId: values.bankAccountId,
                amount: values.amount.toString(),
                notes: values.notes || ''
            };

            const response = isEditMode
                ? await updateExpense(payload)
                : await createExpense(payload);

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
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} expense`);
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
        return expenses.map(expense => ({
            'Date': new Date(expense.date).toLocaleDateString(),
            'Category': expense.categoryName || 'N/A',
            'Amount': parseFloat(expense.amount || 0).toFixed(2),
            'Bank Account': expense.bankAccountName || 'N/A',
            'Notes': expense.notes || '',
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
                                <RiDownload2Line className="align-bottom" /> Export
                            </Button>
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-bottom" /> Add Expense
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
                    />
                )}

                <ExpenseForm
                    isOpen={modals.main}
                    toggle={() => toggleModal('main')}
                    isEditMode={isEditMode}
                    categories={categories}
                    bankAccounts={bankAccounts}
                    selectedExpense={selectedExpense}
                    onSubmit={handleSubmitExpense}
                    isLoading={apiLoading}
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

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="expenses"
                />
            </Container>
        </div>
    );
};

export default ExpensesPage;
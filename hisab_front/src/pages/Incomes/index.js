import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast , ToastContainer} from 'react-toastify';
import { RiDownload2Line, RiAddLine, RiDeleteBin6Line } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import IncomeFilters from '../../Components/Incomes/IncomeFilters';
import IncomeTable from '../../Components/Incomes/IncomeTable';
import IncomeForm from '../../Components/Incomes/IncomeForm';
import IncomeViewModal from '../../Components/Incomes/IncomeViewModal';
import AddCategoryModal from '../../Components/Incomes/AddCategoryModal';
import PaymentForm from '../../Components/Payments/PaymentForm';
import DeleteModal from "../../Components/Common/DeleteModal";
import BulkDeleteModal from "../../Components/Common/BulkDeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getIncomeCategories, createIncomeCategory } from '../../services/categories';
import { getBankAccounts } from '../../services/bankAccount';
import { getContacts } from '../../services/contacts';
import { getCurrentMonthRange } from '../../utils/dateUtils';
import { createIncome, deleteIncome, bulkDeleteIncomes, getIncomes, updateIncome } from '../../services/incomes.js';
import { createPayment } from '../../services/payment';
import { getSelectedCompanyId } from '../../utils/apiCall';
import useCompanySelectionState from '../../hooks/useCompanySelection';

const IncomesPage = () => {
    document.title = "Incomes | Vyavhar - React Admin & Dashboard Template";

    const currentMonthRange = getCurrentMonthRange();

    const [state, setState] = useState({
        incomes: [],
        categories: [],
        bankAccounts: [],
        contacts: [],
        loading: false,
        apiLoading: false,
        modal: false,
        isEditMode: false,
        currentIncome: null,
        deleteModal: false,
        incomeToDelete: null,
        selectedIncome: null,
        statementModal: false,
        selectedIncomeForStatement: null,
        searchTerm: '',
        currentPage: 1,
        itemsPerPage: 10,
        exportModal: false,
        viewMode: 'grid',
        modals: {
            delete: false,
            main: false,
            view: false,
            export: false,
            category: false,
            bulkDelete: false,
            payment: false
        },
        selectedIncomeForPayment: null,
        selectedItems: [],
        bulkDeleteLoading: false,
        newCategoryName: ''
    });

    const {
        incomes,
        categories,
        bankAccounts,
        contacts,
        loading,
        apiLoading,
        modal,
        isEditMode,
        currentIncome,
        deleteModal,
        incomeToDelete,
        selectedIncome,
        statementModal,
        selectedIncomeForStatement,
        searchTerm,
        currentPage,
        itemsPerPage,
        exportModal,
        viewMode,
        modals,
        selectedItems,
        selectedIncomeForPayment,
        bulkDeleteLoading,
        newCategoryName
    } = state;

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
        currentPage: 1
    });

    const [filters, setFilters] = useState({
        categoryId: '',
        startDate: currentMonthRange.startDate,
        endDate: currentMonthRange.endDate,
        status: 'all'
    });

    // Use the new company selection hook
    const { selectedCompanyId } = useCompanySelectionState();

    // Debug: Monitor selectedIncomeForPayment state changes
    useEffect(() => {
        console.log('🔍 selectedIncomeForPayment state changed:', selectedIncomeForPayment);
    }, [selectedIncomeForPayment]);

    // API calls with loading states
    const fetchData = async () => {
        // Don't proceed if no company is selected
        if (!selectedCompanyId) {
            console.log('No company selected, skipping incomes fetch');
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            // Prepare API parameters
            const apiParams = {
                    page: pagination.page,
                    limit: pagination.limit,
                    categoryId: filters.categoryId,
                    startDate: filters.startDate,
                endDate: filters.endDate
            };
            
            // Only include status if it's not 'all'
            if (filters.status && filters.status !== 'all') {
                apiParams.status = filters.status;
            }

            const [incomesRes, categoriesRes, accountsRes, contactsRes] = await Promise.all([
                getIncomes(apiParams),
                getIncomeCategories(),
                getBankAccounts(),
                getContacts({ skipPagination: true })
            ]);

            setState(prev => ({
                ...prev,
                incomes: incomesRes.success ? incomesRes.incomes || [] : [],
                categories: categoriesRes.success ? categoriesRes.categories || [] : prev.categories,
                bankAccounts: accountsRes.success ? accountsRes.accounts || [] : prev.bankAccounts,
                contacts: contactsRes.success ? contactsRes.contacts || [] : prev.contacts,
                pagination: incomesRes.success ? {
                    page: incomesRes.pagination.currentPage || 1,
                    limit: incomesRes.pagination.limit || 10,
                    total: incomesRes.pagination.total || 0,
                    totalPages: incomesRes.pagination.totalPages || 1,
                    currentPage: incomesRes.pagination.currentPage || 1
                } : prev.pagination,
                loading: false,
                apiLoading: false
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                apiLoading: false,
                incomes: []
            }));
            toast.error("Failed to load data");
        }
    };

    useEffect(() => {
        if (selectedCompanyId) {
            fetchData();
        }
    }, [pagination.page, filters.categoryId, filters.startDate, filters.endDate, filters.status, selectedCompanyId]);

    // Modal handlers
    const toggleModal = (modalName, value) => {
        setState(prev => {
            const newModals = { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] };
            
            // Clear selectedIncome when main modal closes
            if (modalName === 'main' && !newModals[modalName]) {
                return {
                    ...prev,
                    modals: newModals,
                    selectedIncome: null,
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
        // Clear any previous data and open modal for new income
        setState(prev => ({
            ...prev,
            isEditMode: false,
            selectedIncome: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = (income) => {
        // Use the current income data directly - it should be fresh from the table
        setState(prev => ({
            ...prev,
            selectedIncome: income,
            isEditMode: true,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleViewClick = (income) => {
        setState(prev => ({
            ...prev,
            selectedIncome: income,
            modals: { ...prev.modals, view: true }
        }));
    };

    const handleDeleteClick = (income) => {
        setState(prev => ({
            ...prev,
            selectedIncome: income,
            modals: { ...prev.modals, delete: true }
        }));
    };

    // CRUD operations
    const handleDeleteIncome = async () => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await deleteIncome(selectedIncome.id);
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    incomes: prev.incomes.filter(inc => inc.id !== selectedIncome.id),
                    modals: { ...prev.modals, delete: false },
                    apiLoading: false,
                    pagination: {
                        ...prev.pagination,
                        total: prev.pagination.total - 1
                    }
                }));
                toast.success("Income deleted successfully");
                fetchData(); // Refresh the data to ensure pagination is correct
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error("Failed to delete income");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedItems.length === 0) {
            toast.warning("Please select items to delete");
            return;
        }

        try {
            setState(prev => ({ ...prev, bulkDeleteLoading: true }));
            const response = await bulkDeleteIncomes(selectedItems);
            
            if (response.success) {
                toast.success(`${response.successCount} incomes deleted successfully`);
                if (response.errorCount > 0) {
                    toast.warning(`${response.errorCount} incomes could not be deleted`);
                }
                setState(prev => ({ 
                    ...prev, 
                    selectedItems: [],
                    modals: { ...prev.modals, bulkDelete: false }
                }));
                fetchData();
            } else {
                toast.error(response.message || "Failed to delete incomes");
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error("Failed to delete incomes");
        } finally {
            setState(prev => ({ ...prev, bulkDeleteLoading: false }));
        }
    };

    const handleSelectionChange = (newSelectedItems) => {
        setState(prev => ({ ...prev, selectedItems: newSelectedItems }));
    };

    const handleCreatePayment = (income) => {
        console.log('🎯 handleCreatePayment called with income:', income);
        
        // Only allow payment for pending incomes with remaining amount
        if (income.status !== 'pending' || parseFloat(income.remaining_amount || 0) <= 0) {
            toast.error("Payment can only be created for pending incomes with remaining amount");
            return;
        }

        console.log('✅ Setting selectedIncomeForPayment and opening payment modal');
        setState(prev => ({
            ...prev,
            selectedIncomeForPayment: income,
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
                    selectedIncomeForPayment: null,
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
            const response = await createIncomeCategory(newCategoryName.trim());
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

    const handleSubmitIncome = async (values) => {
        try {
            console.log('handleSubmitIncome called with values:', values);
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
                    payload.bankAccountId = values.bankAccountId; // The bank account used to receive from the contact
                    payload.dueDate = null; // Clear due date for paid
                }
            }

            console.log('Final payload:', payload);

            const response = isEditMode
                ? await updateIncome(payload)
                : await createIncome(payload);

            console.log('API response:', response);

            if (response.success) {
                toast.success(`Income ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false
                }));
                fetchData();
            }
        } catch (error) {
            console.error('Error in handleSubmitIncome:', error);
            setState(prev => ({ ...prev, apiLoading: false }));
            
            // If it's a payment conflict (409), let the form component handle it
            if (error.status === 409 && error.data?.paymentConflict) {
                throw error; // Re-throw to let IncomeForm handle the payment adjustment modal
            }
            
            // Handle other errors with toast
            toast.error(error.data?.message || error.message || `Failed to ${isEditMode ? 'update' : 'create'} income`);
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
        console.log('Filter change:', newFilters);
        setFilters(newFilters);
        setPagination(prev => ({ ...prev, page: 1, currentPage: 1 }));
    };

    const prepareExportData = () => {
        // Export only selected items if any are selected, otherwise export all
        const itemsToExport = selectedItems.length > 0 
            ? incomes.filter(income => selectedItems.includes(income.id))
            : incomes;

        console.log('📊 Incomes CSV Export:', {
            totalIncomes: incomes.length,
            selectedCount: selectedItems.length,
            exportingCount: itemsToExport.length,
            exportType: selectedItems.length > 0 ? 'Selected items only' : 'All items'
        });

        return itemsToExport.map(income => ({
            'Date': new Date(income.date).toLocaleDateString(),
            'Category': income.categoryName || 'N/A',
            'Amount': parseFloat(income.amount || 0).toFixed(2),
            'Payment Method': income.bankAccountName && !income.contactName ? 'Bank Account' 
                           : income.contactName ? 'Contact' 
                           : 'N/A',
            'Bank Account': income.bankAccountName || 'N/A',
            'Contact': income.contactName || 'N/A',
            'Status': income.status || 'Paid',
            'Due Date': income.dueDate ? new Date(income.dueDate).toLocaleDateString() : 'N/A',
            'Notes': income.notes || '',
            'Created At': new Date(income.createdAt).toLocaleString()
        }));
    };

    const filteredIncomes = useMemo(() => {
        if (!searchTerm) return incomes;
        const term = searchTerm.toLowerCase();
        return incomes.filter(income =>
            income.notes?.toLowerCase().includes(term) ||
            (income.categoryName?.toLowerCase().includes(term)) ||
            (income.bankAccountName?.toLowerCase().includes(term)) ||
            (income.contactName?.toLowerCase().includes(term))
        );
    }, [incomes, searchTerm]);

    return (
        <div className="page-content">
            <ToastContainer closeButton={false} position="top-right" />                                                                                                                                             
            <Container fluid>
                <BreadCrumb title="Incomes" pageTitle="Finance" />

                <IncomeFilters
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
                                <RiAddLine className="align-middle me-1" /> Add Income
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <IncomeTable
                        incomes={filteredIncomes}
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

                <IncomeForm
                    key={`income-form-${selectedIncome?.id || 'new'}`}
                    isOpen={modals.main}
                    toggle={() => toggleModal('main')}
                    isEditMode={isEditMode}
                    categories={categories}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    selectedIncome={selectedIncome}
                    onSubmit={handleSubmitIncome}
                    isLoading={apiLoading}
                    onAddCategory={() => toggleModal('category', true)}
                />

                <IncomeViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    income={selectedIncome}
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
                    onDeleteClick={handleDeleteIncome}
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
                    filename="incomes"
                />

                <PaymentForm
                    isOpen={modals.payment}
                    toggle={() => toggleModal('payment', false)}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    onSubmit={handleSubmitPayment}
                    isLoading={apiLoading}
                    selectedInvoice={selectedIncomeForPayment}
                    invoiceType="income"
                />
            </Container>
        </div>
    );
};

export default IncomesPage;
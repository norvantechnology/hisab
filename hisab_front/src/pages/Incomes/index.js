import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast , ToastContainer} from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import IncomeFilters from '../../Components/Incomes/IncomeFilters';
import IncomeTable from '../../Components/Incomes/IncomeTable';
import IncomeForm from '../../Components/Incomes/IncomeForm';
import IncomeViewModal from '../../Components/Incomes/IncomeViewModal';
import AddCategoryModal from '../../Components/Incomes/AddCategoryModal';
import DeleteModal from "../../Components/Common/DeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getIncomeCategories, createIncomeCategory } from '../../services/categories';
import { getBankAccounts } from '../../services/bankAccount';
import { getContacts } from '../../services/contacts';
import { getCurrentMonthRange } from '../../utils/dateUtils';
import { createIncome, deleteIncome, getIncomes, updateIncome } from '../../services/incomes.js';
import { getSelectedCompanyId } from '../../utils/apiCall';

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
            category: false
        },
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

    const [selectedCompanyId, setSelectedCompanyId] = useState(null);

    // Check for selected company ID
    useEffect(() => {
        const checkCompanyId = () => {
            const companyId = getSelectedCompanyId();
            setSelectedCompanyId(companyId);
        };
        
        // Check immediately
        checkCompanyId();
        
        // Also check when localStorage changes (in case company selection happens)
        const handleStorageChange = () => {
            checkCompanyId();
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Check periodically to catch company selection
        const interval = setInterval(checkCompanyId, 1000);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    // API calls with loading states
    const fetchData = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const [incomesRes, categoriesRes, accountsRes, contactsRes] = await Promise.all([
                getIncomes({
                    page: pagination.page,
                    limit: pagination.limit,
                    categoryId: filters.categoryId,
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                    status: filters.status
                }),
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
        fetchData();
    }, [pagination.page, filters.categoryId, filters.startDate, filters.endDate, filters.status]);

    // Only fetch data when a company is selected
    useEffect(() => {
        if (selectedCompanyId) {
            fetchData();
        }
    }, [selectedCompanyId]);

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
                notes: values.notes || ''
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
            toast.error(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} income`);
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
        return incomes.map(income => ({
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

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="incomes"
                />
            </Container>
        </div>
    );
};

export default IncomesPage;
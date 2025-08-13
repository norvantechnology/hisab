import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast } from 'react-toastify';
import { RiDownload2Line, RiAddLine, RiUpload2Line } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import ContactsFilter from '../../Components/Contacts/ContactsFilter';
import ContactsTable from '../../Components/Contacts/ContactsTable';
import ContactForm from '../../Components/Contacts/ContactForm';
import ContactViewModal from '../../Components/Contacts/ContactViewModal';
import DeleteModal from "../../Components/Common/DeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import ImportCSVModal from '../../Components/Common/ImportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getContacts, createContact, deleteContact, updateContact, bulkImportContacts } from '../../services/contacts';
import { getBankAccounts } from '../../services/bankAccount';
import { sampleContactData, contactFields } from '../../data/contactData';
import { getSelectedCompanyId } from '../../utils/apiCall';

const ContactsPage = () => {
    document.title = "Contacts | Vyavhar - React Admin & Dashboard Template";

    const [state, setState] = useState({
        contacts: [],
        bankAccounts: [],
        loading: false,
        apiLoading: false,
        modal: false,
        isEdit: false,
        currentContact: null,
        deleteModal: false,
        contactToDelete: null,
        selectedContact: null,
        statementModal: false,
        selectedContactForStatement: null,
        searchTerm: '',
        currentPage: 1,
        itemsPerPage: 10,
        exportModal: false,
        viewMode: 'grid',
        contactTypeFilter: 'all',
        balanceTypeFilter: 'all'
    });

    const {
        contacts,
        bankAccounts,
        loading,
        apiLoading,
        modal,
        isEdit,
        currentContact,
        deleteModal,
        contactToDelete,
        selectedContact,
        statementModal,
        selectedContactForStatement,
        searchTerm,
        currentPage,
        itemsPerPage,
        exportModal,
        viewMode,
        contactTypeFilter,
        balanceTypeFilter
    } = state;

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
        currentPage: 1
    });

    const [filters, setFilters] = useState({
        contactType: 'all',
        balanceType: 'all',
        search: ''
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

            const response = await getContacts({
                page: pagination.page,
                limit: pagination.limit,
                contactType: filters.contactType,
                balanceType: filters.balanceType,
                search: filters.search
            });

            setState(prev => ({
                ...prev,
                contacts: response?.success ? response.contacts || [] : [],
                pagination: {
                    page: response?.pagination?.currentPage || 1,
                    limit: response?.pagination?.limit || 10,
                    total: response?.pagination?.total || 0,
                    totalPages: response?.pagination?.totalPages || 1,
                    currentPage: response?.pagination?.currentPage || 1
                },
                loading: false,
                apiLoading: false
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                apiLoading: false,
                contacts: []
            }));
            toast.error("Failed to load contacts");
        }
    };

    const fetchBankAccounts = async () => {
        // Don't proceed if no company is selected
        if (!selectedCompanyId) {
            console.log('No company selected, skipping bank accounts fetch');
            return;
        }

        try {
            const response = await getBankAccounts({ includeInactive: false });
            setState(prev => ({
                ...prev,
                bankAccounts: response?.success ? response.accounts || [] : []
            }));
        } catch (error) {
            console.error("Failed to load bank accounts:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [pagination.page, filters.contactType, filters.balanceType, filters.search]);

    // Only fetch bank accounts when a company is selected
    useEffect(() => {
        if (selectedCompanyId) {
            fetchBankAccounts();
        }
    }, [selectedCompanyId]);

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
            selectedContact: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = (contact) => {
        setState(prev => ({
            ...prev,
            selectedContact: contact,
            isEditMode: true,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleViewClick = (contact) => {
        setState(prev => ({
            ...prev,
            selectedContact: contact,
            modals: { ...prev.modals, view: true }
        }));
    };

    const handleDeleteClick = (contact) => {
        setState(prev => ({
            ...prev,
            selectedContact: contact,
            modals: { ...prev.modals, delete: true }
        }));
    };

    // CRUD operations
    const handleDeleteContact = async () => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await deleteContact(selectedContact.id);
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    contacts: prev.contacts.filter(c => c.id !== selectedContact.id),
                    modals: { ...prev.modals, delete: false },
                    apiLoading: false,
                    pagination: {
                        ...prev.pagination,
                        total: prev.pagination.total - 1
                    }
                }));
                toast.success("Contact deleted successfully");
                fetchData();
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error("Failed to delete contact");
        }
    };

    const handleSubmitContact = async (values) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            
            const payload = {
                id: values.id,
                gstin: values.gstin,
                name: values.name,
                mobile: values.mobile,
                email: values.email,
                dueDays: values.dueDays,
                contactType: values.contactType,
                billingAddress1: values.billingAddress1,
                billingAddress2: values.billingAddress2,
                billingCity: values.billingCity,
                billingPincode: values.billingPincode,
                billingState: values.billingState,
                billingCountry: values.billingCountry,
                isShippingSame: values.isShippingSame,
                shippingAddress1: values.isShippingSame ? values.billingAddress1 : values.shippingAddress1,
                shippingAddress2: values.isShippingSame ? values.billingAddress2 : values.shippingAddress2,
                shippingCity: values.isShippingSame ? values.billingCity : values.shippingCity,
                shippingPincode: values.isShippingSame ? values.billingPincode : values.shippingPincode,
                shippingState: values.isShippingSame ? values.billingState : values.shippingState,
                shippingCountry: values.isShippingSame ? values.billingCountry : values.shippingCountry,
                openingBalanceType: values.openingBalanceType,
                openingBalance: values.openingBalance.toString(),
                enablePortal: values.enablePortal,
                notes: values.notes
            };

            const response = isEditMode
                ? await updateContact(payload)
                : await createContact(payload);

            if (response?.success) {
                toast.success(`Contact ${isEditMode ? 'updated' : 'created'} successfully!`);
                toggleModal('main', false);
                fetchData();
            } else {
                toast.error(response?.message || `Failed to ${isEditMode ? 'update' : 'create'} contact`);
            }
        } catch (error) {
            console.error('Error submitting contact:', error);
            toast.error(`Failed to ${isEditMode ? 'update' : 'create'} contact`);
        } finally {
            setState(prev => ({ ...prev, apiLoading: false }));
        }
    };

    const handleBulkImport = async (contacts, onComplete) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            
            const response = await bulkImportContacts({ contacts });
            
            if (response?.success) {
                const { results } = response;
                const successCount = results.success.length;
                const errorCount = results.errors.length;
                
                if (successCount > 0) {
                    toast.success(`Successfully imported ${successCount} contacts!`);
                }
                
                if (errorCount > 0) {
                    toast.warning(`${errorCount} contacts had errors. Check the import results.`);
                }
                
                // Refresh the contacts list
                fetchData();
                
                if (onComplete) {
                    onComplete();
                }
            } else {
                toast.error(response?.message || 'Failed to import contacts');
            }
        } catch (error) {
            console.error('Error importing contacts:', error);
            toast.error('Failed to import contacts');
        } finally {
            setState(prev => ({ ...prev, apiLoading: false }));
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
        return contacts.map(contact => ({
            'Name': contact.name || 'N/A',
            'GSTIN': contact.gstin || 'N/A',
            'Type': contact.contactType ? contact.contactType.charAt(0).toUpperCase() + contact.contactType.slice(1) : 'N/A',
            'Mobile': contact.mobile || 'N/A',
            'Email': contact.email || 'N/A',
            'Balance': contact.balanceType === 'none' ? '₹0.00' : 
                     `${contact.balanceType === 'receivable' ? '+' : '-'}₹${Math.abs(parseFloat(contact.openingBalance || 0)).toFixed(2)}`,
            'City': contact.billingCity || 'N/A',
            'State': contact.billingState || 'N/A',
            'Due Days': contact.dueDays ? `${contact.dueDays} days` : 'N/A',
            'Status': contact.enablePortal ? 'Active' : 'Inactive',
            'Created At': new Date(contact.createdAt).toLocaleString()
        }));
    };

    const filteredContacts = useMemo(() => {
        if (!searchTerm) return contacts;
        const term = searchTerm.toLowerCase();
        return contacts.filter(contact =>
            contact.name?.toLowerCase().includes(term) ||
            contact.gstin?.toLowerCase().includes(term) ||
            contact.mobile?.toLowerCase().includes(term) ||
            contact.email?.toLowerCase().includes(term) ||
            contact.billingCity?.toLowerCase().includes(term) ||
            contact.billingState?.toLowerCase().includes(term)
        );
    }, [contacts, searchTerm]);

    return (
        <div className="page-content">
            <Container fluid>
                <BreadCrumb title="Contacts" pageTitle="Finance" />

                <ContactsFilter
                    filters={filters}
                    onFilterChange={handleFilterChange}
                />

                <Row className="mb-3">
                    <Col sm={12} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-middle me-1" /> Export
                            </Button>
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-middle me-1" /> Add Contact
                            </Button>
                            <Button color="info" onClick={() => toggleModal('import', true)}>
                                <RiUpload2Line className="align-middle me-1" /> Import
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <ContactsTable
                        contacts={filteredContacts || []}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onView={handleViewClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                    />
                )}

                <ContactForm
                    isOpen={modals.main}
                    toggle={() => toggleModal('main')}
                    isEditMode={isEditMode}
                    selectedContact={selectedContact}
                    onSubmit={handleSubmitContact}
                    isLoading={apiLoading}
                />

                <ContactViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    contact={selectedContact}
                    bankAccounts={bankAccounts}
                    onPaymentSuccess={fetchData}
                />

                <DeleteModal
                    show={modals.delete}
                    onDeleteClick={handleDeleteContact}
                    onCloseClick={() => toggleModal('delete', false)}
                    isLoading={apiLoading}
                />

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="contacts"
                />

                <ImportCSVModal
                    show={modals.import}
                    onCloseClick={() => toggleModal('import', false)}
                    onImport={handleBulkImport}
                    sampleData={sampleContactData}
                    requiredFields={contactFields.required}
                    optionalFields={contactFields.optional}
                    maxFileSize={10}
                    isLoading={apiLoading}
                    title="Import Contacts"
                    description="Upload a CSV file to import multiple contacts at once. Download the sample file to see the required format."
                />
            </Container>
        </div>
    );
};

export default ContactsPage;
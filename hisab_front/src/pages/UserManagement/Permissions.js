import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast } from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import ContactsFilter from '../../Components/Contacts/ContactsFilter';
import ContactsTable from '../../Components/Contacts/ContactsTable';
import ContactForm from '../../Components/Contacts/ContactForm';
import ContactViewModal from '../../Components/Contacts/ContactViewModal';
import DeleteModal from "../../Components/Common/DeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getCurrentMonthRange } from '../../utils/dateUtils';
import { getContacts, createContact, deleteContact, updateContact } from '../../services/contacts';

const ContactsPage = () => {
    const currentMonthRange = getCurrentMonthRange();

    // State management
    const [state, setState] = useState({
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
            contactType: '',
            balanceType: '',
            search: '',
            startDate: currentMonthRange.startDate,
            endDate: currentMonthRange.endDate
        },
        modals: {
            delete: false,
            main: false,
            view: false,
            export: false
        },
        selectedContact: null,
        isEditMode: false,
        apiLoading: false
    });

    const {
        contacts, loading, searchTerm,
        pagination, filters, modals, selectedContact, isEditMode,
        apiLoading
    } = state;

    // API calls with loading states
    const fetchData = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const response = await getContacts({
                page: pagination.page,
                limit: pagination.limit,
                contactType: filters.contactType,
                balanceType: filters.balanceType,
                search: filters.search,
                startDate: filters.startDate,
                endDate: filters.endDate
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

    useEffect(() => {
        fetchData();
    }, [pagination.page, filters.contactType, filters.balanceType, filters.search, filters.startDate, filters.endDate]);

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
                currency: values.currency,
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
                openingBalance: values.openingBalance.toString(),
                balanceType: values.balanceType,
                enablePortal: values.enablePortal,
                notes: values.notes
            };

            const response = isEditMode
                ? await updateContact(payload)
                : await createContact(payload);

            if (response.success) {
                toast.success(`Contact ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false
                }));
                fetchData();
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} contact`);
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
            'Type': contact.isCustomer && contact.isVendor ? 'Customer & Vendor' : 
                  contact.isCustomer ? 'Customer' : 
                  contact.isVendor ? 'Vendor' : 'N/A',
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
                    currentMonthRange={currentMonthRange}
                />

                <Row className="mb-3">
                    <Col sm={12} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-bottom" /> Export
                            </Button>
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-bottom" /> Add Contact
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
            </Container>
        </div>
    );
};

export default ContactsPage;
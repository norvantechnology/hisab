import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import PaymentFilter from '../../Components/Payments/PaymentFilter';
import PaymentTable from '../../Components/Payments/PaymentTable';
import PaymentForm from '../../Components/Payments/PaymentForm';
import PaymentViewModal from '../../Components/Payments/PaymentViewModal';
import DeleteModal from "../../Components/Common/DeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getBankAccounts } from '../../services/bankAccount';
import { getContacts } from '../../services/contacts';
import { getCurrentMonthRange } from '../../utils/dateUtils';
import { createPayment, deletePayment, listPayments, updatePayment } from '../../services/payment';
import useCompanySelectionState from '../../hooks/useCompanySelection';

const PaymentsPage = () => {
    const currentMonthRange = getCurrentMonthRange();
    const [state, setState] = useState({
        payments: [],
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
            contactId: '',
            bankId: '',
            type: '',
            startDate: currentMonthRange.startDate,
            endDate: currentMonthRange.endDate
        },
        modals: {
            delete: false,
            main: false,
            view: false,
            export: false
        },
        selectedPayment: null,
        isEditMode: false,
        apiLoading: false
    });

    const {
        payments, bankAccounts, contacts, loading, searchTerm,
        pagination, filters, modals, selectedPayment, isEditMode,
        apiLoading
    } = state;

    // Use the modern company selection hook
    const { selectedCompanyId } = useCompanySelectionState();

    const fetchData = async () => {
        // Don't proceed if no company is selected
        if (!selectedCompanyId) {
            console.log('No company selected, skipping payments fetch');
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));
            const [paymentsRes, accountsRes, contactsRes] = await Promise.all([
                listPayments({
                    page: pagination.page,
                    limit: pagination.limit,
                    contactId: filters.contactId,
                    bankId: filters.bankId,
                    type: filters.type,
                    startDate: filters.startDate,
                    endDate: filters.endDate
                }).catch(() => ({ success: false, payments: [] })),
                getBankAccounts().catch(() => ({ success: false, accounts: [] })),
                getContacts().catch(() => ({ success: false, contacts: [] }))
            ]);

            setState(prev => ({
                ...prev,
                payments: paymentsRes?.success ? paymentsRes.payments || [] : [],
                bankAccounts: accountsRes?.success ? accountsRes.accounts || [] : prev.bankAccounts,
                contacts: contactsRes?.success ? contactsRes.contacts || [] : prev.contacts,
                pagination: {
                    page: paymentsRes?.pagination?.currentPage || 1,
                    limit: paymentsRes?.pagination?.limit || 10,
                    total: paymentsRes?.pagination?.total || 0,
                    totalPages: paymentsRes?.pagination?.totalPages || 1,
                    currentPage: paymentsRes?.pagination?.currentPage || 1
                },
                loading: false,
                apiLoading: false
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                apiLoading: false,
                payments: []
            }));
            toast.error("Failed to load data");
        }
    };

    useEffect(() => {
        if (selectedCompanyId) {
        fetchData();
        }
    }, [pagination.page, filters.contactId, filters.bankId, filters.type, filters.startDate, filters.endDate, selectedCompanyId]);

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
            selectedPayment: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = (payment) => {
        setState(prev => ({
            ...prev,
            selectedPayment: payment,
            isEditMode: true,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleViewClick = (payment) => {
        setState(prev => ({
            ...prev,
            selectedPayment: payment,
            modals: { ...prev.modals, view: true }
        }));
    };

    const handleDeleteClick = (payment) => {
        setState(prev => ({
            ...prev,
            selectedPayment: payment,
            modals: { ...prev.modals, delete: true }
        }));
    };

    const handleDeletePayment = async () => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await deletePayment(selectedPayment.id);
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    payments: prev.payments.filter(p => p.id !== selectedPayment.id),
                    modals: { ...prev.modals, delete: false },
                    apiLoading: false,
                    pagination: {
                        ...prev.pagination,
                        total: prev.pagination.total - 1
                    }
                }));
                toast.success("Payment deleted successfully");
                fetchData();
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error("Failed to delete payment");
        }
    };

    const handleSubmitPayment = async (values) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const allocations = values.transactionAllocations.map(allocation => ({
                transactionId: allocation.transactionId,
                transactionType: allocation.transactionType || 'purchase', // Add missing transactionType
                type: allocation.type,
                amount: parseFloat(allocation.amount),
                paidAmount: parseFloat(allocation.paidAmount)
            }));

            const payload = {
                id: values.id,
                contactId: values.contactId,
                bankAccountId: values.bankId,
                date: values.date,
                description: values.description || '',
                adjustmentType: values.adjustmentType,
                adjustmentValue: values.adjustmentType !== 'none' ? parseFloat(values.adjustmentValue) : 0,
                transactionAllocations: allocations
            };

            const response = isEditMode
                ? await updatePayment(payload)
                : await createPayment(payload);

            if (response.success) {
                toast.success(`Payment ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false
                }));
                fetchData();
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} payment`);
        }
    };

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
        return payments.map(payment => ({
            'Payment Number': payment.paymentNumber || 'N/A',
            'Date': new Date(payment.date).toLocaleDateString(),
            'Contact': payment.contactName || 'N/A',
            'Bank Account': payment.bankName || 'N/A',
            'Amount': parseFloat(payment.amount || 0).toFixed(2),
            'Type': payment.type === 'receivable' ? 'Receivable' : 'Payable',
            'Description': payment.description || '',
            'Adjustment Type': payment.adjustmentType === 'none' ? 'None' :
                payment.adjustmentType === 'discount' ? 'Discount' :
                    payment.adjustmentType === 'extra_receipt' ? 'Extra Receipt' :
                        payment.adjustmentType === 'surcharge' ? 'Surcharge' : 'N/A',
            'Adjustment Value': payment.adjustmentType !== 'none' ? parseFloat(payment.adjustmentValue || 0).toFixed(2) : 'N/A',
            'Created By': payment.createdByName || 'N/A',
            'Created At': new Date(payment.createdAt).toLocaleString()
        }));
    };

    const filteredPayments = useMemo(() => {
        if (!searchTerm) return payments;
        const term = searchTerm.toLowerCase();
        return payments.filter(payment =>
            payment.description?.toLowerCase().includes(term) ||
            payment.paymentNumber?.toLowerCase().includes(term) ||
            payment.contactName?.toLowerCase().includes(term) ||
            payment.bankName?.toLowerCase().includes(term)
        );
    }, [payments, searchTerm]);

    return (
        <div className="page-content">
            <ToastContainer closeButton={false} position="top-right" />
            <Container fluid>
                <BreadCrumb title="Payments" pageTitle="Finance" />

                <PaymentFilter
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    currentMonthRange={currentMonthRange}
                />

                <Row className="mb-3">
                    <Col sm={12} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-middle me-1" /> Export
                            </Button>
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-middle me-1" /> Add Payment
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <PaymentTable
                        payments={filteredPayments || []}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onView={handleViewClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                    />
                )}

                <PaymentForm
                    isOpen={modals.main}
                    toggle={() => toggleModal('main')}
                    isEditMode={isEditMode}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    selectedPayment={selectedPayment}
                    onSubmit={handleSubmitPayment}
                    isLoading={apiLoading}
                />

                <PaymentViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    payment={selectedPayment}
                />

                <DeleteModal
                    show={modals.delete}
                    onDeleteClick={handleDeletePayment}
                    onCloseClick={() => toggleModal('delete', false)}
                    isLoading={apiLoading}
                />

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="payments"
                />
            </Container>
        </div>
    );
};

export default PaymentsPage;
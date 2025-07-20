import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast } from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../../Components/Common/BreadCrumb';
import PurchaseInvoiceFilter from '../../../Components/Purchases/Invoice/PurchaseInvoiceFilter';
import PurchaseInvoiceTable from '../../../Components/Purchases/Invoice/PurchaseInvoiceTable';
import PurchaseInvoiceForm from '../../../Components/Purchases/Invoice/PurchaseInvoiceForm';
import PurchaseInvoiceViewModal from '../../../Components/Purchases/Invoice/PurchaseInvoiceViewModal';
import DeleteModal from "../../../Components/Common/DeleteModal";
import ExportCSVModal from '../../../Components/Common/ExportCSVModal';
import Loader from '../../../Components/Common/Loader';
import { getCurrentMonthRange } from '../../../utils/dateUtils';
import { listPurchases, createPurchase, updatePurchases, deletePurchase, getPurchase } from '../../../services/purchaseInvoice';

const PurchaseInvoicePage = () => {
    const currentMonthRange = getCurrentMonthRange();
    const [state, setState] = useState({
        invoices: [],
        loading: false,
        pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
            currentPage: 1
        },
        filters: {
            search: '',
            status: '',
            startDate: currentMonthRange.startDate,
            endDate: currentMonthRange.endDate,
            vendorId: '',
            invoiceNumber: '',
            startDate: currentMonthRange.startDate,
            endDate: currentMonthRange.endDate
        },
        modals: {
            delete: false,
            main: false,
            view: false,
            export: false
        },
        selectedInvoice: null,
        isEditMode: false,
        apiLoading: false
    });

    const {
        invoices,
        loading,
        pagination,
        filters,
        modals,
        selectedInvoice,
        isEditMode,
        apiLoading
    } = state;

    const fetchData = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const response = await listPurchases({
                page: pagination.page,
                limit: pagination.limit,
                search: filters.search,
                status: filters.status,
                startDate: filters.startDate,
                endDate: filters.endDate,
                vendorId: filters.vendorId,
                invoiceNumber: filters.invoiceNumber
            });

            setState(prev => ({
                ...prev,
                invoices: response?.success ? response.purchases || [] : [],
                pagination: {
                    ...prev.pagination,
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
                invoices: []
            }));
            toast.error("Failed to load purchase invoices");
        }
    };

    useEffect(() => {
        fetchData();
    }, [
        pagination.page,
        filters.search,
        filters.status,
        filters.startDate,
        filters.endDate,
        filters.vendorId,
        filters.invoiceNumber
    ]);

    const toggleModal = (modalName, value) => {
        // Always reset selectedInvoice and isEditMode when closing the main modal
        if (modalName === 'main' && (value === false || value === undefined)) {
            setState(prev => ({
                ...prev,
                modals: { ...prev.modals, [modalName]: false },
                selectedInvoice: null,
                isEditMode: false
            }));
        } else {
            setState(prev => ({
                ...prev,
                modals: { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] }
            }));
        }
    };

    const handleAddClick = () => {
        setState(prev => ({
            ...prev,
            isEditMode: false,
            selectedInvoice: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = (invoice) => {
        const existingInvoice = invoices.find(i => i.id === invoice.id);

        if (existingInvoice) {
            const transformedInvoice = {
                ...existingInvoice,
                date: existingInvoice.invoiceDate,
                billFrom: existingInvoice.bankAccount
                    ? `bank_${existingInvoice.bankAccount.id}`
                    : existingInvoice.contact
                        ? `contact_${existingInvoice.contact.id}`
                        : '',
                items: existingInvoice.items.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.productName,  // Changed from productName to name
                    code: item.productCode,  // Changed from productCode to code
                    quantity: item.quantity,
                    rate: item.rate,
                    taxRate: item.taxRate,
                    taxAmount: item.taxAmount,
                    discount: item.discount,
                    discountRate: item.discountRate,
                    total: item.total,
                    isSerialized: item.isSerialized,
                    serialNumbers: item.serialNumbers || [],
                    currentStock: item.currentStock
                }))
            };
            setState(prev => ({
                ...prev,
                selectedInvoice: transformedInvoice,
                isEditMode: true,
                modals: { ...prev.modals, main: true }
            }));
        } else {
            toast.error("Invoice data not found");
        }
    };

    const handleViewClick = (invoice) => {
        setState(prev => ({
            ...prev,
            selectedInvoice: invoice,
            modals: { ...prev.modals, view: true }
        }));
    };

    const handleDeleteClick = (invoice) => {
        setState(prev => ({
            ...prev,
            selectedInvoice: invoice,
            modals: { ...prev.modals, delete: true }
        }));
    };

    const handleDeleteInvoice = async () => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await deletePurchase({ id: selectedInvoice.id });

            if (response.success) {
                setState(prev => ({
                    ...prev,
                    invoices: prev.invoices.filter(i => i.id !== selectedInvoice.id),
                    modals: { ...prev.modals, delete: false },
                    apiLoading: false,
                    pagination: {
                        ...prev.pagination,
                        total: prev.pagination.total - 1
                    }
                }));
                toast.success("Invoice deleted successfully");
            } else {
                throw new Error(response.message || "Failed to delete invoice");
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message);
        }
    };

    const handleSubmitInvoice = async (values) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));

            if (isEditMode && !values.id && selectedInvoice) {
                values.id = selectedInvoice.id;
            }

            const response = isEditMode
                ? await updatePurchases(values)
                : await createPurchase(values);

            if (response.success) {
                toast.success(`Invoice ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false
                }));
                fetchData();
            } else {
                throw new Error(response.message || `Failed to ${isEditMode ? 'update' : 'create'} invoice`);
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message);
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
            filters: {
                ...prev.filters,
                ...newFilters
            },
            pagination: { ...prev.pagination, page: 1 }
        }));
    };

    const prepareExportData = () => {
        return invoices.map(invoice => ({
            'Invoice Number': invoice.invoiceNumber || 'N/A',
            'Date': new Date(invoice.invoiceDate).toLocaleDateString(),
            'Vendor': invoice.contact?.name || invoice.bankAccount?.accountName || 'N/A',
            'Amount': parseFloat(invoice.netPayable || 0).toFixed(2),
            'Tax': parseFloat(invoice.taxAmount || 0).toFixed(2),
            'Discount': parseFloat(invoice.totalDiscount || 0).toFixed(2),
            'Status': invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : '',
            'Created At': new Date(invoice.createdAt).toLocaleString()
        }));
    };

    return (
        <div className="page-content">
            <Container fluid>
                <BreadCrumb title="Purchase Invoices" pageTitle="Purchases" />

                <PurchaseInvoiceFilter
                    filters={state.filters}
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
                                <RiAddLine className="align-bottom" /> New Invoice
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <PurchaseInvoiceTable
                        invoices={invoices}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onView={handleViewClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                    />
                )}

                <PurchaseInvoiceForm
                    key={isEditMode ? selectedInvoice?.id : 'new'}
                    isOpen={modals.main}
                    toggle={() => toggleModal('main', false)}
                    isEditMode={isEditMode}
                    selectedInvoice={selectedInvoice}
                    onSubmit={handleSubmitInvoice}
                    isLoading={apiLoading}
                />

                <PurchaseInvoiceViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    invoice={selectedInvoice}
                />

                <DeleteModal
                    show={modals.delete}
                    onDeleteClick={handleDeleteInvoice}
                    onCloseClick={() => toggleModal('delete', false)}
                    isLoading={apiLoading}
                />

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="purchase_invoices"
                />
            </Container>
        </div>
    );
};

export default PurchaseInvoicePage;
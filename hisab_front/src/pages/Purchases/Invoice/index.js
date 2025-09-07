import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col, Card, CardBody, Button, Alert } from "reactstrap";
import { RiAddLine, RiCloseLine, RiDownload2Line } from "react-icons/ri";
import { toast, ToastContainer } from "react-toastify";
import { useSearchParams } from 'react-router-dom';

// Components
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import PurchaseInvoiceFilter from "../../../Components/Purchases/Invoice/PurchaseInvoiceFilter";
import PurchaseInvoiceTable from "../../../Components/Purchases/Invoice/PurchaseInvoiceTable";
import FastPurchaseInvoiceForm from "../../../Components/Purchases/Invoice/FastPurchaseInvoiceForm";
import PurchaseInvoiceViewModal from "../../../Components/Purchases/Invoice/PurchaseInvoiceViewModal";
import ShareModal from "../../../Components/Common/ShareModal";
import PaymentForm from "../../../Components/Payments/PaymentForm";
import DeleteModal from "../../../Components/Common/DeleteModal";
import ExportCSVModal from "../../../Components/Common/ExportCSVModal";
import Loader from "../../../Components/Common/Loader";

// Services & Utils
import { getCurrentMonthRange } from "../../../utils/dateUtils";
import { listPurchases, createPurchase, updatePurchases, deletePurchase, getPurchase, generatePurchaseInvoicePDF, downloadPurchasePDF, sharePurchaseInvoice } from "../../../services/purchaseInvoice";
import { createPayment } from '../../../services/payment';
import { getBankAccounts } from '../../../services/bankAccount';
import { getContacts } from '../../../services/contacts';
import { listProducts } from '../../../services/products';
import useCompanySelectionState from '../../../hooks/useCompanySelection';

const PurchaseInvoicePage = () => {
    const currentMonthRange = getCurrentMonthRange();
    const [searchParams, setSearchParams] = useSearchParams();
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
            export: false,
            payment: false,
            share: false
        },
        selectedInvoice: null,
        isEditMode: false,
        apiLoading: false,
        apiError: null,
        pdfLoading: null,
        bankAccounts: [],
        contacts: [],
        products: [],
        selectedInvoiceForPayment: null
    });

    const {
        invoices,
        loading,
        pagination,
        filters,
        modals,
        selectedInvoice,
        isEditMode,
        apiLoading,
        apiError,
        pdfLoading,
        bankAccounts,
        contacts,
        products,
        selectedInvoiceForPayment
    } = state;

    // Use the modern company selection hook
    const { selectedCompanyId } = useCompanySelectionState();

    // Check for add parameter and auto-open add form
    useEffect(() => {
        const shouldAdd = searchParams.get('add');
        if (shouldAdd === 'true') {
            // Clear the parameter from URL
            setSearchParams({});
            // Open the add form
            setState(prev => ({
                ...prev,
                isEditMode: false,
                selectedInvoice: null,
                modals: { ...prev.modals, main: true }
            }));
        }
    }, [searchParams, setSearchParams]);

    const fetchBankAccountsAndContacts = async () => {
        if (!selectedCompanyId) return;

        try {
            const [bankAccountsResponse, contactsResponse, productsResponse] = await Promise.all([
                getBankAccounts({}),
                getContacts({}),
                listProducts({ limit: 1000 }) // Fetch products for fast search
            ]);

            setState(prev => ({
                ...prev,
                bankAccounts: bankAccountsResponse?.success ? bankAccountsResponse.accounts || [] : [],
                contacts: contactsResponse?.success ? contactsResponse.contacts || [] : [],
                products: productsResponse?.success ? productsResponse.data || [] : []
            }));
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchData = async () => {
        // Don't proceed if no company is selected
        if (!selectedCompanyId) {
            console.log('No company selected, skipping purchase invoices fetch');
            return;
        }

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
        if (selectedCompanyId) {
        fetchData();
            fetchBankAccountsAndContacts();
        }
    }, [
        pagination.page,
        filters.search,
        filters.status,
        filters.startDate,
        filters.endDate,
        filters.vendorId,
        filters.invoiceNumber,
        selectedCompanyId
    ]);

    const toggleModal = (modalName, value) => {
        // Always reset selectedInvoice and isEditMode when closing the main modal
        if (modalName === 'main' && (value === false || value === undefined)) {
            setState(prev => ({
                ...prev,
                modals: { ...prev.modals, [modalName]: false },
                selectedInvoice: null,
                isEditMode: false,
                apiError: null // Clear any API errors when closing modal
            }));
        } else if (modalName === 'main' && value === true) {
            // Clear errors when opening modal
            setState(prev => ({
                ...prev,
                modals: { ...prev.modals, [modalName]: true },
                apiError: null
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
                discountScope: existingInvoice.discountScope || existingInvoice.discountType, // Handle backward compatibility
                items: existingInvoice.items?.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.productName || item.name,
                    code: item.productCode || item.code,
                    quantity: item.quantity,
                    rate: item.rate,
                    taxRate: item.taxRate,
                    taxAmount: item.taxAmount,
                    discountType: item.discountType || 'rupees',
                    discountValue: item.discountValue || 0,
                    discountAmount: item.discountAmount || 0,
                    total: item.total,
                    isSerialized: item.isSerialized,
                    serialNumbers: item.serialNumbers || [],
                    currentStock: item.currentStock
                })) || []
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
        // Use the existing invoice data from the list API - no need for additional API call
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

    const handleGeneratePDF = async (invoice) => {
        try {
            setState(prev => ({ ...prev, pdfLoading: invoice.id }));
            const response = await generatePurchaseInvoicePDF(invoice.id);

            if (response.success) {
                toast.success("Purchase invoice PDF generated successfully!");
                downloadPurchasePDF(response.pdfUrl, response.fileName);
            } else {
                throw new Error(response.message || "Failed to generate PDF");
            }
        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error(error.message || "Failed to generate purchase invoice PDF");
        } finally {
            setState(prev => ({ ...prev, pdfLoading: null }));
        }
    };

    const handleCreatePayment = (invoice) => {
        // Only allow payment for pending invoices with remaining amount
        if (invoice.status !== 'pending' || parseFloat(invoice.remainingAmount || 0) <= 0) {
            toast.error("Payment can only be created for pending invoices with remaining amount");
            return;
        }

        setState(prev => ({
            ...prev,
            selectedInvoiceForPayment: invoice,
            modals: { ...prev.modals, payment: true }
        }));
    };

    const handleShare = (invoice) => {
        setState(prev => ({
            ...prev,
            selectedInvoice: invoice,
            modals: { ...prev.modals, share: true }
        }));
    };

    const handleShareInvoice = async (shareData) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            
            // For now, only handle email sharing
            if (shareData.shareType !== 'email') {
                setState(prev => ({ ...prev, apiLoading: false }));
                toast.info("WhatsApp integration coming soon! Please use email for now.");
                return;
            }
            
            const response = await sharePurchaseInvoice(selectedInvoice.id, shareData);

            if (response.success) {
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, share: false },
                    apiLoading: false
                }));

                toast.success("Invoice shared successfully via email!");
                
                // WhatsApp handling commented out - coming soon
                // if (shareData.shareType === 'whatsapp') {
                //     if (response.fallbackMode) {
                //         window.open(response.whatsappUrl, '_blank');
                //         toast.info("WhatsApp API unavailable. Opening web WhatsApp with pre-filled message.");
                //     } else {
                //         toast.success("Invoice sent successfully via WhatsApp!");
                //     }
                // } else {
                //     toast.success("Invoice shared successfully via email!");
                // }
            } else {
                throw new Error(response.message || "Failed to share invoice");
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message || "Failed to share invoice");
        }
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
                    selectedInvoiceForPayment: null,
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

    const handleSubmitInvoice = async (values) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true, apiError: null }));

            if (isEditMode && !values.id && selectedInvoice) {
                values.id = selectedInvoice.id;
            }

            const response = isEditMode
                ? await updatePurchases(values)
                : await createPurchase(values);

            if (response.success) {
                toast.success(`Invoice ${isEditMode ? 'updated' : 'created'} successfully`);
                
                // Reset form state after successful submission
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false,
                    apiError: null,
                    isEditMode: false,
                    selectedInvoice: null
                }));
                
                fetchData();
            } else {
                throw new Error(response.message || `Failed to ${isEditMode ? 'update' : 'create'} invoice`);
            }
        } catch (error) {
            // Keep modal open and pass error to form component
            setState(prev => ({ 
                ...prev, 
                apiLoading: false,
                apiError: error.message || `Failed to ${isEditMode ? 'update' : 'create'} invoice`
            }));
            // Don't show toast error anymore - form will display it
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
                        onGeneratePDF={handleGeneratePDF}
                        onCreatePayment={handleCreatePayment}
                        onShare={handleShare}
                        pdfLoading={pdfLoading}
                    />
                )}

                <FastPurchaseInvoiceForm
                    key={isEditMode ? selectedInvoice?.id : 'new'}
                    isOpen={modals.main}
                    toggle={() => toggleModal('main', false)}
                    isEditMode={isEditMode}
                    selectedInvoice={selectedInvoice}
                    onSubmit={handleSubmitInvoice}
                    isLoading={apiLoading}
                    apiError={apiError}
                    contacts={contacts}
                    products={products}
                />

                <PurchaseInvoiceViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    invoice={selectedInvoice}
                    onGeneratePDF={handleGeneratePDF}
                    pdfLoading={pdfLoading}
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

                <PaymentForm
                    isOpen={modals.payment}
                    toggle={() => toggleModal('payment', false)}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    onSubmit={handleSubmitPayment}
                    isLoading={apiLoading}
                    selectedInvoice={selectedInvoiceForPayment}
                    invoiceType="purchase"
                />

                <ShareModal
                    isOpen={modals.share}
                    toggle={() => toggleModal('share', false)}
                    invoiceType="purchase"
                    invoiceData={selectedInvoice}
                    onShare={handleShareInvoice}
                    isLoading={apiLoading}
                />
            </Container>
            <ToastContainer closeButton={false} position="top-right" />
        </div>
    );
};

export default PurchaseInvoicePage;
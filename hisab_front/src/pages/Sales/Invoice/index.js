import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col, Card, CardBody, Button, Alert, Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import { RiAddLine, RiCloseLine, RiDownload2Line, RiSettings3Line } from "react-icons/ri";
import { toast,ToastContainer } from "react-toastify";
import { useSearchParams } from 'react-router-dom';
import ExportCSVModal from "../../../Components/Common/ExportCSVModal";

// Components
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import SalesInvoiceTable from "../../../Components/Sales/Invoice/SalesInvoiceTable";
import FastSalesInvoiceForm from "../../../Components/Sales/Invoice/FastSalesInvoiceForm";
import SalesInvoiceViewModal from "../../../Components/Sales/Invoice/SalesInvoiceViewModal";
import SalesInvoiceFilter from "../../../Components/Sales/Invoice/SalesInvoiceFilter";
import ShareModal from "../../../Components/Common/ShareModal";
import DeleteModal from "../../../Components/Common/DeleteModal";
import PaymentForm from "../../../Components/Payments/PaymentForm";
import PrintPreferencesManager from "../../../Components/Common/PrintPreferencesManager";


// Services & Utils
import { listSales, createSale, updateSales, deleteSale, generateSalesInvoicePDF, downloadSalesPDF, shareSalesInvoice, getSalesInvoiceForPrint } from "../../../services/salesInvoice";
import { getTemplates } from "../../../services/templates";
import { generatePreviewHTML, adjustTemplateForCopies, generateMultipleCopies } from "../../../utils/templatePreviewUtils";
import { createPayment } from '../../../services/payment';
import { getBankAccounts } from '../../../services/bankAccount';
import { getContacts } from '../../../services/contacts';
import { listProducts } from '../../../services/products';
import { getDefaultCopies } from '../../../services/copyPreferences';
import useCompanySelectionState from '../../../hooks/useCompanySelection';
import { getCurrentMonthRange } from '../../../utils/dateUtils';
import Loader from '../../../Components/Common/Loader';

const SalesInvoicePage = () => {
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
            customerId: '',
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
            share: false,
            settings: false
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
                listProducts({ limit: 1000 }) // Fetch all products for fast search
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
            console.log('No company selected, skipping sales invoices fetch');
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const response = await listSales({
                page: pagination.page,
                limit: pagination.limit,
                search: filters.search,
                status: filters.status,
                startDate: filters.startDate,
                endDate: filters.endDate,
                customerId: filters.customerId,
                invoiceNumber: filters.invoiceNumber
            });

            setState(prev => ({
                ...prev,
                invoices: response?.success ? response.sales || [] : [],
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
            toast.error("Failed to load sales invoices");
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
        filters.customerId,
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
                date: existingInvoice.invoiceDate, // Map invoiceDate to date
                discountType: existingInvoice.discountScope, // Map discountScope to discountType for form
                // Preserve the original IDs for the form to use
                bankAccountId: existingInvoice.bankAccountId,
                contactId: existingInvoice.contactId,
                billToBank: existingInvoice.billToBank,
                items: existingInvoice.items?.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.name, // Use correct field name
                    code: item.code, // Use correct field name
                    quantity: parseFloat(item.quantity || 0),
                    rate: parseFloat(item.rate || 0),
                    rateType: item.rateType || 'without_tax',
                    taxRate: parseFloat(item.taxRate || 0),
                    taxAmount: parseFloat(item.taxAmount || 0),
                    discountType: item.discountType || 'rupees',
                    discountValue: parseFloat(item.discountValue || 0), // From new schema
                    discountAmount: parseFloat(item.discountAmount || 0), // From new schema
                    discountRate: parseFloat(item.discountValue || 0), // Map discountValue to discountRate for form
                    discount: parseFloat(item.discountAmount || 0), // Map discountAmount to discount for form
                    lineBasic: parseFloat(item.lineBasic || 0), // From new schema
                    lineTotal: parseFloat(item.lineTotal || 0), // From new schema
                    total: parseFloat(item.lineTotal || item.total || 0), // Use lineTotal with fallback
                    isSerialized: item.isSerialized || false,
                    serialNumbers: item.serialNumbers || [],
                    currentStock: parseFloat(item.currentStock || 0)
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
            const response = await deleteSale({ id: selectedInvoice.id });

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

    const handlePrint = async (invoice) => {
        try {
            // Direct print with user's default copies (no popup)
            const copyPreferenceResponse = await getDefaultCopies('sales');
            const defaultCopies = copyPreferenceResponse.defaultCopies || 2;
            
            // Use the view modal's direct print logic
            const invoiceResponse = await getSalesInvoiceForPrint(invoice.id);
            if (!invoiceResponse.success) {
                toast.error('Failed to fetch invoice data for printing');
                return;
            }

            // Get default template
            const templatesResponse = await getTemplates('sales');
            const templates = templatesResponse.templates || [];
            const defaultTemplate = templates.find(t => t.default === true);
            
            if (!defaultTemplate) {
                toast.error('No default template found. Please set a default template first.');
                return;
            }

            // Process template and print directly
            const invoiceData = invoiceResponse.invoiceData;
            

            
            let processedHtml = generatePreviewHTML(defaultTemplate, invoiceData);
            processedHtml = adjustTemplateForCopies(processedHtml, defaultCopies);
            
            if (defaultCopies > 1) {
                processedHtml = generateMultipleCopies(processedHtml, defaultCopies);
            }

            // Add print CSS
            const pageSetupCSS = `
                <style>
                    @page { size: A4 portrait; margin: 3mm; }
                    body { width: 794px; height: 1123px; margin: 0; padding: 0; background: white; font-family: 'Noto Sans Gujarati', Arial, sans-serif; }
                    @media print {
                        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .invoice-container { page-break-inside: avoid; }
                        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>`;
            processedHtml = processedHtml.replace('</head>', pageSetupCSS);

            // Open print window
            const printWindow = window.open('', '_blank');
            printWindow.document.write(processedHtml);
            printWindow.document.close();
            
            // Wait for content and images to load then print
            printWindow.onload = () => {
                // Wait for all images to load
                const images = printWindow.document.images;
                let loadedImages = 0;
                const totalImages = images.length;
                
                if (totalImages === 0) {
                    // No images, print immediately
                    setTimeout(() => {
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                        toast.success(`Invoice printed with ${defaultCopies} ${defaultCopies === 1 ? 'copy' : 'copies'}!`);
                    }, 300);
                    return;
                }
                
                const checkAllImagesLoaded = () => {
                    loadedImages++;
                    if (loadedImages >= totalImages) {
                        // All images loaded, now print
                        setTimeout(() => {
                            printWindow.focus();
                            printWindow.print();
                            printWindow.close();
                            toast.success(`Invoice printed with ${defaultCopies} ${defaultCopies === 1 ? 'copy' : 'copies'}!`);
                        }, 500);
                    }
                };
                
                // Add load event listeners to all images
                Array.from(images).forEach((img, index) => {
                    if (img.complete) {
                        checkAllImagesLoaded();
                    } else {
                        img.addEventListener('load', checkAllImagesLoaded);
                        img.addEventListener('error', checkAllImagesLoaded); // Also proceed on error
                        
                        // Fallback timeout for stuck images
                        setTimeout(() => {
                            if (loadedImages < totalImages) {
                                console.log(`Image ${index} taking too long, proceeding with print`);
                                checkAllImagesLoaded();
                            }
                        }, 3000);
                    }
                });
            };

        } catch (error) {
            console.error('Print error:', error);
            toast.error('Failed to print invoice');
        }
    };

    const handleGeneratePDF = async (invoice, copies = null) => {
        try {
            let finalCopies = copies;
            
            // If no copies specified, get user's default copy preference
            if (!finalCopies) {
                const copyPreferenceResponse = await getDefaultCopies('sales');
                finalCopies = copyPreferenceResponse.defaultCopies || 2;
            }
            
            // Generate PDF with specified or default copies
            setState(prev => ({ ...prev, pdfLoading: invoice.id }));
            const response = await generateSalesInvoicePDF(invoice.id, finalCopies);

            if (response.success) {
                toast.success(`Sales invoice PDF generated with ${finalCopies} ${finalCopies === 1 ? 'copy' : 'copies'}!`);
                downloadSalesPDF(response.pdfUrl, response.fileName);
            } else {
                throw new Error(response.message || "Failed to generate PDF");
            }
        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error(error.message || "Failed to generate sales invoice PDF");
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

    // Make handleCreatePayment available globally for the modal
    useEffect(() => {
        window.handleCreatePayment = handleCreatePayment;
        return () => {
            delete window.handleCreatePayment;
        };
    }, []);

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
            
            const response = await shareSalesInvoice(selectedInvoice.id, shareData);

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
        console.log("values", values);
        try {
            setState(prev => ({ ...prev, apiLoading: true, apiError: null }));
            console.log("values", values);

            if (isEditMode && !values.id && selectedInvoice) {
                values.id = selectedInvoice.id;
            }
            const response = isEditMode
                ? await updateSales(values)
                : await createSale(values);

            if (response.success) {
                toast.success(`Invoice ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false,
                    apiError: null
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
            'Customer': invoice.accountName || invoice.contactName || 'N/A',
            'Amount': parseFloat(invoice.netReceivable || 0).toFixed(2),
            'Tax': parseFloat(invoice.taxAmount || 0).toFixed(2),
            'Discount': parseFloat(invoice.totalDiscount || 0).toFixed(2),
            'Status': invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : '',
            'Created At': new Date(invoice.createdAt).toLocaleString()
        }));
    };

    return (
        <div className="page-content">
            <ToastContainer closeButton={false} position="top-right" />                                                                                                                                             
            <Container fluid>
                <BreadCrumb title="Sales Invoices" pageTitle="Sales" />

                <SalesInvoiceFilter
                    filters={state.filters}
                    onFilterChange={handleFilterChange}
                    currentMonthRange={currentMonthRange}
                />

                <Row className="mb-3">
                    <Col sm={12}>
                        <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 sales-invoice-actions">
                            <PrintPreferencesManager 
                                moduleType="sales" 
                                size="small"
                                onPreferencesChange={() => {
                                    console.log('Print preferences updated for sales module');
                                }}
                            />
                            <Button 
                                color="primary" 
                                onClick={() => toggleModal('export', true)}
                                className="d-flex align-items-center justify-content-center gap-1"
                            >
                                <RiDownload2Line className="align-bottom" /> 
                                <span className="d-none d-sm-inline">Export</span>
                            </Button>
                            <Button 
                                color="success" 
                                onClick={handleAddClick}
                                className="d-flex align-items-center justify-content-center gap-1"
                            >
                                <RiAddLine className="align-bottom" /> 
                                <span className="d-none d-sm-inline">New Invoice</span>
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <SalesInvoiceTable
                        invoices={invoices}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onView={handleViewClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onGeneratePDF={handleGeneratePDF}
                        onCreatePayment={handleCreatePayment}
                        onPrint={handlePrint}
                        onShare={handleShare}
                        pdfLoading={pdfLoading}
                    />
                )}

                <FastSalesInvoiceForm
                    key={isEditMode ? selectedInvoice?.id : 'new-fast'}
                    isOpen={modals.main}
                    toggle={() => toggleModal('main', false)}
                    isEditMode={isEditMode}
                    selectedInvoice={selectedInvoice}
                    onSubmit={handleSubmitInvoice}
                    isLoading={apiLoading}
                    apiError={state.apiError}
                    contacts={contacts}
                        products={products}
                />

                <SalesInvoiceViewModal
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
                    filename="sales_invoices"
                />

                <PaymentForm
                    isOpen={modals.payment}
                    toggle={() => toggleModal('payment', false)}
                    bankAccounts={bankAccounts}
                    contacts={contacts}
                    onSubmit={handleSubmitPayment}
                    isLoading={apiLoading}
                    selectedInvoice={selectedInvoiceForPayment}
                    invoiceType="sale"
                />

                <ShareModal
                    isOpen={modals.share}
                    toggle={() => toggleModal('share', false)}
                    invoiceType="sales"
                    invoiceData={selectedInvoice}
                    onShare={handleShareInvoice}
                    isLoading={apiLoading}
                />


            </Container>
        </div>
    );
};

export default SalesInvoicePage; 
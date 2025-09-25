import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Row, Col, Card, CardBody, Button, Alert, Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
import { RiAddLine, RiCloseLine, RiDownload2Line, RiSettings3Line } from "react-icons/ri";
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
import BulkDeleteModal from "../../../Components/Common/BulkDeleteModal";
import PaymentAdjustmentModal from "../../../Components/Common/PaymentAdjustmentModal";
import ExportCSVModal from "../../../Components/Common/ExportCSVModal";
import Loader from "../../../Components/Common/Loader";
import PrintPreferencesManager from "../../../Components/Common/PrintPreferencesManager";

// Services & Utils
import { getCurrentMonthRange } from "../../../utils/dateUtils";
import { listPurchases, createPurchase, updatePurchases, deletePurchase, bulkDeletePurchases, getPurchase, generatePurchaseInvoicePDF, downloadPurchasePDF, sharePurchaseInvoice, getPurchaseInvoiceForPrint } from "../../../services/purchaseInvoice";
import { getTemplates } from "../../../services/templates";
import { generatePreviewHTML, adjustTemplateForCopies, generateMultipleCopies } from "../../../utils/templatePreviewUtils";
import { createPayment } from '../../../services/payment';
import { getBankAccounts } from '../../../services/bankAccount';
import { getContacts } from '../../../services/contacts';
import { listProducts } from '../../../services/products';
import { getDefaultCopies } from '../../../services/copyPreferences';
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
            bulkDelete: false,
            main: false,
            view: false,
            export: false,
            payment: false,
            share: false,
            settings: false,
            paymentAdjustment: false
        },
        selectedInvoice: null,
        isEditMode: false,
        apiLoading: false,
        apiError: null,
        selectedItems: [],
        bulkDeleteLoading: false,
        paymentConflict: null,
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
        selectedItems,
        bulkDeleteLoading,
        paymentConflict,
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
                    page: response?.pagination?.currentPage || prev.pagination.page,
                    limit: response?.pagination?.limit || prev.pagination.limit,
                    total: response?.pagination?.total || 0,
                    totalPages: response?.pagination?.totalPages || 1,
                    currentPage: response?.pagination?.currentPage || prev.pagination.currentPage
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

    // Separate useEffect for bank accounts and contacts (only when company changes)
    useEffect(() => {
        if (selectedCompanyId) {
            fetchBankAccountsAndContacts();
        }
    }, [selectedCompanyId]);

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

    const handleBulkDelete = async () => {
        if (selectedItems.length === 0) {
            toast.warning("Please select items to delete");
            return;
        }

        try {
            setState(prev => ({ ...prev, bulkDeleteLoading: true }));
            const response = await bulkDeletePurchases(selectedItems);
            
            if (response.success) {
                toast.success(`${response.successCount} purchases deleted successfully`);
                if (response.errorCount > 0) {
                    toast.warning(`${response.errorCount} purchases could not be deleted`);
                }
                setState(prev => ({ 
                    ...prev, 
                    selectedItems: [],
                    modals: { ...prev.modals, bulkDelete: false }
                }));
                fetchData();
            } else {
                toast.error(response.message || "Failed to delete purchases");
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            toast.error("Failed to delete purchases");
        } finally {
            setState(prev => ({ ...prev, bulkDeleteLoading: false }));
        }
    };

    const handleSelectionChange = (newSelectedItems) => {
        setState(prev => ({ ...prev, selectedItems: newSelectedItems }));
    };

    const handlePaymentAdjustmentChoice = async (choice) => {
        try {
            const formData = {
                ...paymentConflict.pendingFormData,
                paymentAdjustmentChoice: choice
            };
            

            
            const response = isEditMode
                ? await updatePurchases(formData)
                : await createPurchase(formData);

            if (response.success) {
                toast.success(`Invoice ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false, paymentAdjustment: false },
                    paymentConflict: null,
                    apiLoading: false,
                    apiError: null,
                    isEditMode: false,
                    selectedInvoice: null
                }));
                fetchData();
            }
        } catch (error) {
            console.error('Error handling payment adjustment:', error);
            setState(prev => ({ 
                ...prev, 
                modals: { ...prev.modals, paymentAdjustment: false },
                paymentConflict: null,
                apiError: error.data?.message || error.message || 'Failed to process payment adjustment'
            }));
        }
    };

    const handlePrint = async (invoice) => {
        try {
            // Direct print with user's default copies (no popup)
            const copyPreferenceResponse = await getDefaultCopies('purchase');
            const defaultCopies = copyPreferenceResponse.defaultCopies || 2;
            
            // Use the same logic as view modal
            const invoiceResponse = await getPurchaseInvoiceForPrint(invoice.id);
            if (!invoiceResponse.success) {
                toast.error('Failed to fetch invoice data for printing');
                return;
            }

            // Get default template
            const templatesResponse = await getTemplates('purchase');
            const templates = templatesResponse.templates || [];
            const defaultTemplate = templates.find(t => t.default === true);
            
            if (!defaultTemplate) {
                toast.error('No default template found. Please set a default template first.');
                return;
            }

            // Process template and print directly
            const invoiceData = invoiceResponse.invoiceData;
            
            // Debug logo data for purchase list print
            console.log('🖼️ Purchase List Print - Logo Debug:', {
                hasCompanyLogoUrl: !!invoiceData.companyLogoUrl,
                companyLogoUrl: invoiceData.companyLogoUrl,
                companyName: invoiceData.companyName,
                templateId: defaultTemplate.id,
                templateName: defaultTemplate.name,
                templateContainsLogo: defaultTemplate.htmlTemplate.includes('companyLogoUrl')
            });
            
            let processedHtml = generatePreviewHTML(defaultTemplate, invoiceData);
            
            // Debug processed HTML for logo
            console.log('🖼️ Purchase List Print - Template Processing Debug:', {
                processedHtmlContainsImg: processedHtml.includes('<img'),
                processedHtmlContainsLogoPlaceholder: processedHtml.includes('LOGO'),
                logoImgTags: processedHtml.match(/<img[^>]*>/g)
            });
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
            const copyPreferenceResponse = await getDefaultCopies('purchase');
                finalCopies = copyPreferenceResponse.defaultCopies || 2;
            }
            
            setState(prev => ({ ...prev, pdfLoading: invoice.id }));
            const response = await generatePurchaseInvoicePDF(invoice.id, finalCopies);

            if (response.success) {
                toast.success(`Purchase invoice PDF generated with ${finalCopies} ${finalCopies === 1 ? 'copy' : 'copies'}!`);
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
        console.log('🚀 STEP A: handleSubmitInvoice called in Purchase page!', {
            isEditMode,
            values,
            selectedInvoice,
            timestamp: new Date().toISOString(),
            message: 'This proves the form component called the parent function'
        });
        
        try {
            console.log('🚀 STEP B: Setting apiLoading to true');
            setState(prev => ({ ...prev, apiLoading: true, apiError: null }));

            if (isEditMode && !values.id && selectedInvoice) {
                values.id = selectedInvoice.id;
                console.log('🚀 STEP C: Added selectedInvoice.id to values');
            }

            console.log('🚀 STEP D: About to call API function...', {
                apiFunction: isEditMode ? 'updatePurchases' : 'createPurchase',
                valuesForAPI: values
            });

            const response = isEditMode
                ? await updatePurchases(values)
                : await createPurchase(values);
                
            console.log('🚀 STEP E: API call completed!', {
                response,
                success: response?.success
            });

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
            console.error('❌ Parent handleSubmitInvoice error:', error);
            console.log('🔍 Parent error details:', {
                status: error.status,
                data: error.data,
                requiresPaymentAdjustment: error.data?.requiresPaymentAdjustment,
                paymentInfo: error.data?.paymentInfo
            });
            
            setState(prev => ({ ...prev, apiLoading: false }));
            
            // If it's a payment adjustment required (409), set a special state to trigger modal
            if (error.status === 409 && error.data?.requiresPaymentAdjustment) {
                console.log('✅ Parent: Payment adjustment modal should open now');
                // Show payment adjustment modal directly from parent page
            setState(prev => ({ 
                ...prev, 
                    modals: { ...prev.modals, paymentAdjustment: true },
                    paymentConflict: {
                        isActive: true,
                        paymentInfo: error.data.paymentInfo,
                        pendingFormData: values
                    }
                }));
                return; // Don't throw error, handle it through state
            }
            
            // For other errors, set apiError to display in form
            setState(prev => ({ 
                ...prev,
                apiError: error.data?.message || error.message || `Failed to ${isEditMode ? 'update' : 'create'} invoice`
            }));
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
        // Export only selected items if any are selected, otherwise export all
        const itemsToExport = selectedItems.length > 0 
            ? invoices.filter(invoice => selectedItems.includes(invoice.id))
            : invoices;

        console.log('📊 Purchase CSV Export:', {
            totalInvoices: invoices.length,
            selectedCount: selectedItems.length,
            exportingCount: itemsToExport.length,
            exportType: selectedItems.length > 0 ? 'Selected items only' : 'All items'
        });

        return itemsToExport.map(invoice => ({
            'Invoice Number': invoice.invoiceNumber || 'N/A',
            'Date': new Date(invoice.invoiceDate).toLocaleDateString(),
            'Vendor': invoice.contactName || invoice.contact?.name || 'N/A',
            'Bank Account': invoice.accountName || invoice.bankAccount?.accountName || 'N/A',
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
                            <PrintPreferencesManager 
                                moduleType="purchase" 
                                size="small"
                                onPreferencesChange={() => {
                                    console.log('Print preferences updated for purchase module');
                                }}
                            />
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-bottom" /> Export
                            </Button>
                            {selectedItems.length > 0 && (
                                <Button 
                                    color="danger" 
                                    onClick={() => toggleModal('bulkDelete', true)}
                                    className="me-2"
                                >
                                    <i className="ri-delete-bin-line me-1"></i>
                                    Delete Selected ({selectedItems.length})
                                </Button>
                            )}
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
                        onBulkDelete={handleBulkDelete}
                        onGeneratePDF={handleGeneratePDF}
                        onCreatePayment={handleCreatePayment}
                        onPrint={handlePrint}
                        onShare={handleShare}
                        pdfLoading={pdfLoading}
                        selectedItems={selectedItems}
                        onSelectionChange={handleSelectionChange}
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

                <BulkDeleteModal
                    isOpen={modals.bulkDelete}
                    toggle={() => toggleModal('bulkDelete', false)}
                    selectedCount={selectedItems.length}
                    itemType="purchases"
                    onConfirm={handleBulkDelete}
                    isLoading={bulkDeleteLoading}
                />

                <PaymentAdjustmentModal
                    isOpen={modals.paymentAdjustment}
                    toggle={() => setState(prev => ({ 
                        ...prev, 
                        modals: { ...prev.modals, paymentAdjustment: false },
                        paymentConflict: null
                    }))}
                    paymentInfo={paymentConflict?.paymentInfo}
                    newAmount={paymentConflict?.pendingFormData?.netPayable}
                    onConfirm={handlePaymentAdjustmentChoice}
                    isLoading={apiLoading}
                    transactionType="purchase"
                />

            </Container>
            <ToastContainer closeButton={false} position="top-right" />
        </div>
    );
};

export default PurchaseInvoicePage;
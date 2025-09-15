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
import PrintPreferencesManager from '../../Components/Common/PrintPreferencesManager';
import { getBankAccounts } from '../../services/bankAccount';
import { getContacts } from '../../services/contacts';
import { getCurrentMonthRange } from '../../utils/dateUtils';
import { createPayment, deletePayment, listPayments, updatePayment, generatePaymentInvoicePDF, downloadPaymentPDF, getPaymentForPrint } from '../../services/payment';
import { getDefaultCopies } from '../../services/copyPreferences';
import { getTemplates } from '../../services/templates';
import { generatePreviewHTML, adjustTemplateForCopies, generateMultipleCopies } from '../../utils/templatePreviewUtils';
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
        apiLoading: false,
        pdfLoading: null
    });

    const {
        payments, bankAccounts, contacts, loading, searchTerm,
        pagination, filters, modals, selectedPayment, isEditMode,
        apiLoading, pdfLoading
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
        // Edit payment clicked

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

    const handleSubmitPayment = async (payloadFromForm) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            
            // Processing payment form submission

            const response = isEditMode
                ? await updatePayment(payloadFromForm)
                : await createPayment(payloadFromForm);

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

    const handlePrint = async (payment) => {
        try {
            // Direct print with user's default copies (no popup)
            const copyPreferenceResponse = await getDefaultCopies('payment');
            const defaultCopies = copyPreferenceResponse.defaultCopies || 2;
            
            // Use the same logic as view modal
            const paymentResponse = await getPaymentForPrint(payment.id);
            if (!paymentResponse.success) {
                toast.error('Failed to fetch payment data for printing');
                return;
            }

            // Get default template
            const templatesResponse = await getTemplates('payment');
            const templates = templatesResponse.templates || [];
            const defaultTemplate = templates.find(t => t.default === true);
            
            if (!defaultTemplate) {
                toast.error('No default template found. Please set a default template first.');
                return;
            }

            // Process template and print directly
            const paymentData = paymentResponse.paymentData;
            let processedHtml = generatePreviewHTML(defaultTemplate, paymentData);
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
                        .receipt-container { page-break-inside: avoid; }
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
                        toast.success(`Payment receipt printed with ${defaultCopies} ${defaultCopies === 1 ? 'copy' : 'copies'}!`);
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
                            toast.success(`Payment receipt printed with ${defaultCopies} ${defaultCopies === 1 ? 'copy' : 'copies'}!`);
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
            toast.error('Failed to print payment receipt');
        }
    };

    const handleGeneratePDF = async (payment) => {
        try {
            // Get user's default copy preference
            const copyPreferenceResponse = await getDefaultCopies('payment');
            const defaultCopies = copyPreferenceResponse.defaultCopies || 2;
            
            setState(prev => ({ ...prev, pdfLoading: payment.id }));
            const response = await generatePaymentInvoicePDF(payment.id, defaultCopies);

            if (response.success) {
                toast.success(`Payment receipt PDF generated with ${defaultCopies} ${defaultCopies === 1 ? 'copy' : 'copies'}!`);
                downloadPaymentPDF(response.pdfUrl, response.fileName);
            } else {
                throw new Error(response.message || "Failed to generate PDF");
            }
        } catch (error) {
            console.error("PDF generation error:", error);
            toast.error(error.message || "Failed to generate payment receipt PDF");
        } finally {
            setState(prev => ({ ...prev, pdfLoading: null }));
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
                            <PrintPreferencesManager 
                                moduleType="payment" 
                                size="small"
                                onPreferencesChange={() => {
                                    console.log('Print preferences updated for payment module');
                                }}
                            />
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-bottom" /> 
                                <span className="d-none d-sm-inline">Export</span>
                            </Button>
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-bottom" /> 
                                <span className="d-none d-sm-inline">Add Payment</span>
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
                        onGeneratePDF={handleGeneratePDF}
                        onPrint={handlePrint}
                        pdfLoading={pdfLoading}
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
                    onGeneratePDF={handleGeneratePDF}
                    pdfLoading={pdfLoading}
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
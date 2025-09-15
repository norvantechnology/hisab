import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button, 
  Badge, 
  Table, 
  Card, 
  CardBody, 
  Row, 
  Col, 
  Alert,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';
import { 
  RiErrorWarningLine, 
  RiBankLine, 
  RiShoppingCartLine, 
  RiWalletLine, 
  RiStoreLine, 
  RiFileTextLine, 
  RiUserLine, 
  RiCalendarLine, 
  RiCashLine, 
  RiMapPinLine,
  RiPrinterLine,
  RiCloseLine,
  RiFilePdfLine,
  RiDownload2Line,
  RiStarLine,
  RiFileCopyLine,
  RiFileListLine,
  RiAlertLine
} from 'react-icons/ri';
import { generatePaymentInvoicePDF, downloadPaymentPDF, getPaymentForPrint } from '../../services/payment';
import { getTemplates } from '../../services/templates';
import { getDefaultCopies } from '../../services/copyPreferences';
import { generateSampleData, generatePreviewHTML, adjustTemplateForCopies, generateMultipleCopies } from '../../utils/templatePreviewUtils';
import { toast } from 'react-toastify';

// Add CSS for spinner animation
const spinnerStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .btn-soft-primary {
    background-color: rgba(64, 81, 137, 0.1);
    border-color: rgba(64, 81, 137, 0.1);
    color: #405189;
  }
  .btn-soft-primary:hover {
    background-color: rgba(64, 81, 137, 0.2);
    border-color: rgba(64, 81, 137, 0.2);
    color: #405189;
  }
  .btn-soft-info {
    background-color: rgba(13, 202, 240, 0.1);
    border-color: rgba(13, 202, 240, 0.1);
    color: #0dcaf0;
  }
  .btn-soft-info:hover {
    background-color: rgba(13, 202, 240, 0.2);
    border-color: rgba(13, 202, 240, 0.2);
    color: #0dcaf0;
  }
  .btn-soft-secondary {
    background-color: rgba(116, 120, 141, 0.1);
    border-color: rgba(116, 120, 141, 0.1);
    color: #74788d;
  }
  .btn-soft-secondary:hover {
    background-color: rgba(116, 120, 141, 0.2);
    border-color: rgba(116, 120, 141, 0.2);
    color: #74788d;
  }
  .dropdown-menu.shadow-lg {
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
  }
  .dropdown-item:hover {
    background-color: #f8f9fa;
    transform: translateX(2px);
    transition: all 0.2s ease;
  }
  .dropdown-item.d-flex {
    border: none;
  }
  .dropdown-header {
    border-radius: 6px 6px 0 0;
    font-size: 0.875rem;
  }
`;

const PaymentViewModal = ({ isOpen, toggle, payment, onGeneratePDF, pdfLoading }) => {
    const [defaultCopies, setDefaultCopies] = useState(2);

    // Fetch default copy preference when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchDefaultCopies();
        }
    }, [isOpen]);

    const fetchDefaultCopies = async () => {
        try {
            const response = await getDefaultCopies('payment');
            setDefaultCopies(response.defaultCopies || 2);
        } catch (error) {
            console.error('Error fetching default copies:', error);
            setDefaultCopies(2);
        }
    };

    // Helper functions
    const parseAmount = (amount) => parseFloat(amount) || 0;
    const formatAmount = (amount) => parseAmount(amount).toFixed(2);

    const handleGeneratePDF = async (copies = null) => {
        if (onGeneratePDF && payment) {
            onGeneratePDF(payment);
        }
    };

    const handleDirectPrint = async (copies = null) => {
        try {
            // Get user's default template, payment data, and copy preference (same as sales/purchase)
            const [templatesResponse, paymentResponse, copyPreferenceResponse] = await Promise.all([
                getTemplates('payment'),
                getPaymentForPrint(payment.id),
                getDefaultCopies('payment')
            ]);
            
            // Use default copies if not specified
            const finalCopies = copies || copyPreferenceResponse.defaultCopies || 2;
            
            const templates = templatesResponse.templates || [];
            const defaultTemplate = templates.find(t => t.default === true);
            
            if (!defaultTemplate) {
                toast.error('No default template found. Please set a default template first.');
                return;
            }

            if (!paymentResponse.success) {
                toast.error('Failed to fetch payment data for printing');
                return;
            }

            // Use real payment data from API (formatted by backend)
            const paymentData = paymentResponse.paymentData;

            console.log('🔍 Frontend Print - Received data:', {
                hasAllocations: paymentData.hasAllocations,
                allocationsCount: paymentData.allocations?.length || 0,
                firstAllocation: paymentData.allocations?.[0],
                companyName: paymentData.companyName,
                customerName: paymentData.customerName
            });

            // Process template exactly like backend does
            let processedHtml = generatePreviewHTML(defaultTemplate, paymentData);
            
            // Apply backend-compatible CSS adjustments for different copy counts
            processedHtml = adjustTemplateForCopies(processedHtml, finalCopies);
            
            // Generate multiple copies if needed
            if (finalCopies > 1) {
                processedHtml = generateMultipleCopies(processedHtml, finalCopies);
            }

            // Add exact A4 portrait page setup to match backend PDF generation
            const pageSetupCSS = `
                <style>
                    @page { 
                        size: A4 portrait; 
                        margin: 3mm; 
                    }
                    body { 
                        width: 794px; 
                        height: 1123px; 
                        margin: 0; 
                        padding: 0;
                        background: white; 
                        font-family: 'Noto Sans Gujarati', Arial, sans-serif;
                    }
                    @media print {
                        body { 
                            margin: 0; 
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .receipt-container { 
                            page-break-inside: avoid; 
                        }
                        * {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>`;
            processedHtml = processedHtml.replace('</head>', pageSetupCSS);

            // Open print window with exact backend settings
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
                        toast.success(`Payment receipt prepared for printing with ${finalCopies} ${finalCopies === 1 ? 'copy' : 'copies'}!`);
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
                            toast.success(`Payment receipt prepared for printing with ${finalCopies} ${finalCopies === 1 ? 'copy' : 'copies'}!`);
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

    // Duplicate function removed - using the first one

    // Don't render if payment is null
    if (!payment) {
        return null;
    }

    const getTransactionTypeDisplay = (transaction) => {
        const type = transaction.allocationType || transaction.type || 'purchase';
        
        switch (type) {
            case 'current-balance':
                return {
                    icon: <RiWalletLine className="me-1" size={14} />,
                    label: 'Current Balance',
                    color: 'info'
                };
            case 'purchase':
                return {
                    icon: <RiShoppingCartLine className="me-1" size={14} />,
                    label: 'Purchase',
                    color: 'warning'
                };
            case 'sale':
                return {
                    icon: <RiStoreLine className="me-1" size={14} />,
                    label: 'Sale',
                    color: 'success'
                };
            case 'expense':
                return {
                    icon: <RiBankLine className="me-1" size={14} />,
                    label: 'Expense',
                    color: 'danger'
                };
            case 'income':
                return {
                    icon: <RiBankLine className="me-1" size={14} />,
                    label: 'Income',
                    color: 'success'
                };
            default:
                return {
                    icon: <RiShoppingCartLine className="me-1" size={14} />,
                    label: 'Transaction',
                    color: 'secondary'
                };
        }
    };

    // Calculate payment summary
    const calculatePaymentSummary = () => {
        if (!payment) return {};

        const baseAmount = parseAmount(payment.amount);
        const adjustmentValue = parseAmount(payment.adjustmentValue);

        let totalDeducted = baseAmount;
        let allocatableAmount = baseAmount;
        let adjustmentImpact = { label: 'No adjustment', amount: 0 };

        if (payment.adjustmentType !== 'none' && adjustmentValue > 0) {
            if (payment.adjustmentType === 'discount') {
                allocatableAmount = baseAmount + adjustmentValue;
                adjustmentImpact = {
                    label: `Discount (+₹${formatAmount(adjustmentValue)})`,
                    amount: adjustmentValue
                };
            } else {
                totalDeducted = baseAmount + adjustmentValue;
                adjustmentImpact = {
                    label: payment.adjustmentType === 'surcharge'
                        ? `Surcharge (+₹${formatAmount(adjustmentValue)})`
                        : `Extra Receipt (+₹${formatAmount(adjustmentValue)})`,
                    amount: adjustmentValue
                };
            }
        }

        const totalAllocated = payment.transactions?.reduce((sum, t) => sum + parseAmount(t.amount), 0) || 0;
        const remainingAmount = allocatableAmount - totalAllocated;
        const isBalanced = Math.abs(remainingAmount) < 0.01;

        return {
            baseAmount,
            adjustmentImpact,
            totalDeducted,
            allocatableAmount,
            totalAllocated,
            remainingAmount,
            isBalanced
        };
    };

    const paymentSummary = calculatePaymentSummary();

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="xl" className="payment-view-modal">
            <style>{spinnerStyle}</style>
            <ModalHeader toggle={toggle} className="py-2">
                <div className="d-flex align-items-center">
                    <div className="rounded bg-primary-subtle d-flex align-items-center justify-content-center me-2" style={{width: '1.5rem', height: '1.5rem'}}>
                        <RiCashLine className="text-primary" size={14} />
                    </div>
                    <div>
                        <h6 className="modal-title mb-0">Payment Details</h6>
                        <p className="text-muted mb-0" style={{fontSize: '0.75rem'}}>
                            {payment?.paymentNumber || 'Payment Information'} • 
                            <span className="ms-1">
                            {payment?.status?.charAt(0).toUpperCase() + payment?.status?.slice(1) || 'N/A'}
                            </span>
                        </p>
                    </div>
                </div>
            </ModalHeader>
            <ModalBody className="py-2" style={{maxHeight: '70vh', overflowY: 'auto'}}>
                {payment && (
                    <div>
                        {/* Main Content in Two Columns */}
                        <Row className="g-3">
                            {/* Left Column - Payment Details */}
                            <Col md={8}>
                                {/* Compact Payment Info */}
                                <div className="bg-light rounded p-2 mb-2 border">
                                    <Row className="align-items-center">
                                        <Col md={8}>
                                            <div className="d-flex flex-wrap gap-1 align-items-center">
                                                <Badge color="light" className="px-2 py-1" style={{fontSize: '0.7rem'}}>
                                                    {new Date(payment.date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </Badge>
                                                <Badge color="light" className="px-2 py-1" style={{fontSize: '0.7rem'}}>
                                                    {payment.contactName || 'N/A'}
                                                </Badge>
                                                <Badge color="light" className="px-2 py-1" style={{fontSize: '0.7rem'}}>
                                                    {payment.bankName || 'N/A'}
                                                </Badge>
                                                <Badge color={payment.type === 'receivable' ? 'success' : 'warning'} className="badge-soft px-2 py-1" style={{fontSize: '0.7rem'}}>
                                                    {payment.type === 'receivable' ? 'Receivable' : 'Payable'}
                                                </Badge>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="text-end">
                                                <div className="text-muted" style={{fontSize: '0.7rem', marginBottom: '0.25rem'}}>Amount</div>
                                                <div className="h5 text-success fw-bold mb-0">
                                                    ₹{formatAmount(paymentSummary.baseAmount)}
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                </div>

                                {/* Description and Adjustment in One Row */}
                                <Row className="g-2 mb-2">
                                    <Col md={payment.adjustmentType !== 'none' ? 8 : 12}>
                                        <div className="border rounded p-2">
                                            <div className="d-flex align-items-center mb-1">
                                                <RiFileTextLine className="me-1 text-muted" size={12} />
                                                <span className="text-muted" style={{fontSize: '0.7rem', fontWeight: '600'}}>DESCRIPTION</span>
                                            </div>
                                            <p className="mb-0" style={{fontSize: '0.8rem', lineHeight: '1.3'}}>{payment.description || 'No description provided'}</p>
                                        </div>
                                    </Col>
                                    {payment.adjustmentType !== 'none' && (
                                        <Col md={4}>
                                            <div className="border rounded p-2">
                                                <div className="d-flex align-items-center mb-1">
                                                    <RiWalletLine className="me-1 text-muted" size={12} />
                                                    <span className="text-muted" style={{fontSize: '0.7rem', fontWeight: '600'}}>ADJUSTMENT</span>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <span style={{fontSize: '0.8rem'}}>
                                                        {payment.adjustmentType === 'discount' ? 'Discount' :
                                                            payment.adjustmentType === 'extra_receipt' ? 'Extra Receipt' :
                                                                payment.adjustmentType === 'surcharge' ? 'Surcharge' : 'N/A'}
                                                    </span>
                                                    <span className="fw-bold" style={{fontSize: '0.8rem'}}>
                                                        ₹{formatAmount(payment.adjustmentValue || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </Col>
                                    )}
                                </Row>

                                {/* Compact Transactions Table */}
                                <div className="border rounded p-2">
                                    <div className="d-flex align-items-center mb-2">
                                        <RiShoppingCartLine className="me-1 text-muted" size={12} />
                                        <span className="text-muted" style={{fontSize: '0.7rem', fontWeight: '600'}}>
                                            APPLIED TRANSACTIONS ({payment.transactions?.length || 0})
                                        </span>
                                    </div>
                                    {payment.transactions?.length > 0 ? (
                                        <div className="table-responsive" style={{maxHeight: '150px', overflowY: 'auto'}}>
                                            <Table className="table-sm mb-0" style={{fontSize: '0.75rem'}}>
                                                <thead className="table-light sticky-top">
                                                    <tr>
                                                        <th style={{padding: '0.4rem 0.6rem'}}>Description</th>
                                                        <th className="text-center" style={{padding: '0.4rem 0.4rem'}}>Date</th>
                                                        <th className="text-center" style={{padding: '0.4rem 0.4rem'}}>Type</th>
                                                        <th className="text-end" style={{padding: '0.4rem 0.6rem'}}>Amount</th>
                                                        <th className="text-end" style={{padding: '0.4rem 0.6rem'}}>Allocated</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {payment.transactions.map((transaction, index) => {
                                                        const typeDisplay = getTransactionTypeDisplay(transaction);
                                                        return (
                                                            <tr key={transaction.transactionId || index}>
                                                                <td style={{padding: '0.4rem 0.6rem'}}>
                                                                    <div style={{fontSize: '0.75rem', fontWeight: '500'}}>{transaction.description || 'N/A'}</div>
                                                                </td>
                                                                <td className="text-center" style={{padding: '0.4rem 0.4rem'}}>
                                                                    <span style={{fontSize: '0.7rem'}}>{transaction.date ? new Date(transaction.date).toLocaleDateString('en-US', {
                                                                        month: 'short',
                                                                        day: 'numeric'
                                                                    }) : 'N/A'}</span>
                                                                </td>
                                                                <td className="text-center" style={{padding: '0.4rem 0.4rem'}}>
                                                                    <Badge color="light" style={{fontSize: '0.65rem', padding: '0.2rem 0.4rem'}}>
                                                                        {typeDisplay.label}
                                                                    </Badge>
                                                                </td>
                                                                <td className="text-end" style={{padding: '0.4rem 0.6rem', fontSize: '0.75rem'}}>₹{formatAmount(transaction.originalAmount)}</td>
                                                                <td className="text-end fw-bold" style={{padding: '0.4rem 0.6rem', fontSize: '0.75rem'}}>₹{formatAmount(transaction.amount)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-2 text-muted" style={{fontSize: '0.8rem'}}>
                                            <RiFileTextLine size={20} className="mb-1" />
                                            <div>No transactions applied</div>
                                        </div>
                                    )}
                                </div>

                                {/* Contact Address - Compact */}
                                {(payment.contactBillingAddress1 || payment.contactBillingCity || payment.contactBillingState) && (
                                    <div className="border rounded p-2 mt-2" style={{background: 'var(--vz-light-bg-subtle)'}}>
                                        <div className="d-flex align-items-center mb-1">
                                            <RiMapPinLine className="me-1 text-muted" size={12} />
                                            <span className="text-muted" style={{fontSize: '0.7rem', fontWeight: '600'}}>BILLING ADDRESS</span>
                                        </div>
                                        <address className="mb-0" style={{fontSize: '0.75rem', lineHeight: '1.3'}}>
                                            {payment.contactBillingAddress1 && <div>{payment.contactBillingAddress1}</div>}
                                            {payment.contactBillingAddress2 && <div>{payment.contactBillingAddress2}</div>}
                                            {(payment.contactBillingCity || payment.contactBillingState || payment.contactBillingPincode) && (
                                                <div>
                                                    {[payment.contactBillingCity, payment.contactBillingState, payment.contactBillingPincode].filter(Boolean).join(', ')}
                                                </div>
                                            )}
                                        </address>
                                    </div>
                                )}
                            </Col>

                            {/* Right Column - Summary and System Info */}
                            <Col md={4}>
                                {/* Payment Summary - Vertical Compact */}
                                <div className="border rounded p-2 mb-2" style={{background: 'var(--vz-body-bg)'}}>
                                    <div className="d-flex align-items-center mb-2">
                                        <RiBankLine className="me-1 text-muted" size={12} />
                                        <span className="text-muted" style={{fontSize: '0.7rem', fontWeight: '600'}}>PAYMENT SUMMARY</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span style={{fontSize: '0.75rem'}}>Adjustment:</span>
                                        <span className="text-info fw-bold" style={{fontSize: '0.75rem'}}>
                                            {paymentSummary.adjustmentImpact.amount > 0 ? '+' : ''}₹{formatAmount(Math.abs(paymentSummary.adjustmentImpact.amount))}
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span style={{fontSize: '0.75rem'}}>Deducted:</span>
                                        <span className="text-danger fw-bold" style={{fontSize: '0.75rem'}}>
                                            ₹{formatAmount(paymentSummary.totalDeducted)}
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span style={{fontSize: '0.75rem'}}>Allocatable:</span>
                                        <span className="text-info fw-bold" style={{fontSize: '0.75rem'}}>
                                            ₹{formatAmount(paymentSummary.allocatableAmount)}
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between border-top pt-1">
                                        <span style={{fontSize: '0.75rem'}}>Remaining:</span>
                                        <span className={`fw-bold ${paymentSummary.remainingAmount < 0 ? 'text-danger' :
                                                paymentSummary.remainingAmount > 0 ? 'text-warning' : 'text-success'}`} style={{fontSize: '0.75rem'}}>
                                            ₹{formatAmount(Math.abs(paymentSummary.remainingAmount))}
                                            {paymentSummary.remainingAmount < 0 ? ' (Over)' : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* System Info - Compact */}
                                <div className="border rounded p-2" style={{background: 'var(--vz-light-bg-subtle)'}}>
                                    <div className="d-flex align-items-center mb-2">
                                        <RiUserLine className="me-1 text-muted" size={12} />
                                        <span className="text-muted" style={{fontSize: '0.7rem', fontWeight: '600'}}>SYSTEM INFO</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span style={{fontSize: '0.75rem'}}>Created By:</span>
                                        <span style={{fontSize: '0.75rem', fontWeight: '500'}}>{payment.createdByName || 'System'}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span style={{fontSize: '0.75rem'}}>Created:</span>
                                        <span style={{fontSize: '0.75rem', fontWeight: '500'}}>
                                            {new Date(payment.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between">
                                        <span style={{fontSize: '0.75rem'}}>Updated:</span>
                                        <span style={{fontSize: '0.75rem', fontWeight: '500'}}>
                                            {new Date(payment.updatedAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {/* Warning for unbalanced payments */}
                        {!paymentSummary.isBalanced && (
                            <Alert color="warning" className="mt-2 mb-0" style={{padding: '0.5rem', fontSize: '0.8rem'}}>
                                <RiAlertLine className="me-1" size={14} />
                                The allocated amounts don't match the allocatable amount.
                            </Alert>
                        )}
                    </div>
                )}
            </ModalBody>
            <ModalFooter className="bg-light py-2">
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center w-100 gap-2">
                    <div className="d-flex gap-2 order-2 order-sm-1">
                        <Button color="secondary" size="sm" onClick={toggle} className="btn-soft-secondary flex-fill flex-sm-grow-0">
                    <RiCloseLine className="me-1" /> Close
                </Button>
                    </div>
                    
                                         <div className="d-flex flex-wrap gap-2 order-1 order-sm-2 justify-content-center justify-content-sm-end">
                         {/* Print Button - simplified without dropdown */}
                <Button 
                             color="info"
                             size="sm"
                             onClick={() => handleDirectPrint()}
                             className="btn-soft-info text-info"
                         >
                             <RiPrinterLine className="me-1" /> 
                             <span className="d-none d-sm-inline">Print Receipt</span>
                             <span className="d-inline d-sm-none">Print</span>
                         </Button>
                         
                         {/* Download PDF Button with Copy Options */}
                         <UncontrolledDropdown>
                             <DropdownToggle 
                                 color="primary" 
                    size="sm"
                                 caret 
                    disabled={pdfLoading === payment?.id}
                                 className="btn-soft-primary text-primary"
                >
                    {pdfLoading === payment?.id ? (
                        <>
                            <i className="ri-loader-4-line spin me-1"></i>
                                         <span className="d-none d-sm-inline">Generating...</span>
                                         <span className="d-inline d-sm-none">Gen...</span>
                        </>
                    ) : (
                        <>
                                         <RiDownload2Line className="me-1" /> 
                                         <span className="d-none d-sm-inline">Download PDF</span>
                                         <span className="d-inline d-sm-none">PDF</span>
                        </>
                    )}
                    </DropdownToggle>
                             <DropdownMenu end className="shadow-lg border-0" style={{ minWidth: '200px' }}>
                                 <DropdownItem header className="bg-light text-dark fw-bold py-2 px-3 border-bottom">
                                     📄 PDF Options
                        </DropdownItem>
                                 
                                 <DropdownItem 
                                     onClick={() => onGeneratePDF && onGeneratePDF(payment)} 
                                     className="py-2 px-3 d-flex align-items-center"
                                 >
                                     <div className="me-3">
                                         <i className="ri-star-fill text-warning" style={{ fontSize: '16px' }}></i>
                                     </div>
                                     <div>
                                         <div className="fw-semibold text-dark">Quick Download</div>
                                         <small className="text-muted">{defaultCopies} {defaultCopies === 1 ? 'copy' : 'copies'} • Your default</small>
                                     </div>
                        </DropdownItem>
                                 
                                 <DropdownItem divider className="my-1" />
                                 
                                 <DropdownItem 
                                     onClick={() => onGeneratePDF && onGeneratePDF(payment, 1)} 
                                     className="py-2 px-3 d-flex align-items-center"
                                 >
                                     <div className="me-3">
                                         <i className="ri-file-text-line text-primary" style={{ fontSize: '16px' }}></i>
                                     </div>
                                     <div>
                                         <div className="fw-semibold text-dark">Single Page</div>
                                         <small className="text-muted">1 copy • Full size</small>
                                     </div>
                        </DropdownItem>
                                 
                                 <DropdownItem 
                                     onClick={() => onGeneratePDF && onGeneratePDF(payment, 2)} 
                                     className="py-2 px-3 d-flex align-items-center"
                                 >
                                     <div className="me-3">
                                         <i className="ri-file-copy-line text-success" style={{ fontSize: '16px' }}></i>
                                     </div>
                                     <div>
                                         <div className="fw-semibold text-dark">Standard</div>
                                         <small className="text-muted">2 copies • Most common</small>
                                     </div>
                        </DropdownItem>
                                 
                                 <DropdownItem 
                                     onClick={() => onGeneratePDF && onGeneratePDF(payment, 4)} 
                                     className="py-2 px-3 d-flex align-items-center"
                                 >
                                     <div className="me-3">
                                         <i className="ri-file-list-line text-info" style={{ fontSize: '16px' }}></i>
                                     </div>
                                     <div>
                                         <div className="fw-semibold text-dark">Compact</div>
                                         <small className="text-muted">4 copies • Space saving</small>
                                     </div>
                        </DropdownItem>
                    </DropdownMenu>
                </UncontrolledDropdown>
                     </div>
                </div>
            </ModalFooter>
        </Modal>
    );
};

export default PaymentViewModal;
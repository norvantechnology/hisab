import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Row,
  Col,
  Table,
  Badge,
  Card,
  CardBody,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';
import { RiCloseLine, RiDownload2Line, RiUserLine, RiBankLine, RiArrowRightLine, RiStoreLine, RiPrinterLine, RiWalletLine } from 'react-icons/ri';
import { generateSampleData, generatePreviewHTML, adjustTemplateForCopies, generateMultipleCopies } from '../../../utils/templatePreviewUtils';
import { getTemplates } from '../../../services/templates';
import { getSalesInvoiceForPrint } from '../../../services/salesInvoice';
import { getDefaultCopies } from '../../../services/copyPreferences';
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
`;

const SalesInvoiceViewModal = ({ isOpen, toggle, invoice, onGeneratePDF, pdfLoading }) => {
  const [defaultCopies, setDefaultCopies] = useState(2);

  // Fetch default copy preference when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDefaultCopies();
    }
  }, [isOpen]);

  const fetchDefaultCopies = async () => {
    try {
      const response = await getDefaultCopies('sales');
      setDefaultCopies(response.defaultCopies || 2);
    } catch (error) {
      console.error('Error fetching default copies:', error);
      // Use default value of 2 if fetch fails
      setDefaultCopies(2);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bgClass: 'bg-warning', textClass: 'text-dark', text: 'Pending', icon: 'ri-time-line' },
      paid: { bgClass: 'bg-success', textClass: 'text-white', text: 'Paid', icon: 'ri-check-line' },
      
      draft: { bgClass: 'bg-secondary', textClass: 'text-white', text: 'Draft', icon: 'ri-draft-line' },
      cancelled: { bgClass: 'bg-danger', textClass: 'text-white', text: 'Cancelled', icon: 'ri-close-line' }
    };

    const config = statusConfig[status] || { bgClass: 'bg-secondary', textClass: 'text-white', text: status, icon: 'ri-question-line' };
    return (
      <Badge className={`${config.bgClass} ${config.textClass} px-3 py-2 fw-medium border-0`}>
        <i className={`${config.icon} me-1`}></i>
        {config.text}
      </Badge>
    );
  };

  const getPaymentMethodDisplay = () => {
    const hasContact = invoice.contact?.name;
    const hasBank = invoice.bankAccount?.name;

    if (hasContact && hasBank) {
      return (
        <div className="d-flex align-items-center">
          <RiUserLine className="text-primary me-2" size={20} />
          <span className="fw-bold">{invoice.contact.name}</span>
          <RiArrowRightLine className="text-muted mx-2" />
          <RiBankLine className="text-success me-2" size={20} />
          <span className="text-success">{invoice.bankAccount.name}</span>
        </div>
      );
    } else if (hasBank && !hasContact) {
      return (
        <div className="d-flex align-items-center">
          <RiBankLine className="text-success me-2" size={20} />
          <span className="fw-bold text-success">{invoice.bankAccount.name}</span>
          <small className="text-muted ms-2">(Direct Bank Sale)</small>
        </div>
      );
    } else if (hasContact && !hasBank) {
      return (
        <div className="d-flex align-items-center">
          <RiUserLine className="text-primary me-2" size={20} />
          <span className="fw-bold">{invoice.contact.name}</span>
          <small className="text-muted ms-2">(No Payment Bank)</small>
        </div>
      );
    } else {
      return <span className="text-muted">No customer information</span>;
    }
  };

  const handleDirectPrint = async (copies = null) => {
    try {
      // Get user's default template, invoice data, and default copy preference
      const [templatesResponse, invoiceResponse, copyPreferenceResponse] = await Promise.all([
        getTemplates('sales'),
        getSalesInvoiceForPrint(invoice.id),
        getDefaultCopies('sales')
      ]);
      
      // Use default copies if not specified
      const finalCopies = copies || copyPreferenceResponse.defaultCopies || 2;
      
      const templates = templatesResponse.templates || [];
      const defaultTemplate = templates.find(t => t.default === true);
      
      if (!defaultTemplate) {
        toast.error('No default template found. Please set a default template first.');
        return;
      }

      if (!invoiceResponse.success) {
        toast.error('Failed to fetch invoice data for printing');
        return;
      }

      // Use real invoice data from API (formatted by backend)
      const invoiceData = invoiceResponse.invoiceData;



      // Process template exactly like backend does
      let processedHtml = generatePreviewHTML(defaultTemplate, invoiceData);
      
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
            .invoice-container { 
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

  if (!invoice) {
    return null;
  }

  // Get items from the invoice
  const invoiceItems = invoice.items || [];



  return (
    <>
      <style>
        {`
          ${spinnerStyle}
          .compact-view-modal .card {
            margin-bottom: 0.75rem;
          }
          .compact-view-modal .card-body {
            padding: 0.75rem;
          }
          .compact-view-modal .card-title {
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            font-weight: 600;
          }
          .compact-view-modal .table th,
          .compact-view-modal .table td {
            padding: 0.4rem;
            font-size: 0.8rem;
            vertical-align: middle;
          }
          .compact-view-modal .border-top {
            margin-top: 0.75rem;
            padding-top: 0.75rem;
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
          .btn-soft-success {
            background-color: rgba(10, 179, 156, 0.1);
            border-color: rgba(10, 179, 156, 0.1);
            color: #0ab39c;
          }
          .btn-soft-success:hover {
            background-color: rgba(10, 179, 156, 0.2);
            border-color: rgba(10, 179, 156, 0.2);
            color: #0ab39c;
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
          .badge-soft-primary {
            background-color: rgba(64, 81, 137, 0.15);
            color: #2c3e50;
            border: 1px solid rgba(64, 81, 137, 0.2);
          }
          .badge-soft-success {
            background-color: rgba(10, 179, 156, 0.15);
            color: #0d5c4d;
            border: 1px solid rgba(10, 179, 156, 0.2);
          }
          .badge-soft-warning {
            background-color: rgba(247, 184, 75, 0.15);
            color: #8b4513;
            border: 1px solid rgba(247, 184, 75, 0.2);
          }
          .badge-soft-info {
            background-color: rgba(13, 202, 240, 0.15);
            color: #0c5460;
            border: 1px solid rgba(13, 202, 240, 0.2);
          }
          .badge-soft-danger {
            background-color: rgba(239, 71, 111, 0.15);
            color: #8b1538;
            border: 1px solid rgba(239, 71, 111, 0.2);
          }
          .badge-soft-secondary {
            background-color: rgba(116, 120, 141, 0.15);
            color: #495057;
            border: 1px solid rgba(116, 120, 141, 0.2);
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
          @media (max-width: 576px) {
            .compact-view-modal .modal-dialog {
              margin: 0.5rem;
              max-width: calc(100% - 1rem);
            }
            .compact-view-modal .modal-content {
              border-radius: 8px;
            }
            .compact-view-modal .table-responsive {
              font-size: 0.75rem;
            }
            .compact-view-modal .btn {
              font-size: 0.75rem;
              padding: 0.375rem 0.5rem;
            }
            .compact-view-modal .badge {
              font-size: 0.65rem;
              padding: 0.25rem 0.5rem;
            }
          }
        `}
      </style>
    <Modal isOpen={isOpen} toggle={toggle} size="xl" className="compact-view-modal modal-dialog-centered">
      <ModalHeader toggle={toggle} className="bg-light py-2">
        <div className="d-flex flex-column w-100 gap-2">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center flex-grow-1">
              <RiStoreLine className="text-success me-2" size={20} />
              <div>
                <h6 className="mb-0 fs-6">Sales Invoice #{invoice.invoiceNumber}</h6>
                <small className="text-muted">{formatDate(invoice.invoiceDate)}</small>
              </div>
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 justify-content-start">
            {getStatusBadge(invoice.status)}
            <Badge className="bg-primary text-white fw-medium border-0">
              Total: {formatCurrency(invoice.netReceivable)}
            </Badge>
            {invoice.status === 'pending' && parseFloat(invoice.remainingAmount || 0) > 0 && (
              <Badge className="bg-warning text-dark fw-medium border-0">
                Due: {formatCurrency(invoice.remainingAmount)}
              </Badge>
            )}
          </div>
        </div>
      </ModalHeader>
      
      <ModalBody className="p-2">
        {/* Customer & Payment Section - More Compact */}
        <Card className="border-0 shadow-sm">
          <CardBody>
            <Row className="align-items-center">
              <Col md={6}>
                <h6 className="card-title mb-2 text-muted">
                  <RiUserLine className="me-2" />
                  Customer & Payment
                </h6>
                <div className="mb-2">
                  {getPaymentMethodDisplay()}
                </div>
              </Col>
              <Col md={6}>
                {/* Customer details in compact format */}
                {invoice.contact && (
                  <div className="row g-1 small">
                    {invoice.contact.email && (
                      <div className="col-4">
                        <div className="text-muted">Email:</div>
                        <div className="fw-medium">{invoice.contact.email}</div>
                      </div>
                    )}
                    {invoice.contact.mobile && (
                      <div className="col-4">
                        <div className="text-muted">Mobile:</div>
                        <div className="fw-medium">{invoice.contact.mobile}</div>
                      </div>
                    )}
                    {invoice.contact.gstin && (
                      <div className="col-4">
                        <div className="text-muted">GSTIN:</div>
                        <div className="fw-medium">{invoice.contact.gstin}</div>
                      </div>
                    )}
                  </div>
                )}
              </Col>
            </Row>

            {/* Invoice Details Section */}
            <div className="mt-2 pt-2 border-top">
              <div className="row g-2 small">
                <div className="col-3">
                  <div className="text-muted">Tax Type:</div>
                  <div className="fw-medium">{invoice.taxType || 'N/A'}</div>
                </div>
                <div className="col-3">
                  <div className="text-muted">Rate Type:</div>
                  <div className="fw-medium">{invoice.rateType === 'with_tax' ? 'With Tax' : 'Without Tax'}</div>
                </div>
                <div className="col-3">
                  <div className="text-muted">Discount Scope:</div>
                  <div className="fw-medium">{invoice.discountScope || 'None'}</div>
                </div>
                <div className="col-3">
                  <div className="text-muted">Payment Method:</div>
                  <div className="fw-medium">
                    {invoice.status === 'paid' ? 
                      (invoice.bankAccount?.name ? `Bank (${invoice.bankAccount.name})` : 'Cash') : 
                      'Credit'}
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Billing Address */}
            {invoice.contact && (invoice.contact.billingAddress1 || invoice.contact.billingCity || invoice.contact.billingState) && (
              <div className="mt-2 pt-2 border-top">
                <small className="text-muted d-flex align-items-center">
                  <i className="ri-map-pin-line me-1"></i>
                  <strong>Address:</strong>
                  <span className="ms-1">
                    {[
                      invoice.contact.billingAddress1,
                      invoice.contact.billingAddress2,
                      [invoice.contact.billingCity, invoice.contact.billingState, invoice.contact.billingPincode].filter(Boolean).join(', '),
                      invoice.contact.billingCountry
                    ].filter(Boolean).join(', ')}
                  </span>
                </small>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Combined Items and Summary Section */}
        <Card className="border-0 shadow-sm">
          <CardBody>
            <Row>
              <Col md={8}>
                <h6 className="card-title mb-2 text-muted">Items ({invoiceItems.length})</h6>
                <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <Table className="table-sm table-striped">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>Product</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Rate</th>
                        <th className="text-end">Disc.</th>
                        <th className="text-end">Tax</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems && invoiceItems.length > 0 ? (
                        invoiceItems.map((item, index) => (
                          <tr key={item.id || index}>
                            <td>
                              <div>
                                <strong className="small">{item.name}</strong>
                                {item.code && (
                                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>{item.code}</div>
                                )}
                                {item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0 && (
                                  <div className="mt-1">
                                    {item.serialNumbers.slice(0, 2).map((serial, idx) => (
                                      <Badge key={idx} color="info" size="sm" className="me-1" style={{ fontSize: '0.6rem' }}>
                                        {serial}
                                      </Badge>
                                    ))}
                                    {item.serialNumbers.length > 2 && (
                                      <small className="text-muted">+{item.serialNumbers.length - 2} more</small>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-end">{formatCurrency(item.rate)}</td>
                            <td className="text-end">
                              <small>
                                {(item.discountAmount > 0) ? formatCurrency(item.discountAmount) : 
                                 (item.discountValue > 0) ? 
                                   (item.discountType === 'percentage' ? `${item.discountValue}%` : formatCurrency(item.discountValue)) : 
                                 (item.discountRate > 0) ? `${item.discountRate}%` : 
                                 '0'}
                              </small>
                            </td>
                            <td className="text-end">
                              <small>{item.taxRate}%</small>
                            </td>
                            <td className="text-end fw-bold">{formatCurrency(item.lineTotal || item.total)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center text-muted py-3">
                            No items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </Col>
              <Col md={4}>
                <div className="d-flex flex-column h-100">
                  {/* Summary Section */}
                  <div className="border rounded p-3 bg-light flex-grow-1">
                    <h6 className="text-primary mb-3 fw-bold">Invoice Summary</h6>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="small">Subtotal:</span>
                      <span className="small fw-medium">{formatCurrency(invoice.basicAmount)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="small">Tax:</span>
                      <span className="small fw-medium text-success">+{formatCurrency(invoice.taxAmount)}</span>
                    </div>
                    {parseFloat(invoice.totalItemDiscount || 0) > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="small">Item Discount:</span>
                        <span className="small fw-medium text-danger">-{formatCurrency(invoice.totalItemDiscount)}</span>
                      </div>
                    )}
                    {parseFloat(invoice.invoiceDiscount || 0) > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="small">Invoice Discount:</span>
                        <span className="small fw-medium text-danger">-{formatCurrency(invoice.invoiceDiscount)}</span>
                      </div>
                    )}
                    {parseFloat(invoice.transportationCharge || 0) > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="small">Transportation Charge:</span>
                        <span className="small fw-medium text-info">{formatCurrency(invoice.transportationCharge)}</span>
                      </div>
                    )}
                    {parseFloat(invoice.roundOff || 0) !== 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="small">Round Off:</span>
                        <span className={`small fw-medium ${parseFloat(invoice.roundOff || 0) > 0 ? 'text-success' : 'text-danger'}`}>
                          {parseFloat(invoice.roundOff || 0) > 0 ? '+' : ''}{formatCurrency(Math.abs(parseFloat(invoice.roundOff || 0)))}
                        </span>
                      </div>
                    )}
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between">
                      <strong className="text-success">Total:</strong>
                      <strong className="text-success fs-5">{formatCurrency(invoice.netReceivable)}</strong>
                    </div>
                  </div>
                  
                  {/* Notes Section */}
                  {invoice.internalNotes && (
                    <div className="border rounded p-3 bg-light mt-2">
                      <h6 className="text-muted mb-2">Notes</h6>
                      <p className="mb-0 small text-muted">{invoice.internalNotes}</p>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          </CardBody>
        </Card>
      </ModalBody>
      
      <ModalFooter className="bg-light py-2">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center w-100 gap-2">
          <div className="d-flex gap-2 order-2 order-sm-1">
            <Button color="secondary" size="sm" onClick={toggle} className="btn-soft-secondary flex-fill flex-sm-grow-0">
          <RiCloseLine className="me-1" /> Close
        </Button>
          </div>
          
          <div className="d-flex flex-wrap gap-2 order-1 order-sm-2 justify-content-center justify-content-sm-end">
            {/* Payment Button - only show for pending invoices with remaining amount */}
            {invoice.status === 'pending' && parseFloat(invoice.remainingAmount || 0) > 0 && (
              <Button 
                color="success" 
                size="sm" 
                onClick={() => {
                  // This will be handled by parent component
                  if (window.handleCreatePayment) {
                    window.handleCreatePayment(invoice);
                  }
                }}
                className="bg-success text-white border-0 fw-medium"
                style={{ minWidth: 'auto' }}
              >
                <RiWalletLine className="me-1" />
                <span className="d-none d-sm-inline">Collect Payment</span>
                <span className="d-inline d-sm-none">Collect</span>
                <Badge className="bg-light text-success ms-2 border border-light">
                  {formatCurrency(invoice.remainingAmount)}
                </Badge>
              </Button>
            )}
            
            {/* Print Button - simplified without dropdown */}
            <Button 
              color="info"
              size="sm"
              onClick={() => handleDirectPrint()}
              className="btn-soft-info text-info"
            >
              <RiPrinterLine className="me-1" /> 
              <span className="d-none d-sm-inline">Print Invoice</span>
              <span className="d-inline d-sm-none">Print</span>
            </Button>
            
            {/* Download PDF Button - with copy options dropdown */}
        <UncontrolledDropdown>
              <DropdownToggle 
                color="primary" 
                size="sm" 
                caret 
                disabled={pdfLoading === invoice.id}
                className="btn-soft-primary text-primary"
              >
            {pdfLoading === invoice.id ? (
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
                  onClick={() => onGeneratePDF && onGeneratePDF(invoice)} 
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
                  onClick={() => onGeneratePDF && onGeneratePDF(invoice, 1)} 
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
                  onClick={() => onGeneratePDF && onGeneratePDF(invoice, 2)} 
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
                  onClick={() => onGeneratePDF && onGeneratePDF(invoice, 4)} 
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
    </>
  );
};

export default SalesInvoiceViewModal; 
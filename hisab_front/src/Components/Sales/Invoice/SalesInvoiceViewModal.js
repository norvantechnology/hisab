import React from 'react';
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
  CardBody
} from 'reactstrap';
import { RiCloseLine, RiDownload2Line, RiUserLine, RiBankLine, RiArrowRightLine } from 'react-icons/ri';

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
      pending: { color: 'warning', text: 'Pending' },
      paid: { color: 'success', text: 'Paid' },
      partial: { color: 'info', text: 'Partial' },
      draft: { color: 'secondary', text: 'Draft' },
      cancelled: { color: 'danger', text: 'Cancelled' }
    };

    const config = statusConfig[status] || { color: 'secondary', text: status };
    return (
      <Badge color={config.color} className="px-3 py-2">
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
            margin-bottom: 1rem;
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
            padding: 0.5rem;
            font-size: 0.875rem;
            vertical-align: middle;
          }
          .compact-view-modal .border-top {
            margin-top: 0.75rem;
            padding-top: 0.75rem;
          }
        `}
      </style>
    <Modal isOpen={isOpen} toggle={toggle} size="lg" className="compact-view-modal modal-dialog-centered">
      <ModalHeader toggle={toggle} className="bg-light py-2">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center w-100 gap-2">
          <div className="flex-grow-1">
            <h6 className="mb-0">Invoice #{invoice.invoiceNumber}</h6>
            <small className="text-muted">{formatDate(invoice.invoiceDate)}</small>
          </div>
          <div className="flex-shrink-0">
            {getStatusBadge(invoice.status)}
          </div>
        </div>
      </ModalHeader>
      
      <ModalBody className="p-2">
        {/* Customer & Payment Section */}
        <Card className="border-0 shadow-sm">
          <CardBody>
            <h6 className="card-title mb-2">
              <RiUserLine className="me-2" />
              Customer & Payment
            </h6>
            <div className="mb-2">
              {getPaymentMethodDisplay()}
            </div>
            
            {/* Additional customer details and billing address in same section */}
            {invoice.contact && (
              <div className="row g-2">
                {invoice.contact.email && (
                  <div className="col-md-4">
                    <small className="text-muted d-block">Email</small>
                    <span className="small">{invoice.contact.email}</span>
                  </div>
                )}
                {invoice.contact.mobile && (
                  <div className="col-md-4">
                    <small className="text-muted d-block">Mobile</small>
                    <span className="small">{invoice.contact.mobile}</span>
                  </div>
                )}
                {invoice.contact.gstin && (
                  <div className="col-md-4">
                    <small className="text-muted d-block">GSTIN</small>
                    <span className="small">{invoice.contact.gstin}</span>
                  </div>
                )}
              </div>
            )}

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

        {/* Items Section */}
        <Card className="border-0 shadow-sm">
          <CardBody>
            <h6 className="card-title mb-2">Items ({invoiceItems.length})</h6>
            <div className="table-responsive">
              <Table className="table-sm">
                <thead className="table-light">
                  <tr>
                    <th>Product</th>
                    <th className="text-center">Qty</th>
                    <th className="text-end">Rate</th>
                    <th className="text-end">Discount</th>
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
                            <strong>{item.name}</strong>
                            {item.code && (
                              <small className="text-muted d-block">{item.code}</small>
                            )}
                            {item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0 && (
                              <div className="mt-1">
                                {item.serialNumbers.map((serial, idx) => (
                                  <Badge key={idx} color="info" size="sm" className="me-1">
                                    {serial}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-end">{formatCurrency(item.rate)}</td>
                        <td className="text-end">
                          {item.discountRate > 0 ? `${item.discountRate}% (${formatCurrency(item.discount)})` : '0%'}
                        </td>
                        <td className="text-end">
                          {item.taxRate}% ({formatCurrency(item.taxAmount)})
                        </td>
                        <td className="text-end fw-bold">{formatCurrency(item.total)}</td>
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
          </CardBody>
        </Card>

        {/* Summary Section */}
        <Row className="g-2">
          <Col md={5}>
            {invoice.internalNotes && (
              <Card className="border-0 shadow-sm h-100">
                <CardBody>
                  <h6 className="card-title mb-2">Notes</h6>
                  <p className="mb-0 text-muted small">{invoice.internalNotes}</p>
                </CardBody>
              </Card>
            )}
          </Col>
          <Col md={7}>
            <Card className="border-0 shadow-sm">
              <CardBody>
                <h6 className="card-title mb-2">Summary</h6>
                <div className="d-flex justify-content-between mb-1">
                  <span className="small">Basic Amount:</span>
                  <span className="small">{formatCurrency(invoice.basicAmount)}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="small">Tax:</span>
                  <span className="small">{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="small">Discount:</span>
                  <span className="small text-danger">{formatCurrency(invoice.totalDiscount)}</span>
                </div>
                {invoice.roundOff && (
                  <div className="d-flex justify-content-between mb-1">
                    <span className="small">Round Off:</span>
                    <span className="small">{formatCurrency(invoice.roundOff)}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="d-flex justify-content-between">
                  <strong className="small">Total:</strong>
                  <strong className="text-primary">{formatCurrency(invoice.netReceivable)}</strong>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </ModalBody>
      
      <ModalFooter className="bg-light py-2">
        <Button color="secondary" size="sm" onClick={toggle}>
          <RiCloseLine className="me-1" /> Close
        </Button>
        <Button 
          color="success"
          size="sm"
          onClick={() => onGeneratePDF && onGeneratePDF(invoice)}
          disabled={pdfLoading === invoice.id}
        >
          {pdfLoading === invoice.id ? (
            <>
              <i className="ri-loader-4-line spin me-1"></i>
              Generating...
            </>
          ) : (
            <>
          <RiDownload2Line className="me-1" /> Download PDF
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
    </>
  );
};

export default SalesInvoiceViewModal; 
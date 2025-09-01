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
import { RiCloseLine, RiDownload2Line, RiUserLine, RiBankLine, RiArrowRightLine, RiStoreLine } from 'react-icons/ri';

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
        `}
      </style>
    <Modal isOpen={isOpen} toggle={toggle} size="xl" className="compact-view-modal modal-dialog-centered">
      <ModalHeader toggle={toggle} className="bg-light py-2">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center w-100 gap-2">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center">
              <RiStoreLine className="text-success me-2" size={20} />
              <div>
                <h6 className="mb-0">Sales Invoice #{invoice.invoiceNumber}</h6>
                <small className="text-muted">{formatDate(invoice.invoiceDate)}</small>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 d-flex align-items-center gap-2">
            {getStatusBadge(invoice.status)}
            <Badge color="success" className="badge-soft-success">
              {formatCurrency(invoice.netReceivable)}
            </Badge>
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
                              <small>{item.discountRate > 0 ? `${item.discountRate}%` : '0%'}</small>
                            </td>
                            <td className="text-end">
                              <small>{item.taxRate}%</small>
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
              </Col>
              <Col md={4}>
                <div className="d-flex flex-column h-100">
                  {/* Summary Section */}
                  <div className="border rounded p-3 bg-light flex-grow-1">
                    <h6 className="text-muted mb-3">Invoice Summary</h6>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="small">Basic Amount:</span>
                      <span className="small fw-medium">{formatCurrency(invoice.basicAmount)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="small">Tax:</span>
                      <span className="small fw-medium">{formatCurrency(invoice.taxAmount)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="small">Discount:</span>
                      <span className="small fw-medium text-danger">-{formatCurrency(invoice.totalDiscount)}</span>
                    </div>
                    {parseFloat(invoice.transportationCharge || 0) > 0 && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="small">Transportation Charge:</span>
                        <span className="small fw-medium text-info">{formatCurrency(invoice.transportationCharge)}</span>
                      </div>
                    )}
                    {invoice.roundOff && (
                      <div className="d-flex justify-content-between mb-2">
                        <span className="small">Round Off:</span>
                        <span className="small fw-medium">{formatCurrency(invoice.roundOff)}</span>
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
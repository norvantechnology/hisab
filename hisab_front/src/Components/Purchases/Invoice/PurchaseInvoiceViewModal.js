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

const PurchaseInvoiceViewModal = ({ isOpen, toggle, invoice, onGeneratePDF, pdfLoading }) => {
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
    const hasContact = invoice.contactName || invoice.contactId;
    const hasBank = invoice.bankAccountName || invoice.accountName || invoice.bankAccountId;

    if (hasContact && hasBank) {
      return (
        <div className="d-flex align-items-center">
          <RiUserLine className="text-primary me-2" size={20} />
          <span className="fw-bold">{invoice.contactName}</span>
          <RiArrowRightLine className="text-muted mx-2" />
          <RiBankLine className="text-success me-2" size={20} />
          <span className="text-success">{invoice.bankAccountName || invoice.accountName}</span>
        </div>
      );
    } else if (hasBank && !hasContact) {
      return (
        <div className="d-flex align-items-center">
          <RiBankLine className="text-success me-2" size={20} />
          <span className="fw-bold text-success">{invoice.bankAccountName || invoice.accountName}</span>
          <small className="text-muted ms-2">(Direct Bank Purchase)</small>
        </div>
      );
    } else if (hasContact && !hasBank) {
      return (
        <div className="d-flex align-items-center">
          <RiUserLine className="text-primary me-2" size={20} />
          <span className="fw-bold">{invoice.contactName}</span>
          <small className="text-muted ms-2">(No Payment Bank)</small>
        </div>
      );
    } else {
      return <span className="text-muted">No vendor information</span>;
    }
  };

  if (!invoice) {
    return null;
  }



  return (
    <>
      <style>{spinnerStyle}</style>
    <Modal isOpen={isOpen} toggle={toggle} size="xl" className="modal-dialog-centered">
      <ModalHeader toggle={toggle} className="bg-light">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center w-100 gap-2">
          <div className="flex-grow-1">
            <h5 className="mb-0">Invoice #{invoice.invoiceNumber}</h5>
            <small className="text-muted">{formatDate(invoice.invoiceDate)}</small>
          </div>
          <div className="flex-shrink-0">
            {getStatusBadge(invoice.status)}
          </div>
        </div>
      </ModalHeader>
      
      <ModalBody className="p-4">
        {/* Vendor & Payment Section */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardBody>
            <h6 className="card-title mb-3">
              <RiUserLine className="me-2" />
              Vendor & Payment
            </h6>
            {getPaymentMethodDisplay()}
            
            {/* Additional vendor details if available */}
            {(invoice.contactEmail || invoice.contactMobile || invoice.contactGstin) && (
              <div className="mt-3 pt-3 border-top">
                <Row>
                  {invoice.contactEmail && (
                    <Col md={4}>
                      <small className="text-muted d-block">Email</small>
                      <span>{invoice.contactEmail}</span>
                    </Col>
                  )}
                  {invoice.contactMobile && (
                    <Col md={4}>
                      <small className="text-muted d-block">Mobile</small>
                      <span>{invoice.contactMobile}</span>
                    </Col>
                  )}
                  {invoice.contactGstin && (
                    <Col md={4}>
                      <small className="text-muted d-block">GSTIN</small>
                      <span>{invoice.contactGstin}</span>
                    </Col>
                  )}
                </Row>
              </div>
            )}



            {/* Contact Billing Address */}
            {(invoice.contactBillingAddress1 || invoice.contactBillingCity || invoice.contactBillingState) && (
              <div className="mt-3 pt-3 border-top">
                <h6 className="text-muted mb-2">
                  <i className="ri-map-pin-line me-2"></i>
                  Billing Address
                </h6>
                <div className="border rounded p-3 bg-light">
                  {invoice.contactBillingAddress1 && (
                    <div className="mb-1">{invoice.contactBillingAddress1}</div>
                  )}
                  {invoice.contactBillingAddress2 && (
                    <div className="mb-1">{invoice.contactBillingAddress2}</div>
                  )}
                  <div className="mb-1">
                    {[
                      invoice.contactBillingCity,
                      invoice.contactBillingState,
                      invoice.contactBillingPincode
                    ].filter(Boolean).join(', ')}
                  </div>
                  {invoice.contactBillingCountry && (
                    <div>{invoice.contactBillingCountry}</div>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Items Section */}
        <Card className="mb-4 border-0 shadow-sm">
          <CardBody>
            <h6 className="card-title mb-3">Items ({invoice.items?.length || 0})</h6>
            <div className="table-responsive">
              <Table className="table-sm">
                <thead className="table-light">
                  <tr>
                    <th>Product</th>
                    <th className="text-center">Qty</th>
                    <th className="text-end">Rate</th>
                    <th className="text-end">Tax</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>
                        <div>
                          <strong>{item.productName || item.name}</strong>
                          {item.productCode && (
                            <small className="text-muted d-block">{item.productCode}</small>
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
                        {item.taxRate}% ({formatCurrency(item.taxAmount)})
                      </td>
                      <td className="text-end fw-bold">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>

        {/* Summary Section */}
        <Row>
          <Col md={8}>
            {invoice.internalNotes && (
              <Card className="border-0 shadow-sm">
                <CardBody>
                  <h6 className="card-title">Notes</h6>
                  <p className="mb-0 text-muted">{invoice.internalNotes}</p>
                </CardBody>
              </Card>
            )}
          </Col>
          <Col md={4}>
            <Card className="border-0 shadow-sm">
              <CardBody>
                <h6 className="card-title">Summary</h6>
                <div className="d-flex justify-content-between mb-2">
                  <span>Basic Amount:</span>
                  <span>{formatCurrency(invoice.basicAmount)}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>Tax:</span>
                  <span>{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>Discount:</span>
                  <span>{formatCurrency(invoice.totalDiscount)}</span>
                </div>
                {invoice.roundOff && (
                  <div className="d-flex justify-content-between mb-2">
                    <span>Round Off:</span>
                    <span>{formatCurrency(invoice.roundOff)}</span>
                  </div>
                )}
                <hr />
                <div className="d-flex justify-content-between">
                  <strong>Total:</strong>
                  <strong className="text-primary fs-5">{formatCurrency(invoice.netPayable)}</strong>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </ModalBody>
      
      <ModalFooter className="bg-light">
        <Button color="secondary" onClick={toggle}>
          <RiCloseLine className="me-1" /> Close
        </Button>
        <Button 
          color="primary"
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

export default PurchaseInvoiceViewModal;
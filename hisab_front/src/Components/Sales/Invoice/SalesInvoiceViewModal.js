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
import { RiCloseLine, RiDownload2Line } from 'react-icons/ri';

const SalesInvoiceViewModal = ({ isOpen, toggle, invoice }) => {
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
      pending: { color: 'warning', bgColor: 'bg-warning', text: 'Pending' },
      paid: { color: 'success', bgColor: 'bg-success', text: 'Paid' },
      partial: { color: 'info', bgColor: 'bg-info', text: 'Partial' },
      draft: { color: 'secondary', bgColor: 'bg-secondary', text: 'Draft' },
      cancelled: { color: 'danger', bgColor: 'bg-danger', text: 'Cancelled' }
    };

    const config = statusConfig[status] || { color: 'secondary', bgColor: 'bg-secondary', text: status };
    return (
      <Badge 
        color={config.color} 
        className={`${config.bgColor} text-white border-0`}
        style={{ 
          fontWeight: '600',
          fontSize: '0.75rem',
          padding: '0.375rem 0.75rem'
        }}
      >
        {config.text}
      </Badge>
    );
  };

  if (!invoice) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xl" className="modal-dialog-centered">
      <ModalHeader toggle={toggle}>
        Sales Invoice - {invoice.invoiceNumber}
      </ModalHeader>
      <ModalBody>
        <Row>
          <Col md={6}>
            <Card className="mb-3">
              <CardBody>
                <h6 className="card-title">Invoice Details</h6>
                <Row>
                  <Col md={6}>
                    <strong>Invoice Number:</strong>
                  </Col>
                  <Col md={6}>
                    {invoice.invoiceNumber}
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <strong>Date:</strong>
                  </Col>
                  <Col md={6}>
                    {formatDate(invoice.invoiceDate)}
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <strong>Status:</strong>
                  </Col>
                  <Col md={6}>
                    {getStatusBadge(invoice.status)}
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <strong>Created By:</strong>
                  </Col>
                  <Col md={6}>
                    {invoice.createdByName || 'N/A'}
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <strong>Created At:</strong>
                  </Col>
                  <Col md={6}>
                    {new Date(invoice.createdAt).toLocaleString()}
                  </Col>
                </Row>
              </CardBody>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="mb-3">
              <CardBody>
                <h6 className="card-title">Customer Details</h6>
                {invoice.contact ? (
                  <>
                    <Row>
                      <Col md={6}>
                        <strong>Name:</strong>
                      </Col>
                      <Col md={6}>
                        {invoice.contact.name}
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <strong>Email:</strong>
                      </Col>
                      <Col md={6}>
                        {invoice.contact.email || 'N/A'}
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <strong>Mobile:</strong>
                      </Col>
                      <Col md={6}>
                        {invoice.contact.mobile || 'N/A'}
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <strong>GSTIN:</strong>
                      </Col>
                      <Col md={6}>
                        {invoice.contact.gstin || 'N/A'}
                      </Col>
                    </Row>
                  </>
                ) : invoice.bankAccount ? (
                  <>
                    <Row>
                      <Col md={6}>
                        <strong>Account Name:</strong>
                      </Col>
                      <Col md={6}>
                        {invoice.bankAccount.accountName}
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <strong>Account Type:</strong>
                      </Col>
                      <Col md={6}>
                        {invoice.bankAccount.accountType}
                      </Col>
                    </Row>
                  </>
                ) : (
                  <p className="text-muted">No customer information available</p>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        <Card className="mb-3">
          <CardBody>
            <h6 className="card-title">Items</h6>
            <div className="table-responsive">
              <Table className="table-nowrap">
                <thead className="table-light">
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Tax Rate</th>
                    <th>Tax Amount</th>
                    <th>Discount</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>
                        <div>
                          <strong>{item.productName || item.name}</strong>
                          {item.productCode && <small className="text-muted d-block">{item.productCode}</small>}
                          {item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0 && (
                            <div className="mt-1">
                              <small className="text-muted">Serial Numbers:</small>
                              <div className="mt-1">
                                {item.serialNumbers.map((serial, idx) => (
                                  <Badge key={idx} color="info" size="sm" className="me-1">
                                    {serial}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.rate)}</td>
                      <td>{item.taxRate}%</td>
                      <td>{formatCurrency(item.taxAmount)}</td>
                      <td>{formatCurrency(item.discount)}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </CardBody>
        </Card>

        <Row>
          <Col md={6}>
            {invoice.internalNotes && (
              <Card className="mb-3">
                <CardBody>
                  <h6 className="card-title">Internal Notes</h6>
                  <p className="mb-0">{invoice.internalNotes}</p>
                </CardBody>
              </Card>
            )}
          </Col>
          <Col md={6}>
            <Card className="mb-3">
              <CardBody>
                <h6 className="card-title">Summary</h6>
                <Row>
                  <Col md={6}>
                    <strong>Basic Amount:</strong>
                  </Col>
                  <Col md={6} className="text-end">
                    {formatCurrency(invoice.basicAmount)}
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <strong>Total Tax:</strong>
                  </Col>
                  <Col md={6} className="text-end">
                    {formatCurrency(invoice.taxAmount)}
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <strong>Total Discount:</strong>
                  </Col>
                  <Col md={6} className="text-end">
                    {formatCurrency(invoice.totalDiscount)}
                  </Col>
                </Row>
                {invoice.roundOff && (
                  <Row>
                    <Col md={6}>
                      <strong>Round Off:</strong>
                    </Col>
                    <Col md={6} className="text-end">
                      {formatCurrency(invoice.roundOff)}
                    </Col>
                  </Row>
                )}
                <hr />
                <Row>
                  <Col md={6}>
                    <strong>Net Receivable:</strong>
                  </Col>
                  <Col md={6} className="text-end">
                    <strong>{formatCurrency(invoice.netReceivable)}</strong>
                  </Col>
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>
          <RiCloseLine className="align-bottom" /> Close
        </Button>
        <Button color="primary">
          <RiDownload2Line className="align-bottom" /> Download PDF
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default SalesInvoiceViewModal; 
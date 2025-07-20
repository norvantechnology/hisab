import React from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge,
  Row,
  Col,
  Table
} from 'reactstrap';
import { format } from 'date-fns';
import { DISCOUNT_TYPES, TAX_TYPES } from './contant';

const PurchaseInvoiceViewModal = ({ isOpen, toggle, invoice }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  // Get display text for tax type
  const getTaxTypeText = (taxType) => {
    const tax = TAX_TYPES.find(t => t.value === taxType);
    return tax ? tax.label : 'N/A';
  };

  // Get display text for discount type
  const getDiscountTypeText = (discountType) => {
    const discount = DISCOUNT_TYPES.find(d => d.value === discountType);
    return discount ? discount.label : 'N/A';
  };

  // Get payment method text
  const getPaymentMethodText = () => {
    if (invoice?.paymentMethod === 'bank' && invoice?.bankAccount) {
      return `${invoice.bankAccount.name} (${invoice.bankAccount.type})`;
    }
    if (invoice?.contact) {
      return `Credit - ${invoice.contact.name}`;
    }
    return 'N/A';
  };

  // Calculate totals for display
  const calculateTotals = () => {
    if (!invoice) return null;

    return {
      basicAmount: invoice.basicAmount || 0,
      taxAmount: invoice.taxAmount || 0,
      totalDiscount: invoice.totalDiscount || 0,
      roundOff: invoice.roundOff || 0,
      netPayable: invoice.netPayable || 0
    };
  };

  const totals = calculateTotals();

  if (!invoice) return null;

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xl">
      <ModalHeader toggle={toggle}>Purchase Invoice Details</ModalHeader>
      <ModalBody>
        <Row className="mb-4">
          <Col md={6}>
            <div className="mb-3">
              <h6 className="text-muted">Invoice Number</h6>
              <h4>{invoice.invoiceNumber || 'N/A'}</h4>
            </div>
            <div className="mb-3">
              <h6 className="text-muted">Date</h6>
              <p>{formatDate(invoice.invoiceDate)}</p>
            </div>
          </Col>
          <Col md={6} className="text-end">
            <div className="mb-3">
              <h6 className="text-muted">Status</h6>
              <Badge
                color={invoice.status === 'paid' ? 'success' : 'warning'}
                className={`badge-soft-${invoice.status === 'paid' ? 'success' : 'warning'}`}
                pill
              >
                {invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : 'N/A'}
              </Badge>
            </div>
            <div className="mb-3">
              <h6 className="text-muted">Net Payable</h6>
              <h4>₹{(totals?.netPayable || 0).toFixed(2)}</h4>
            </div>
          </Col>
        </Row>

        <Row className="mb-4">
          <Col md={6}>
            <div className="mb-3">
              <h6 className="text-muted">Payment Method</h6>
              <p>{getPaymentMethodText()}</p>
            </div>
            {invoice.bankAccount && (
              <div className="mb-3">
                <h6 className="text-muted">Bank Details</h6>
                <p>
                  <strong>Name:</strong> {invoice.bankAccount.name}<br />
                  <strong>Type:</strong> {invoice.bankAccount.type}
                </p>
              </div>
            )}
          </Col>
          <Col md={6}>
            <div className="mb-3">
              <h6 className="text-muted">Tax & Discount</h6>
              <p>
                <strong>Tax Type:</strong> {getTaxTypeText(invoice.taxType)}<br />
                <strong>Discount Type:</strong> {getDiscountTypeText(invoice.discountType)}
                {invoice.discountValue > 0 && (
                  <span>, {invoice.discountValue}%</span>
                )}
              </p>
            </div>
            <div className="mb-3">
              <h6 className="text-muted">Round Off</h6>
              <p>₹{(invoice.roundOff || 0).toFixed(2)}</p>
            </div>
          </Col>
        </Row>

        <div className="mb-4">
          <h5 className="mb-3">Items ({invoice.itemsCount || 0})</h5>
          <Table bordered responsive>
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Code</th>
                <th className="text-end">Qty</th>
                <th className="text-end">Rate</th>
                <th className="text-end">Tax (%)</th>
                <th className="text-end">Tax Amount</th>
                <th className="text-end">Discount</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="fw-semibold">{item.productName}</div>
                    {item.productCode && <div className="text-muted small">{item.productCode}</div>}
                  </td>
                  <td>{item.productCode || '-'}</td>
                  <td className="text-end">{item.quantity}</td>
                  <td className="text-end">₹{item.rate?.toFixed(2) || '0.00'}</td>
                  <td className="text-end">{item.taxRate}%</td>
                  <td className="text-end">₹{item.taxAmount?.toFixed(2) || '0.00'}</td>
                  <td className="text-end">₹{item.discount?.toFixed(2) || '0.00'}</td>
                  <td className="text-end fw-bold">₹{item.total?.toFixed(2) || '0.00'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <Row>
          <Col md={6}>
            <div className="mb-3">
              <h6 className="text-muted">Internal Notes</h6>
              <p className="text-muted">{invoice.internalNotes || 'No notes available'}</p>
            </div>
          </Col>
          <Col md={6}>
            <div className="border p-3 bg-light">
              <h5>Summary</h5>
              <div className="d-flex justify-content-between mb-2">
                <span>Basic Amount:</span>
                <span>₹ {(totals?.basicAmount || 0).toFixed(2)}</span>
              </div>
              {totals?.totalDiscount > 0 && (
                <div className="d-flex justify-content-between mb-2">
                  <span>Total Discount:</span>
                  <span className="text-danger">- ₹ {(totals?.totalDiscount || 0).toFixed(2)}</span>
                </div>
              )}
              {totals?.taxAmount > 0 && (
                <div className="d-flex justify-content-between mb-2">
                  <span>Tax Amount:</span>
                  <span className="text-success">+ ₹ {(totals?.taxAmount || 0).toFixed(2)}</span>
                </div>
              )}
              {totals?.roundOff !== 0 && (
                <div className="d-flex justify-content-between mb-2">
                  <span>Round Off:</span>
                  <span className={totals?.roundOff > 0 ? 'text-success' : 'text-danger'}>
                    {totals?.roundOff > 0 ? '+' : ''}₹ {(totals?.roundOff || 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="d-flex justify-content-between mt-3 pt-2 border-top">
                <span className="fw-bold">Net Payable:</span>
                <span className="fw-bold">₹ {(totals?.netPayable || 0).toFixed(2)}</span>
              </div>
            </div>
          </Col>
        </Row>

        <hr />

        <Row>
          <Col md={6}>
            <div className="mb-3">
              <h6 className="text-muted">Created By</h6>
              <p>
                {invoice.createdBy?.firstName || 'System'}
                {invoice.createdBy?.email && (
                  <span className="d-block text-muted small">{invoice.createdBy.email}</span>
                )}
              </p>
            </div>
          </Col>
          <Col md={6}>
            <div className="mb-3">
              <h6 className="text-muted">Created At</h6>
              <p>{formatDate(invoice.createdAt)}</p>
            </div>
            <div className="mb-3">
              <h6 className="text-muted">Last Updated</h6>
              <p>{formatDate(invoice.updatedAt)}</p>
            </div>
          </Col>
        </Row>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={toggle}>Close</Button>
        <Button color="primary" onClick={() => window.print()}>Print</Button>
      </ModalFooter>
    </Modal>
  );
};

export default PurchaseInvoiceViewModal;
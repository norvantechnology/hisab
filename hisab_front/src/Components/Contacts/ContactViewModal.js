import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Row, Col } from 'reactstrap';

const ContactViewModal = ({ isOpen, toggle, contact }) => {
    const getContactTypeBadge = () => {
        const isCustomer = contact?.isCustomer;
        const isVendor = contact?.isVendor;
        let type = '';
        let color = '';

        if (isCustomer && isVendor) {
            type = 'Customer & Vendor';
            color = 'info';
        } else if (isCustomer) {
            type = 'Customer';
            color = 'primary';
        } else if (isVendor) {
            type = 'Vendor';
            color = 'warning';
        }

        return type ? (
            <Badge color={color} className={`badge-soft-${color}`}>
                {type}
            </Badge>
        ) : null;
    };

    const getBalanceBadge = () => {
        const balance = parseFloat(contact?.openingBalance || 0);
        const balanceType = contact?.balanceType;
        
        if (balanceType === 'none' || balance === 0) {
            return <Badge color="secondary" className="badge-soft-secondary">$0.00</Badge>;
        }

        const isReceivable = balanceType === 'receivable';
        const color = isReceivable ? 'success' : 'danger';
        const symbol = isReceivable ? '+' : '-';

        return (
            <Badge color={color} className={`badge-soft-${color}`}>
                {symbol}${Math.abs(balance).toFixed(2)}
            </Badge>
        );
    };

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
            <ModalHeader toggle={toggle}>Contact Details</ModalHeader>
            <ModalBody>
                {contact && (
                    <div>
                        <Row className="mb-4">
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Name</h6>
                                    <h5>{contact.name}</h5>
                                </div>
                                <div className="mb-3">
                                    <h6 className="text-muted">GSTIN</h6>
                                    <p>{contact.gstin || 'N/A'}</p>
                                </div>
                                <div className="mb-3">
                                    <h6 className="text-muted">Contact Type</h6>
                                    <p>{getContactTypeBadge() || 'N/A'}</p>
                                </div>
                                <div className="mb-3">
                                    <h6 className="text-muted">Balance</h6>
                                    <p>{getBalanceBadge()}</p>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Contact Information</h6>
                                    <p>
                                        <strong>Mobile:</strong> {contact.mobile || 'N/A'}<br />
                                        <strong>Email:</strong> {contact.email || 'N/A'}<br />
                                        <strong>Due Days:</strong> {contact.dueDays ? `${contact.dueDays} days` : 'N/A'}
                                    </p>
                                </div>
                                <div className="mb-3">
                                    <h6 className="text-muted">Status</h6>
                                    <p>
                                        <Badge 
                                            color={contact.enablePortal ? 'success' : 'secondary'} 
                                            className={`badge-soft-${contact.enablePortal ? 'success' : 'secondary'}`}
                                        >
                                            {contact.enablePortal ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </p>
                                </div>
                            </Col>
                        </Row>

                        <Row>
                            <Col md={6}>
                                <div className="card mb-4">
                                    <div className="card-header bg-light">
                                        <h6 className="mb-0">Billing Address</h6>
                                    </div>
                                    <div className="card-body">
                                        <address>
                                            {contact.billingAddress1 || 'N/A'}<br />
                                            {contact.billingAddress2 && <>{contact.billingAddress2}<br /></>}
                                            {contact.billingCity}, {contact.billingState}<br />
                                            {contact.billingPincode}<br />
                                            {contact.billingCountry}
                                        </address>
                                    </div>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="card mb-4">
                                    <div className="card-header bg-light">
                                        <h6 className="mb-0">Shipping Address</h6>
                                    </div>
                                    <div className="card-body">
                                        {contact.isShippingSame ? (
                                            <p className="text-muted">Same as billing address</p>
                                        ) : (
                                            <address>
                                                {contact.shippingAddress1 || 'N/A'}<br />
                                                {contact.shippingAddress2 && <>{contact.shippingAddress2}<br /></>}
                                                {contact.shippingCity}, {contact.shippingState}<br />
                                                {contact.shippingPincode}<br />
                                                {contact.shippingCountry}
                                            </address>
                                        )}
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        <div className="mb-3">
                            <h6 className="text-muted">Notes</h6>
                            <p className="text-muted">{contact.notes || 'No notes available'}</p>
                        </div>

                        <hr />

                        <Row>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Created By</h6>
                                    <p>{contact.createdByName || 'System'}</p>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="mb-3">
                                    <h6 className="text-muted">Created At</h6>
                                    <p>{new Date(contact.createdAt).toLocaleString()}</p>
                                </div>
                            </Col>
                        </Row>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button color="secondary" onClick={toggle}>Close</Button>
            </ModalFooter>
        </Modal>
    );
};

export default ContactViewModal;
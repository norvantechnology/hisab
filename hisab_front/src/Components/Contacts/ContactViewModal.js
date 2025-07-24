import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Row, Col, Nav, NavItem, NavLink, TabContent, TabPane, Card, CardBody, Table, Spinner, Input, Form, FormGroup, Label, Alert } from 'reactstrap';
import { RiWalletLine, RiCheckLine, RiCloseLine } from 'react-icons/ri';
import classnames from 'classnames';
import ReactSelect from 'react-select';
import { getPendingTransactions } from '../../services/payment';
import { createPayment } from '../../services/payment';

const ContactViewModal = ({ isOpen, toggle, contact, bankAccounts = [], onPaymentSuccess }) => {
    const [activeTab, setActiveTab] = useState('1');
    const [pendingTransactions, setPendingTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [transactionsSummary, setTransactionsSummary] = useState(null);
    
    // Payment state
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [selectedTransactions, setSelectedTransactions] = useState([]);
    const [paymentAmounts, setPaymentAmounts] = useState({});
    const [selectedBankAccount, setSelectedBankAccount] = useState(null);
    const [paymentDescription, setPaymentDescription] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState('');

    const toggleTab = (tab) => {
        if (activeTab !== tab) setActiveTab(tab);
    };

    const fetchPendingTransactions = async () => {
        if (!contact?.id) return;
        
        setLoadingTransactions(true);
        try {
            const response = await getPendingTransactions(contact.id);
            setPendingTransactions(response.transactions || []);
            setTransactionsSummary(response.summary || null);
        } catch (error) {
            console.error('Error fetching pending transactions:', error);
            setPendingTransactions([]);
            setTransactionsSummary(null);
        } finally {
            setLoadingTransactions(false);
        }
    };

    useEffect(() => {
        if (isOpen && contact?.id && activeTab === '2') {
            fetchPendingTransactions();
        }
    }, [isOpen, contact?.id, activeTab]);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal is closed
            setActiveTab('1');
            setPendingTransactions([]);
            setTransactionsSummary(null);
            resetPaymentState();
        }
    }, [isOpen]);

    const resetPaymentState = () => {
        setShowPaymentForm(false);
        setSelectedTransactions([]);
        setPaymentAmounts({});
        setSelectedBankAccount(null);
        setPaymentDescription('');
        setPaymentError('');
        setPaymentSuccess('');
    };

    const toggleTransactionSelection = (transactionId) => {
        const updatedSelected = selectedTransactions.includes(transactionId)
            ? selectedTransactions.filter(id => id !== transactionId)
            : [...selectedTransactions, transactionId];
        
        setSelectedTransactions(updatedSelected);

        // Auto-set payment amount to pending amount when selecting
        if (!selectedTransactions.includes(transactionId)) {
            const transaction = pendingTransactions.find(t => t.id === transactionId);
            if (transaction) {
                setPaymentAmounts(prev => ({
                    ...prev,
                    [transactionId]: transaction.pendingAmount
                }));
            }
        } else {
            // Remove amount when deselecting
            setPaymentAmounts(prev => {
                const newAmounts = { ...prev };
                delete newAmounts[transactionId];
                return newAmounts;
            });
        }
    };

    const updatePaymentAmount = (transactionId, amount) => {
        const numAmount = parseFloat(amount) || 0;
        setPaymentAmounts(prev => ({
            ...prev,
            [transactionId]: numAmount
        }));
    };

    const calculateTotalPayment = () => {
        return Object.values(paymentAmounts).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0);
    };

    const handleStartPayment = () => {
        setShowPaymentForm(true);
        setPaymentError('');
        setPaymentSuccess('');
    };

    const handleCancelPayment = () => {
        resetPaymentState();
    };

    const handlePaymentSubmit = async () => {
        setPaymentError('');
        setPaymentSuccess('');
        
        // Validation
        if (selectedTransactions.length === 0) {
            setPaymentError('Please select at least one transaction to pay');
            return;
        }
        
        if (!selectedBankAccount) {
            setPaymentError('Please select a bank account');
            return;
        }

        const totalAmount = calculateTotalPayment();
        if (totalAmount <= 0) {
            setPaymentError('Payment amount must be greater than 0');
            return;
        }

        // Validate individual amounts
        for (const transactionId of selectedTransactions) {
            const amount = paymentAmounts[transactionId] || 0;
            const transaction = pendingTransactions.find(t => t.id === transactionId);
            if (amount > transaction.pendingAmount) {
                setPaymentError(`Payment amount for ${transaction.description} cannot exceed pending amount`);
                return;
            }
            if (amount <= 0) {
                setPaymentError(`Payment amount for ${transaction.description} must be greater than 0`);
                return;
            }
        }

        setIsSubmittingPayment(true);
        
        try {
            const transactionAllocations = selectedTransactions.map(transactionId => {
                const transaction = pendingTransactions.find(t => t.id === transactionId);
                return {
                    transactionId: transactionId,
                    transactionType: transaction?.type || 'purchase', // Add missing transactionType
                    amount: transaction.pendingAmount,
                    paidAmount: paymentAmounts[transactionId] || 0,
                    type: transaction.balanceType
                };
            });

            const paymentData = {
                contactId: contact.id,
                bankAccountId: selectedBankAccount.value,
                date: new Date().toISOString().split('T')[0],
                description: paymentDescription || `Payment for ${contact.name}`,
                adjustmentType: 'none',
                adjustmentValue: 0,
                transactionAllocations
            };

            await createPayment(paymentData);
            
            setPaymentSuccess('Payment created successfully!');
            
            // Refresh pending transactions and close modal to show updated data
            setTimeout(() => {
                fetchPendingTransactions();
                resetPaymentState();
                // Call the callback to refresh parent data (contact list)
                if (onPaymentSuccess && typeof onPaymentSuccess === 'function') {
                    onPaymentSuccess();
                }
                // Close modal so when reopened it shows fresh contact data
                toggle();
            }, 800);
            
        } catch (error) {
            console.error('Payment submission error:', error);
            setPaymentError(error?.response?.data?.message || 'Failed to create payment. Please try again.');
        } finally {
            setIsSubmittingPayment(false);
        }
    };

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
        // Use calculated balance if available, otherwise fall back to current balance
        const calculatedBalance = contact?.calculatedBalance;
        const balance = calculatedBalance ? 
            parseFloat(calculatedBalance.amount || 0) : 
            parseFloat(contact?.currentBalance || 0);
        const balanceType = calculatedBalance ? 
            calculatedBalance.type : 
            contact?.currentBalanceType;
        
        if (balanceType === 'none' || balance === 0) {
            return <Badge color="secondary" className="badge-soft-secondary">₹0.00</Badge>;
        }

        const isReceivable = balanceType === 'receivable';
        const color = isReceivable ? 'success' : 'danger';
        const symbol = isReceivable ? '+' : '-';

        return (
            <Badge color={color} className={`badge-soft-${color}`}>
                {symbol}₹{Math.abs(balance).toFixed(2)}
            </Badge>
        );
    };

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="xl">
            <ModalHeader toggle={toggle}>Contact Details</ModalHeader>
            <ModalBody>
                {contact && (
                    <div>
                        <Nav tabs>
                            <NavItem>
                                <NavLink
                                    className={classnames({ active: activeTab === '1' })}
                                    onClick={() => toggleTab('1')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    Contact Details
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink
                                    className={classnames({ active: activeTab === '2' })}
                                    onClick={() => toggleTab('2')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    Pending Transactions
                                </NavLink>
                            </NavItem>
                        </Nav>

                        <TabContent activeTab={activeTab}>
                            <TabPane tabId="1">
                                <div className="mt-3">
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
                                                <h6 className="text-muted">Current Balance</h6>
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
                                        <address>
                                            {contact.shippingAddress1 || 'N/A'}<br />
                                            {contact.shippingAddress2 && <>{contact.shippingAddress2}<br /></>}
                                            {contact.shippingCity}, {contact.shippingState}<br />
                                            {contact.shippingPincode}<br />
                                            {contact.shippingCountry}
                                        </address>
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
                            </TabPane>

                            <TabPane tabId="2">
                                <div className="mt-3">
                                    {/* Summary Card */}
                                    <Card className="mb-4">
                                        <CardBody>
                                            <Row>
                                                <Col md={6}>
                                                    <div className="text-center">
                                                        <h6 className="text-muted mb-2">Total Pending</h6>
                                                        <h4 className="mb-0 text-warning">
                                                            ₹{transactionsSummary?.totalPending?.toFixed(2) || '0.00'}
                                                        </h4>
                                                    </div>
                                                </Col>
                                                <Col md={6}>
                                                    <div className="text-center">
                                                        <h6 className="text-muted mb-2">Balance Status</h6>
                                                        <Badge 
                                                            color={transactionsSummary?.payableStatus === 'receivable' ? 'success' : 'danger'}
                                                            className={`badge-soft-${transactionsSummary?.payableStatus === 'receivable' ? 'success' : 'danger'}`}
                                                        >
                                                            {transactionsSummary?.payableStatus === 'receivable' ? 'They owe us' : 'We owe them'}
                                                        </Badge>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </CardBody>
                                    </Card>

                                    {/* Pending Purchases Table */}
                                    <Card>
                                        <div className="card-header d-flex justify-content-between align-items-center">
                                            <h6 className="mb-0">Pending Transactions</h6>
                                            {pendingTransactions.length > 0 && !showPaymentForm && (
                                                <Button 
                                                    color="primary" 
                                                    size="sm" 
                                                    onClick={handleStartPayment}
                                                    className="d-flex align-items-center"
                                                >
                                                    <RiWalletLine className="me-1" />
                                                    Make Payment
                                                </Button>
                                            )}
                                        </div>
                                        <CardBody>
                                            {/* Error and Success Messages */}
                                            {paymentError && (
                                                <Alert color="danger" className="mb-3">
                                                    {paymentError}
                                                </Alert>
                                            )}
                                            {paymentSuccess && (
                                                <Alert color="success" className="mb-3">
                                                    {paymentSuccess}
                                                </Alert>
                                            )}

                                            {/* Payment Form */}
                                            {showPaymentForm && (
                                                <Card className="mb-4 border-primary">
                                                    <div className="card-header bg-light">
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <h6 className="mb-0 text-primary">Payment Details</h6>
                                                            <Button 
                                                                color="light" 
                                                                size="sm" 
                                                                onClick={handleCancelPayment}
                                                                className="d-flex align-items-center"
                                                            >
                                                                <RiCloseLine className="me-1" />
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <CardBody>
                                                        <Row>
                                                            <Col md={6}>
                                                                <FormGroup>
                                                                    <Label>Bank Account <span className="text-danger">*</span></Label>
                                                                    <ReactSelect
                                                                        options={bankAccounts.map(account => ({
                                                                            value: account.id,
                                                                            label: account.accountName
                                                                        }))}
                                                                        value={selectedBankAccount}
                                                                        onChange={setSelectedBankAccount}
                                                                        placeholder="Select Bank Account"
                                                                        className="react-select-container"
                                                                        classNamePrefix="react-select"
                                                                    />
                                                                </FormGroup>
                                                            </Col>
                                                            <Col md={6}>
                                                                <FormGroup>
                                                                    <Label>Description</Label>
                                                                    <Input
                                                                        type="textarea"
                                                                        value={paymentDescription}
                                                                        onChange={(e) => setPaymentDescription(e.target.value)}
                                                                        placeholder="Payment description (optional)"
                                                                        rows="2"
                                                                    />
                                                                </FormGroup>
                                                            </Col>
                                                        </Row>
                                                        
                                                        {selectedTransactions.length > 0 && (
                                                            <div className="mt-3">
                                                                <div className="bg-light p-3 rounded">
                                                                    <h6 className="mb-2">Payment Summary</h6>
                                                                    <Row>
                                                                        <Col md={6}>
                                                                            <small className="text-muted">Selected Transactions:</small>
                                                                            <div className="fw-bold">{selectedTransactions.length}</div>
                                                                        </Col>
                                                                        <Col md={6}>
                                                                            <small className="text-muted">Total Payment Amount:</small>
                                                                            <div className="fw-bold text-primary">₹{calculateTotalPayment().toFixed(2)}</div>
                                                                        </Col>
                                                                    </Row>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardBody>
                                                </Card>
                                            )}

                                            {loadingTransactions ? (
                                                <div className="text-center py-4">
                                                    <Spinner size="sm" className="me-2" />
                                                    Loading pending transactions...
                                                </div>
                                            ) : pendingTransactions.length > 0 ? (
                                                <Table responsive>
                                                    <thead>
                                                        <tr>
                                                            {showPaymentForm && <th width="50px">Select</th>}
                                                            <th>Description</th>
                                                            <th>Date</th>
                                                            <th>Total Amount</th>
                                                            <th>Paid Amount</th>
                                                            <th>Pending Amount</th>
                                                            <th>Type</th>
                                                            {showPaymentForm && <th width="150px">Payment Amount</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pendingTransactions.map((transaction, index) => {
                                                            const isSelected = selectedTransactions.includes(transaction.id);
                                                            const paymentAmount = paymentAmounts[transaction.id] || 0;
                                                            const isOverPayment = paymentAmount > transaction.pendingAmount;
                                                            
                                                            return (
                                                                <tr key={transaction.id || index} className={showPaymentForm && isSelected ? 'table-active' : ''}>
                                                                    {showPaymentForm && (
                                                                        <td>
                                                                            <Input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={() => toggleTransactionSelection(transaction.id)}
                                                                            />
                                                                        </td>
                                                                    )}
                                                                    <td>
                                                                        <div>
                                                                            <strong>{transaction.description}</strong>
                                                                            {transaction.isCurrentBalance && (
                                                                                <Badge color="info" className="badge-soft-info ms-2">
                                                                                    Current Balance
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td>
                                                                        {transaction.date ? 
                                                                            new Date(transaction.date).toLocaleDateString() : 
                                                                            'N/A'
                                                                        }
                                                                    </td>
                                                                    <td>₹{transaction.amount?.toFixed(2) || '0.00'}</td>
                                                                    <td>₹{transaction.paidAmount?.toFixed(2) || '0.00'}</td>
                                                                    <td>
                                                                        <strong className="text-warning">
                                                                            ₹{transaction.pendingAmount?.toFixed(2) || '0.00'}
                                                                        </strong>
                                                                    </td>
                                                                    <td>
                                                                        <Badge 
                                                                            color={transaction.balanceType === 'receivable' ? 'success' : 'danger'}
                                                                            className={`badge-soft-${transaction.balanceType === 'receivable' ? 'success' : 'danger'}`}
                                                                        >
                                                                            {transaction.balanceType === 'receivable' ? 'Receivable' : 'Payable'}
                                                                        </Badge>
                                                                    </td>
                                                                    {showPaymentForm && (
                                                                        <td>
                                                                            {isSelected ? (
                                                                                <div>
                                                                                    <Input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        min="0"
                                                                                        max={transaction.pendingAmount}
                                                                                        value={paymentAmount || ''}
                                                                                        onChange={(e) => updatePaymentAmount(transaction.id, e.target.value)}
                                                                                        invalid={isOverPayment}
                                                                                        size="sm"
                                                                                    />
                                                                                    <small className="text-muted d-block">Max: ₹{transaction.pendingAmount?.toFixed(2)}</small>
                                                                                    {isOverPayment && (
                                                                                        <small className="text-danger d-block">Exceeds pending amount</small>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-muted">—</span>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </Table>
                                            ) : (
                                                <div className="text-center py-4 text-muted">
                                                    <i className="ri-file-list-3-line" style={{ fontSize: '2rem' }}></i>
                                                    <div className="mt-2">No pending transactions found</div>
                                                </div>
                                            )}
                                        </CardBody>
                                    </Card>
                                </div>
                            </TabPane>
                        </TabContent>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                {showPaymentForm ? (
                    <>
                        <Button color="secondary" onClick={handleCancelPayment} disabled={isSubmittingPayment}>
                            Cancel
                        </Button>
                        <Button 
                            color="primary" 
                            onClick={handlePaymentSubmit}
                            disabled={isSubmittingPayment || selectedTransactions.length === 0 || !selectedBankAccount}
                            className="d-flex align-items-center"
                        >
                            {isSubmittingPayment ? (
                                <>
                                    <Spinner size="sm" className="me-2" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <RiCheckLine className="me-1" />
                                    Submit Payment
                                </>
                            )}
                        </Button>
                    </>
                ) : (
                <Button color="secondary" onClick={toggle}>Close</Button>
                )}
            </ModalFooter>
        </Modal>
    );
};

export default ContactViewModal;
import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Badge, Row, Col, Nav, NavItem, NavLink, TabContent, TabPane, Card, CardBody, Table, Spinner, Input, Form, FormGroup, Label, Alert } from 'reactstrap';
import { RiWalletLine, RiCheckLine, RiCloseLine, RiUserLine, RiMapPinLine, RiFileTextLine, RiPhoneLine, RiMailLine } from 'react-icons/ri';
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
        let totalPayable = 0;
        let totalReceivable = 0;

        selectedTransactions.forEach(transactionId => {
            const transaction = pendingTransactions.find(t => t.id === transactionId);
            const paymentAmount = paymentAmounts[transactionId] || 0;
            
            if (transaction) {
                if (transaction.balanceType === 'payable') {
                    // We owe them money (payable) - this increases what we pay
                    totalPayable += paymentAmount;
                } else if (transaction.balanceType === 'receivable') {
                    // They owe us money (receivable) - this reduces what they owe us
                    totalReceivable += paymentAmount;
                }
            }
        });

        return {
            totalPayable,
            totalReceivable,
            netAmount: totalPayable - totalReceivable,
            type: totalPayable > totalReceivable ? 'payable' : 'receivable'
        };
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
        if (totalAmount.netAmount === 0) {
            setPaymentError('Please adjust payment amounts - net payment cannot be zero');
            return;
        }

        // Check if any payment amounts are entered
        const hasPaymentAmounts = selectedTransactions.some(transactionId => {
            const amount = paymentAmounts[transactionId] || 0;
            return amount > 0;
        });

        if (!hasPaymentAmounts) {
            setPaymentError('Please enter payment amounts for selected transactions');
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
        <Modal isOpen={isOpen} toggle={toggle} size="lg" className="contact-view-modal">
            <ModalHeader toggle={toggle} className="pb-2">
                <div className="d-flex align-items-center">
                    <div className="rounded bg-primary-subtle d-flex align-items-center justify-content-center me-2" style={{width: '1.75rem', height: '1.75rem'}}>
                        <RiUserLine className="text-primary" size={16} />
                    </div>
                    <div>
                        <h5 className="modal-title mb-0">Contact Details</h5>
                        <p className="text-muted mb-0 small">Complete contact information and transactions</p>
                    </div>
                </div>
            </ModalHeader>
            <ModalBody className="py-3">
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
                                    {/* Compact Contact Header */}
                                    <div className="bg-light rounded p-3 mb-3 border">
                                        <Row className="align-items-center">
                                            <Col md={6}>
                                                <h4 className="mb-2 fw-semibold">{contact.name}</h4>
                                                <div className="d-flex flex-wrap gap-1">
                                                    <Badge color="light" className="border px-2 py-1 small">
                                                        {contact?.isCustomer && contact?.isVendor ? 'Customer & Vendor' :
                                                         contact?.isCustomer ? 'Customer' :
                                                         contact?.isVendor ? 'Vendor' : 'Contact'}
                                                    </Badge>
                                                    {contact.gstin && (
                                                        <Badge color="light" className="border px-2 py-1 small">
                                                            GSTIN: {contact.gstin}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </Col>
                                            <Col md={6}>
                                                <div className="text-end">
                                                    <div className="text-muted small mb-1">Current Balance</div>
                                                    <div className="h4 mb-0">
                                                        {getBalanceBadge()}
                                                    </div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </div>

                                    {/* Contact Information Card */}
                                    <Card className="border shadow-sm mb-3">
                                        <CardBody>
                                            <h6 className="text-muted mb-3 text-uppercase fw-semibold" style={{fontSize: '0.8rem', letterSpacing: '0.5px'}}>
                                                <RiPhoneLine className="me-1" size={14} />
                                                Contact Information
                                            </h6>
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Mobile:</span>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>{contact.mobile || 'N/A'}</span>
                                                </div>
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Email:</span>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>{contact.email || 'N/A'}</span>
                                                </div>
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Due Days:</span>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>{contact.dueDays ? `${contact.dueDays} days` : 'N/A'}</span>
                                                </div>
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--vz-border-color)'}}>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Created:</span>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>
                                                        {new Date(contact.createdAt).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0'}}>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-secondary-color)', fontWeight: '500', margin: '0'}}>Created By:</span>
                                                    <span style={{fontSize: '0.875rem', color: 'var(--vz-body-color)', fontWeight: '500', textAlign: 'right'}}>{contact.createdByName || 'System'}</span>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>

                                    {/* Addresses Card */}
                                    <Card className="border shadow-sm mb-3">
                                        <CardBody>
                                            <h6 className="text-muted mb-3 text-uppercase fw-semibold" style={{fontSize: '0.8rem', letterSpacing: '0.5px'}}>
                                                <RiMapPinLine className="me-1" size={14} />
                                                Addresses
                                            </h6>
                                            <Row className="g-2">
                                                <Col md={6}>
                                                    <div className="border rounded p-3 bg-light h-100">
                                                        <h6 className="text-muted mb-2 text-uppercase fw-semibold" style={{fontSize: '0.8rem', letterSpacing: '0.5px'}}>Billing Address</h6>
                                                        <address className="mb-0 small text-muted">
                                                            {contact.billingAddress1 || 'N/A'}<br />
                                                            {contact.billingAddress2 && <>{contact.billingAddress2}<br /></>}
                                                            {contact.billingCity && contact.billingState && (
                                                                <>{contact.billingCity}, {contact.billingState}<br /></>
                                                            )}
                                                            {contact.billingPincode && <>{contact.billingPincode}<br /></>}
                                                            {contact.billingCountry}
                                                        </address>
                                                    </div>
                                                </Col>
                                                <Col md={6}>
                                                    <div className="border rounded p-3 bg-light h-100">
                                                        <h6 className="text-muted mb-2 text-uppercase fw-semibold" style={{fontSize: '0.8rem', letterSpacing: '0.5px'}}>Shipping Address</h6>
                                                        <address className="mb-0 small text-muted">
                                                            {contact.shippingAddress1 || 'N/A'}<br />
                                                            {contact.shippingAddress2 && <>{contact.shippingAddress2}<br /></>}
                                                            {contact.shippingCity && contact.shippingState && (
                                                                <>{contact.shippingCity}, {contact.shippingState}<br /></>
                                                            )}
                                                            {contact.shippingPincode && <>{contact.shippingPincode}<br /></>}
                                                            {contact.shippingCountry}
                                                        </address>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </CardBody>
                                    </Card>

                                    {/* Notes Section - Only show if notes exist */}
                                    {contact.notes && (
                                        <Card className="border shadow-sm">
                                            <CardBody>
                                                <h6 className="text-muted mb-3 text-uppercase fw-semibold" style={{fontSize: '0.8rem', letterSpacing: '0.5px'}}>
                                                    <RiFileTextLine className="me-1" size={14} />
                                                    Notes
                                                </h6>
                                                <div className="bg-light rounded p-3 border-start border-primary border-3">
                                                    <p className="mb-0 small">{contact.notes}</p>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    )}
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
                                                        <h6 className="text-muted mb-2">Net Balance</h6>
                                                        <h4 className="mb-0 text-warning">
                                                            ₹{transactionsSummary?.totalPending?.toFixed(2) || '0.00'}
                                                        </h4>
                                                        <small className="text-muted">Including current balance & pending transactions</small>
                                                    </div>
                                                </Col>
                                                <Col md={6}>
                                                    <div className="text-center">
                                                        <h6 className="text-muted mb-2">Balance Status</h6>
                                                        <Badge 
                                                            color={transactionsSummary?.payableStatus === 'receivable' ? 'success' : 'warning'}
                                                            className={`badge-soft-${transactionsSummary?.payableStatus === 'receivable' ? 'success' : 'warning'}`}
                                                        >
                                                            {transactionsSummary?.payableStatus === 'receivable' ? 'Receivable' : 'Payable'}
                                                        </Badge>
                                                    </div>
                                                </Col>
                                            </Row>
                                        </CardBody>
                                    </Card>

                                    {/* Pending Purchases Table */}
                                    <Card>
                                        <div className="card-header d-flex justify-content-between align-items-center bg-light">
                                            <h6 className="mb-0">All Pending Transactions (Including Current Balance)</h6>
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
                                                                    <h6 className="mb-3">Payment Summary</h6>
                                                                    <Row>
                                                                        <Col md={6}>
                                                                            <div className="text-center">
                                                                                <small className="text-muted d-block">Selected Transactions</small>
                                                                                <div className="fw-bold fs-5">{selectedTransactions.length}</div>
                                                                            </div>
                                                                        </Col>
                                                                        <Col md={6}>
                                                                            <div className="text-center">
                                                                                <small className="text-muted d-block">Net Payment</small>
                                                                                <div className={`fw-bold fs-5 ${calculateTotalPayment().type === 'payable' ? 'text-danger' : 'text-success'}`}>
                                                                                    ₹{Math.abs(calculateTotalPayment().netAmount).toFixed(2)}
                                                                                </div>
                                                                                <Badge 
                                                                                    color={calculateTotalPayment().type === 'payable' ? 'warning' : 'success'}
                                                                                    className="mt-1"
                                                                                >
                                                                                    {calculateTotalPayment().type === 'payable' ? 'Payable' : 'Receivable'}
                                                                                </Badge>
                                                                            </div>
                                                                        </Col>
                                                                    </Row>
                                                                    <div className="text-center mt-2">
                                                                        <small className="text-muted">
                                                                            {calculateTotalPayment().type === 'payable' 
                                                                                ? 'Amount to be paid for selected transactions'
                                                                                : 'Amount to be received from selected transactions'
                                                                            }
                                                                        </small>
                                                                    </div>
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
                                                                            color={transaction.balanceType === 'receivable' ? 'success' : 'warning'}
                                                                            className={`badge-soft-${transaction.balanceType === 'receivable' ? 'success' : 'warning'}`}
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
                                                    <RiFileTextLine size={32} className="mb-2" />
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
            <ModalFooter className="py-2">
                {showPaymentForm ? (
                    <>
                        <Button color="light" onClick={handleCancelPayment} disabled={isSubmittingPayment} className="px-3">
                            Cancel
                        </Button>
                        <Button 
                            color="primary" 
                            onClick={handlePaymentSubmit}
                            disabled={isSubmittingPayment || selectedTransactions.length === 0 || !selectedBankAccount}
                            className="px-3"
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
                    <Button color="light" onClick={toggle} className="px-3">Close</Button>
                )}
            </ModalFooter>


        </Modal>
    );
};

export default ContactViewModal;
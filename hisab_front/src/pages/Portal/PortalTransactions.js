import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, Table, Badge, Input, Button, Row, Col, Pagination, PaginationItem, PaginationLink, InputGroup, InputGroupText } from 'reactstrap';
import { toast } from 'react-toastify';
import { getContactTransactions } from '../../services/portal';
import Loader from '../../Components/Common/Loader';

const PortalTransactions = ({ contactData, type = 'all', tabKey }) => {
    const [state, setState] = useState({
        transactions: [],
        loading: true,
        searchTerm: '',
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
        debouncedSearchTerm: '',
        selectedType: 'all',
        selectedStatus: 'all',
        balanceInfo: null
    });

    const { transactions, loading, searchTerm, currentPage, totalPages, totalRecords, debouncedSearchTerm, selectedType, selectedStatus, balanceInfo } = state;

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
            setState(prev => ({ ...prev, debouncedSearchTerm: searchTerm }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch fresh data on mount or when tabKey changes
  useEffect(() => {
    if (contactData?.id) {
      fetchTransactions();
    }
  }, [contactData?.id, tabKey]);

  // Reset page when type changes
  useEffect(() => {
        setState(prev => ({ ...prev, currentPage: 1, searchTerm: '' }));
  }, [type]);

  // Fetch transactions when search or page changes
  useEffect(() => {
    if (contactData?.id && debouncedSearchTerm !== undefined) {
      fetchTransactions();
    }
    }, [contactData?.id, selectedType, selectedStatus, currentPage, debouncedSearchTerm]);

    const fetchTransactions = async () => {
    if (!contactData?.id) return;

        setState(prev => ({ ...prev, loading: true }));
    try {
      const params = {
        page: currentPage,
        limit: 10,
                search: debouncedSearchTerm,
                type: selectedType === 'all' ? 'all' : selectedType,
                status: selectedStatus === 'all' ? 'all' : selectedStatus
      };

      const response = await getContactTransactions(contactData.id, params);
      
      if (response.success) {
                setState(prev => ({
                    ...prev,
                    transactions: response.transactions || [],
                    totalPages: response.pagination?.totalPages || 1,
                    totalRecords: response.pagination?.total || 0,
                    balanceInfo: response.balanceInfo || null,
                    loading: false
                }));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions. Please try again.');
            setState(prev => ({ ...prev, loading: false }));
        }
    };

    const getTransactionTypeInfo = (transaction) => {
        const typeConfig = {
            'sale': {
                icon: 'ri-shopping-cart-line',
                color: 'success',
                text: 'Sale Invoice',
                description: `Sale Invoice ${transaction.invoiceNumber}`,
                amountType: 'credit'
            },
            'purchase': {
                icon: 'ri-store-line',
                color: 'warning',
                text: 'Purchase Invoice',
                description: `Purchase Invoice ${transaction.invoiceNumber}`,
                amountType: 'debit'
            },
            'income': {
                icon: 'ri-money-dollar-circle-line',
                color: 'info',
                text: 'Income',
                description: transaction.description || 'Income Transaction',
                amountType: 'credit'
            },
            'expense': {
                icon: 'ri-bank-card-line',
                color: 'danger',
                text: 'Expense',
                description: transaction.description || 'Expense Transaction',
                amountType: 'debit'
            }
        };
        
        return typeConfig[transaction.type] || {
            icon: 'ri-file-list-line',
            color: 'secondary',
            text: 'Transaction',
            description: 'Transaction',
            amountType: 'debit'
        };
    };

    const getStatusBadge = (transaction) => {
        const status = transaction.status?.toLowerCase();
    const statusConfig = {
      'paid': { color: 'success', text: 'Paid' },
            'pending': { color: 'warning', text: 'Pending' }
        };
        
        const config = statusConfig[status] || { color: 'secondary', text: status || 'N/A' };
        return <Badge color={config.color} className="badge-soft-success">{config.text}</Badge>;
    };

    const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const handlePageChange = (page) => {
        setState(prev => ({ ...prev, currentPage: page }));
    };

    const handleSearch = (e) => {
        setState(prev => ({ ...prev, searchTerm: e.target.value, currentPage: 1 }));
    };

    const handleTypeFilter = (e) => {
        const newType = e.target.value;
        setState(prev => ({ 
            ...prev, 
            selectedType: newType, 
            currentPage: 1,
            searchTerm: ''
        }));
    };

    const handleStatusFilter = (e) => {
        const newStatus = e.target.value;
        setState(prev => ({ 
            ...prev, 
            selectedStatus: newStatus, 
            currentPage: 1
        }));
    };

    const handleRefresh = () => {
        setState(prev => ({ 
            ...prev, 
            searchTerm: '', 
            currentPage: 1, 
            selectedType: 'all',
            selectedStatus: 'all'
        }));
    fetchTransactions();
    };

  if (loading) {
        return <Loader />;
    }

    return (
        <Card className="shadow-sm">
            <CardBody>
                {/* Balance Information Header */}
                {balanceInfo && (
                    <div className="mb-4 p-3 bg-light rounded">
                        <Row>
                            <Col md={6}>
                                <div className="d-flex align-items-center">
                                    <div className="avatar-sm me-3">
                                        <div className="avatar-title bg-primary text-white rounded-circle">
                                            <i className="ri-bank-line"></i>
                                        </div>
                                    </div>
                                    <div>
                                        <h6 className="mb-1 text-dark">Current Opening Balance</h6>
                                        <span className={`fw-bold fs-5 ${balanceInfo.currentBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                                            {balanceInfo.currentBalance >= 0 ? '+' : ''}{formatCurrency(balanceInfo.currentBalance)}
                                        </span>
                                        <small className="text-muted d-block">
                                            {balanceInfo.currentBalanceType === 'receivable' ? 'You are owed' : 'You owe'}
                                        </small>
                                    </div>
                                </div>
                            </Col>
                            <Col md={6}>
                                <div className="d-flex align-items-center">
                                    <div className="avatar-sm me-3">
                                        <div className="avatar-title bg-info text-white rounded-circle">
                                            <i className="ri-calendar-line"></i>
                                        </div>
                                    </div>
                                    <div>
                                        <h6 className="mb-1 text-dark">Opening Balance</h6>
                                        <span className="fw-bold fs-5 text-muted">
                                            {formatCurrency(balanceInfo.openingBalance)}
                                        </span>
                                        <small className="text-muted d-block">
                                            {balanceInfo.openingBalanceType === 'payable' ? 'You owed' : 'You were owed'}
                                        </small>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                )}

                <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="flex-grow-1">
                        <h4 className="card-title mb-1 text-dark">Transaction History</h4>
                        <p className="text-muted mb-0">
                            Showing {totalRecords} transactions
                            {searchTerm && ` for "${searchTerm}"`}
                            {selectedType !== 'all' && ` of type "${selectedType}"`}
                            {selectedStatus !== 'all' && ` with status "${selectedStatus}"`}
                        </p>
                    </div>
                    <div className="flex-shrink-0">
                        <div className="d-flex gap-2">
                            <Button 
                                color="secondary" 
                                outline 
                                onClick={handleRefresh}
                                disabled={loading}
                                className="btn-sm"
                            >
                                <i className="ri-refresh-line me-1"></i>
                                Refresh
                            </Button>
                            <Button 
                                color="primary" 
                                outline
                                className="btn-sm"
                            >
                                <i className="ri-download-2-line me-1"></i>
                                Export
                            </Button>
                        </div>
                    </div>
      </div>

                {/* Search and Filter */}
                <Row className="mb-4">
                    <Col md={4}>
                        <InputGroup size="sm">
                            <InputGroupText className="bg-light">
                                <i className="ri-search-line text-muted"></i>
                            </InputGroupText>
                <Input
                  type="text"
                                placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={handleSearch}
                                className="border-light"
                            />
                        </InputGroup>
                    </Col>
                    <Col md={3}>
                        <Input 
                            type="select" 
                            className="form-select form-select-sm border-light"
                            value={selectedType}
                            onChange={handleTypeFilter}
                        >
                            <option value="all">All Types</option>
                            <option value="sales">Sales</option>
                            <option value="purchases">Purchases</option>
                            <option value="incomes">Incomes</option>
                            <option value="expenses">Expenses</option>
                        </Input>
                    </Col>
                    <Col md={3}>
                        <Input 
                            type="select" 
                            className="form-select form-select-sm border-light"
                            value={selectedStatus}
                            onChange={handleStatusFilter}
                        >
                            <option value="all">All Status</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                        </Input>
            </Col>
                    <Col md={2}>
              <Button
                            color="info" 
                            outline 
                onClick={handleRefresh}
                            className="w-100 btn-sm"
              >
                            <i className="ri-filter-3-line me-1"></i>
                            Filter
              </Button>
            </Col>
          </Row>

      {/* Transactions Table */}
          {transactions.length > 0 ? (
                    <div className="table-responsive">
                        <Table className="table table-centered table-nowrap mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th className="text-dark fw-semibold">Transaction</th>
                                    <th className="text-dark fw-semibold">Date</th>
                                    <th className="text-dark fw-semibold">Type</th>
                                    <th className="text-dark fw-semibold">Invoice/Ref</th>
                                    <th className="text-dark fw-semibold">Total Amount</th>
                                    <th className="text-dark fw-semibold">Pending Amount</th>
                                    <th className="text-dark fw-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                                {transactions.map((transaction, index) => {
                                    const typeInfo = getTransactionTypeInfo(transaction);
                                    return (
                                        <tr key={index} className="align-middle">
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    <div className="avatar-sm me-3">
                                                        <div className={`avatar-title bg-${typeInfo.color}-subtle text-${typeInfo.color} rounded-circle`}>
                                                            <i className={typeInfo.icon}></i>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h6 className="mb-0 text-dark fw-medium">{typeInfo.description}</h6>
                                                        <small className="text-muted">{typeInfo.text}</small>
                                                    </div>
                                                </div>
                      </td>
                                            <td>
                                                <span className="fw-medium text-dark">{formatDate(transaction.date)}</span>
                      </td>
                                            <td>
                                                <Badge color={typeInfo.color} className="badge-soft-success">
                                                    {typeInfo.text}
                                                </Badge>
                      </td>
                                            <td>
                                                <span className="fw-medium text-dark">{transaction.invoiceNumber || 'N/A'}</span>
                      </td>
                                            <td>
                                                <span className={`fw-medium ${typeInfo.amountType === 'credit' ? 'text-success' : 'text-danger'}`}>
                                                    {typeInfo.amountType === 'credit' ? '+' : '-'} {formatCurrency(Math.abs(transaction.total_amount || 0))}
                                                </span>
                      </td>
                                            <td>
                                                <span className={`fw-medium ${parseFloat(transaction.pending_amount || 0) > 0 ? 'text-warning' : 'text-success'}`}>
                                                    {formatCurrency(Math.abs(transaction.pending_amount || 0))}
                                                </span>
                      </td>
                                            <td>
                                                {getStatusBadge(transaction)}
                      </td>
                    </tr>
                                    );
                                })}
                </tbody>
              </Table>
            </div>
          ) : (
                    <div className="text-center py-5">
                        <div className="avatar-md mx-auto mb-3">
                            <div className="avatar-title bg-light text-muted rounded-circle">
                                <i className="ri-file-list-line"></i>
                            </div>
                        </div>
                        <h5 className="text-dark">No Transactions Found</h5>
                        <p className="text-muted">
                            {searchTerm 
                                ? `No transactions found for "${searchTerm}". Try a different search term.`
                                : selectedType !== 'all'
                                ? `No ${selectedType} transactions found.`
                                : selectedStatus !== 'all'
                                ? `No transactions with status "${selectedStatus}" found.`
                                : 'You don\'t have any transactions to display.'
                            }
                        </p>
                        {(searchTerm || selectedType !== 'all' || selectedStatus !== 'all') && (
                            <Button 
                                color="primary" 
                                outline 
                                onClick={() => setState(prev => ({ 
                                    ...prev, 
                                    searchTerm: '', 
                                    selectedType: 'all',
                                    selectedStatus: 'all'
                                }))}
                                className="btn-sm"
                            >
                                Clear Filters
                            </Button>
                        )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-4">
                        <div className="text-muted small">
                            Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalRecords)} of {totalRecords} entries
                        </div>
                        <Pagination className="pagination-sm">
                <PaginationItem disabled={currentPage === 1}>
                                <PaginationLink 
                                    previous 
                                    onClick={() => handlePageChange(currentPage - 1)}
                                />
                </PaginationItem>
                
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const page = i + 1;
                                return (
                  <PaginationItem key={page} active={page === currentPage}>
                    <PaginationLink onClick={() => handlePageChange(page)}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                                );
                            })}
                
                <PaginationItem disabled={currentPage === totalPages}>
                                <PaginationLink 
                                    next 
                                    onClick={() => handlePageChange(currentPage + 1)}
                                />
                </PaginationItem>
              </Pagination>
            </div>
          )}
        </CardBody>
      </Card>
  );
};

export default PortalTransactions; 
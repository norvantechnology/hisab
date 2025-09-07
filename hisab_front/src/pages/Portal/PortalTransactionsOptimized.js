import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardBody, CardTitle, Table, Badge, Input, Button, Row, Col, Pagination, PaginationItem, PaginationLink } from 'reactstrap';
import { 
  RiFileListLine, 
  RiSearchLine, 
  RiFilterLine, 
  RiRefreshLine, 
  RiBankLine, 
  RiTimeLine, 
  RiCheckLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiFundsLine,
  RiShoppingCartLine
} from 'react-icons/ri';
import { toast } from 'react-toastify';
import { getContactTransactions, getContactSummary, getContactFinancialSummary } from '../../services/portal';
import { useOptimizedApi, useSearchApi } from '../../Components/Hooks/useOptimizedApi';

const PortalTransactionsOptimized = ({ contactData, type = 'all' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Memoized API functions to prevent unnecessary re-renders
  const memoizedGetTransactions = useCallback(async (params) => {
    if (!contactData?.id) return { success: false };
    return await getContactTransactions(contactData.id, params);
  }, [contactData?.id]);

  const memoizedGetSummary = useCallback(async () => {
    if (!contactData?.id) return { success: false };
    return await getContactSummary(contactData.id);
  }, [contactData?.id]);

  const memoizedGetFinancialSummary = useCallback(async () => {
    if (!contactData?.id) return { success: false };
    return await getContactFinancialSummary(contactData.id);
  }, [contactData?.id]);

  // Optimized API calls with caching
  const {
    data: transactionsData,
    loading: transactionsLoading,
    error: transactionsError,
    refresh: refreshTransactions
  } = useOptimizedApi(
    () => memoizedGetTransactions({
      page: currentPage,
      limit: 10,
      type: type === 'payments' ? 'payments' : 'all',
      search: searchTerm
    }),
    [currentPage, type, searchTerm, contactData?.id],
    {
      debounceMs: 500
    }
  );

  const {
    data: summaryData,
    loading: summaryLoading,
    error: summaryError,
    refresh: refreshSummary
  } = useOptimizedApi(
    memoizedGetSummary,
    [contactData?.id],
    {
      debounceMs: 300
    }
  );

  const {
    data: financialSummaryData,
    loading: financialSummaryLoading,
    error: financialSummaryError,
    refresh: refreshFinancialSummary
  } = useOptimizedApi(
    memoizedGetFinancialSummary,
    [contactData?.id],
    {
      debounceMs: 300
    }
  );

  // Memoized data processing
  const transactions = useMemo(() => {
    if (!transactionsData?.success) return [];
    return transactionsData.transactions || [];
  }, [transactionsData]);

  const summary = useMemo(() => {
    if (!summaryData?.success) return null;
    return summaryData.summary;
  }, [summaryData]);

  const financialSummary = useMemo(() => {
    if (!financialSummaryData?.success) return null;
    return financialSummaryData;
  }, [financialSummaryData]);

  // Update pagination when transactions data changes
  useEffect(() => {
    if (transactionsData?.success) {
      setTotalPages(transactionsData.pagination?.totalPages || 1);
      setTotalRecords(transactionsData.pagination?.total || 0);
    }
  }, [transactionsData]);

  // Reset to first page when type changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm('');
  }, [type]);

  // Error handling
  useEffect(() => {
    if (transactionsError) {
      toast.error(transactionsError.message || 'Failed to load transactions');
    }
    if (summaryError) {
      console.error('Error fetching summary:', summaryError);
    }
    if (financialSummaryError) {
      console.error('Error fetching financial summary:', financialSummaryError);
    }
  }, [transactionsError, summaryError, financialSummaryError]);

  // Memoized utility functions
  const getStatusBadge = useCallback((status) => {
    const statusConfig = {
      'paid': { color: 'success', text: 'Paid' },
      'pending': { color: 'warning', text: 'Pending' },
      'overdue': { color: 'danger', text: 'Overdue' },
      'completed': { color: 'success', text: 'Completed' },
      'cancelled': { color: 'secondary', text: 'Cancelled' }
    };
    
    const config = statusConfig[status.toLowerCase()] || { color: 'secondary', text: status };
    return <Badge color={config.color}>{config.text}</Badge>;
  }, []);

  const getTypeBadge = useCallback((type) => {
    const typeConfig = {
      'sale': { color: 'success', text: 'Sale', icon: <RiArrowUpLine size={14} /> },
      'purchase': { color: 'warning', text: 'Purchase', icon: <RiArrowDownLine size={14} /> },
      'payment': { color: 'info', text: 'Payment', icon: <RiBankLine size={14} /> },
      'income': { color: 'success', text: 'Income', icon: <RiFundsLine size={14} /> },
      'expense': { color: 'danger', text: 'Expense', icon: <RiShoppingCartLine size={14} /> }
    };
    
    const config = typeConfig[type] || { color: 'secondary', text: type, icon: <RiFileListLine size={14} /> };
    return (
      <Badge color={config.color} className="d-flex align-items-center">
        <span className="me-1">{config.icon}</span>
        {config.text}
      </Badge>
    );
  }, []);

  const formatCurrency = useCallback((amount) => {
    const numericAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(numericAmount);
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  }, []);

  // Event handlers
  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handleRefresh = useCallback(() => {
    setSearchTerm('');
    setCurrentPage(1);
    refreshTransactions();
    refreshSummary();
    refreshFinancialSummary();
  }, [refreshTransactions, refreshSummary, refreshFinancialSummary]);

  // Memoized pagination component
  const renderPagination = useMemo(() => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <Pagination className="justify-content-center">
        <PaginationItem disabled={currentPage === 1}>
          <PaginationLink previous onClick={() => handlePageChange(currentPage - 1)} />
        </PaginationItem>
        
        {pages.map(page => (
          <PaginationItem key={page} active={page === currentPage}>
            <PaginationLink onClick={() => handlePageChange(page)}>
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        
        <PaginationItem disabled={currentPage === totalPages}>
          <PaginationLink next onClick={() => handlePageChange(currentPage + 1)} />
        </PaginationItem>
      </Pagination>
    );
  }, [currentPage, totalPages, handlePageChange]);

  // Memoized summary cards
  const summaryCards = useMemo(() => {
    if (!financialSummary || type !== 'all') return null;

    return (
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '15px' }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center">
                <div className="bg-success bg-opacity-10 rounded-circle p-2 me-3">
                  <RiCheckLine size={20} className="text-success" />
                </div>
                <div>
                  <small className="text-muted d-block">Total Paid</small>
                  <div className="fw-bold text-success">
                    {formatCurrency(financialSummary.totalPaidAmount || 0)}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '15px' }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center">
                <div className="bg-warning bg-opacity-10 rounded-circle p-2 me-3">
                  <RiTimeLine size={20} className="text-warning" />
                </div>
                <div>
                  <small className="text-muted d-block">Pending Amount</small>
                  <div className="fw-bold text-warning">
                    {formatCurrency(financialSummary.totalPendingAmount || 0)}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '15px' }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center">
                <div className="bg-danger bg-opacity-10 rounded-circle p-2 me-3">
                  <RiBankLine size={20} className="text-danger" />
                </div>
                <div>
                  <small className="text-muted d-block">You Owe</small>
                  <div className="fw-bold text-danger">
                    {formatCurrency(financialSummary.totalOwedAmount || 0)}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '15px' }}>
            <CardBody className="p-3">
              <div className="d-flex align-items-center">
                <div className="bg-info bg-opacity-10 rounded-circle p-2 me-3">
                  <RiFileListLine size={20} className="text-info" />
                </div>
                <div>
                  <small className="text-muted d-block">Total Transactions</small>
                  <div className="fw-bold text-info">
                    {financialSummary.totalTransactions || 0}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>
    );
  }, [financialSummary, type, formatCurrency]);

  // Memoized transaction rows
  const transactionRows = useMemo(() => {
    return transactions.map((transaction, index) => {
      const getPayableReceivable = (type) => {
        let result;
        switch(type) {
          case 'sale':
            result = { type: 'receivable', text: 'Receivable', color: 'success', bgColor: '#d4edda', textColor: '#155724' };
            break;
          case 'purchase':
            result = { type: 'payable', text: 'Payable', color: 'danger', bgColor: '#f8d7da', textColor: '#721c24' };
            break;
          case 'income':
            result = { type: 'payable', text: 'Payable', color: 'danger', bgColor: '#f8d7da', textColor: '#721c24' };
            break;
          case 'expense':
            result = { type: 'receivable', text: 'Receivable', color: 'success', bgColor: '#d4edda', textColor: '#155724' };
            break;
          case 'payment':
            result = { type: 'receivable', text: 'Receivable', color: 'success', bgColor: '#d4edda', textColor: '#155724' };
            break;
          default:
            result = { type: 'unknown', text: 'Unknown', color: 'secondary', bgColor: '#e2e3e5', textColor: '#383d41' };
            break;
        }
        return result;
      };
      
      const payableReceivable = getPayableReceivable(transaction.type);
      
      return (
        <tr key={`${transaction.type}-${transaction.id}-${index}`} style={{ borderBottom: '1px solid #f1f3f4' }}>
          <td className="py-3">
            <div className="fw-semibold">{formatDate(transaction.date)}</div>
          </td>
          <td className="py-3">
            {getTypeBadge(transaction.type)}
          </td>
          <td className="py-3">
            <span className="fw-bold text-primary">{transaction.invoiceNumber}</span>
          </td>
          <td className="py-3">
            <div className="text-muted">
              {transaction.type === 'sale' && 'Sales Invoice'}
              {transaction.type === 'purchase' && 'Purchase Invoice'}
              {transaction.type === 'payment' && `Payment via ${transaction.paymentType || 'N/A'}`}
              {transaction.type === 'income' && 'Income Transaction'}
              {transaction.type === 'expense' && 'Expense Transaction'}
            </div>
          </td>
          <td className="py-3">
            <span className="fw-bold text-primary fs-6">
              {formatCurrency(transaction.amount)}
            </span>
          </td>
          <td className="py-3">
            <span 
              className="badge"
              style={{ 
                backgroundColor: payableReceivable.bgColor, 
                color: payableReceivable.textColor,
                borderRadius: '20px',
                padding: '8px 16px',
                fontWeight: '600',
                border: 'none',
                fontSize: '12px',
                display: 'inline-block'
              }}
            >
              {payableReceivable.text}
            </span>
          </td>
          <td className="py-3">
            {getStatusBadge(transaction.status)}
          </td>
        </tr>
      );
    });
  }, [transactions, formatDate, getTypeBadge, formatCurrency, getStatusBadge]);

  return (
    <div className="portal-transactions">
      <div className="mb-4">
        <h2 className="mb-2 fw-bold" style={{ color: '#2c3e50' }}>
          {type === 'payments' ? 'Payment History' : 'Transaction History'}
        </h2>
        <p className="text-muted fs-6">
          View all your {type === 'payments' ? 'payments' : 'transactions'} and their current status
        </p>
      </div>

      {/* Quick Summary Cards */}
      {summaryCards}

      {/* Search and Filters */}
      <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '15px' }}>
        <CardBody className="p-4">
          <Row className="align-items-center">
            <Col md={8}>
              <form onSubmit={handleSearch} className="d-flex">
                <div className="position-relative flex-grow-1 me-3">
                  <RiSearchLine className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" />
                  <Input
                    type="text"
                    placeholder="Search by invoice number, amount, or status..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="ps-5"
                    style={{ borderRadius: '25px' }}
                  />
                </div>
                <Button type="submit" color="primary" style={{ borderRadius: '25px' }}>
                  <RiSearchLine />
                </Button>
              </form>
            </Col>
            <Col md={4} className="text-end">
              <Button 
                color="outline-secondary" 
                className="me-2"
                onClick={handleRefresh}
                style={{ borderRadius: '25px' }}
              >
                <RiRefreshLine className="me-1" />
                Refresh
              </Button>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {/* Transactions Table */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '15px' }}>
        <CardBody className="p-4">
          <div className="d-flex align-items-center justify-content-between mb-4">
            <div className="d-flex align-items-center">
              <RiFileListLine size={24} className="text-primary me-2" />
              <CardTitle tag="h5" className="mb-0 fw-bold">
                {type === 'payments' ? 'Payments' : 'Transactions'} ({totalRecords})
              </CardTitle>
            </div>
          </div>
          
          {transactionsLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted">Loading transactions...</p>
            </div>
          ) : transactions.length > 0 ? (
            <>
              <div className="table-responsive">
                <Table className="table-hover mb-0">
                  <thead>
                                            <tr style={{ backgroundColor: 'var(--vz-light-bg-subtle)' }}>
                      <th className="border-0 fw-semibold">Date</th>
                      <th className="border-0 fw-semibold">Type</th>
                      <th className="border-0 fw-semibold">Invoice/Ref</th>
                      <th className="border-0 fw-semibold">Description</th>
                      <th className="border-0 fw-semibold">Amount</th>
                      <th className="border-0 fw-semibold">Payable/Receivable</th>
                      <th className="border-0 fw-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionRows}
                  </tbody>
                </Table>
              </div>
              
              {totalPages > 1 && (
                <div className="mt-4">
                  {renderPagination}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-5">
              <RiFileListLine size={64} className="text-muted mb-3" />
              <h5 className="text-muted mb-2">No {type === 'payments' ? 'payments' : 'transactions'} found</h5>
              <p className="text-muted">
                {searchTerm ? 'Try adjusting your search criteria' : 'Your transaction history will appear here'}
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default PortalTransactionsOptimized; 
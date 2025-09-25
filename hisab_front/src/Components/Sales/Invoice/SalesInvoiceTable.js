import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine, RiFilePdfLine, RiWalletLine, RiShareLine, RiPrinterLine, RiDownload2Line } from 'react-icons/ri';
import TableContainer from '../../Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem, Button } from 'reactstrap';

// Add CSS for spinner animation
const spinnerStyle = `
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .btn-soft-primary {
    background-color: rgba(64, 81, 137, 0.1);
    border-color: rgba(64, 81, 137, 0.1);
    color: #405189;
  }
  .btn-soft-primary:hover {
    background-color: rgba(64, 81, 137, 0.2);
    border-color: rgba(64, 81, 137, 0.2);
    color: #405189;
  }
  .btn-soft-success {
    background-color: rgba(10, 179, 156, 0.1);
    border-color: rgba(10, 179, 156, 0.1);
    color: #0ab39c;
  }
  .btn-soft-success:hover {
    background-color: rgba(10, 179, 156, 0.2);
    border-color: rgba(10, 179, 156, 0.2);
    color: #0ab39c;
  }
  .btn-soft-info {
    background-color: rgba(13, 202, 240, 0.1);
    border-color: rgba(13, 202, 240, 0.1);
    color: #0dcaf0;
  }
  .btn-soft-info:hover {
    background-color: rgba(13, 202, 240, 0.2);
    border-color: rgba(13, 202, 240, 0.2);
    color: #0dcaf0;
  }
  .btn-soft-secondary {
    background-color: rgba(116, 120, 141, 0.1);
    border-color: rgba(116, 120, 141, 0.1);
    color: #74788d;
  }
  .btn-soft-secondary:hover {
    background-color: rgba(116, 120, 141, 0.2);
    border-color: rgba(116, 120, 141, 0.2);
    color: #74788d;
  }
`;

const SalesInvoiceTable = ({
    invoices,
    loading,
    pagination,
    onPageChange,
    onView,
    onEdit,                                                                                                                                                                 
    onDelete,
    onGeneratePDF,
    onCreatePayment,
    onPrint,
    pdfLoading = null,
    onShare,
    selectedItems = [],
    onSelectionChange
}) => {
    // Bulk selection handlers
    const isAllSelected = selectedItems.length === invoices.length && invoices.length > 0;
    const isPartiallySelected = selectedItems.length > 0 && selectedItems.length < invoices.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            onSelectionChange([]);
        } else {
            onSelectionChange(invoices.map(invoice => invoice.id));
        }
    };

    const handleSelectItem = (id) => {
        if (selectedItems.includes(id)) {
            onSelectionChange(selectedItems.filter(item => item !== id));
        } else {
            onSelectionChange([...selectedItems, id]);
        }
    };

    const columns = useMemo(() => [
        {
            header: ({ table }) => (
                <div className="d-flex align-items-center">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        checked={isAllSelected}
                        ref={(input) => {
                            if (input) input.indeterminate = isPartiallySelected;
                        }}
                        onChange={handleSelectAll}
                    />
                </div>
            ),
            accessorKey: "select",
            cell: (cell) => (
                <div className="d-flex align-items-center">
                    <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedItems.includes(cell.row.original.id)}
                        onChange={() => handleSelectItem(cell.row.original.id)}
                    />
                </div>
            ),
            enableColumnFilter: false,
            enableSorting: false,
            size: 50
        },
        {
            header: "Invoice",
            accessorKey: "invoiceNumber",
            cell: (cell) => (
                <div>
                    <h6 className="mb-0">#{cell.row.original.invoiceNumber}</h6>
                    <small className="text-muted">
                        {new Date(cell.row.original.invoiceDate).toLocaleDateString('en-GB')}
                    </small>
                </div>
            ),
            enableColumnFilter: false
        },
        {
            header: "Customer",
            accessorKey: "customer",
            cell: (cell) => {
                const hasContact = cell.row.original.contact;
                const hasBank = cell.row.original.bankAccount;
                
                return (
                    <div>
                        <h6 className="mb-0">
                            {/* Use contact.name from new schema structure */}
                            {cell.row.original.contact?.name || cell.row.original.bankAccount?.name || 'N/A'}
                        </h6>
                        {cell.row.original.contact?.gstin && (
                            <small className="text-muted">{cell.row.original.contact.gstin}</small>
                        )}
                        {/* Show payment bank info when both contact and bank are present */}
                        {hasContact && hasBank && (
                            <small className="text-info d-block">
                                <i className="ri-arrow-right-line me-1"></i>
                                Amount received in {cell.row.original.bankAccount.name}
                            </small>
                        )}
                        {/* Show bank-only info when only bank is present */}
                        {!hasContact && hasBank && (
                            <small className="text-info d-block">
                                <i className="ri-bank-line me-1"></i>
                                Direct Bank Sale
                            </small>
                        )}
                    </div>
                );
            },
            enableColumnFilter: false
        },
        {
            header: "Amount",
            accessorKey: "netReceivable",
            cell: (cell) => (
                <span className="fw-semibold">
                    ₹{parseFloat(cell.row.original.netReceivable || 0).toFixed(2)}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Pending Amount",
            accessorKey: "remainingAmount",
            cell: (cell) => {
                const remainingAmount = parseFloat(cell.row.original.remainingAmount || 0);
                const paidAmount = parseFloat(cell.row.original.paidAmount || 0);
                
                if (remainingAmount > 0) {
                    return (
                        <div>
                            <span className="fw-semibold text-warning">
                                ₹{remainingAmount.toFixed(2)}
                            </span>
                            {paidAmount > 0 && (
                                <small className="text-muted d-block">
                                    Paid: ₹{paidAmount.toFixed(2)}
                                </small>
                            )}
                        </div>
                    );
                } else {
                    return (
                        <span className="text-success fw-semibold">
                            ₹0.00
                        </span>
                    );
                }
            },
            enableColumnFilter: false
        },
        {
            header: "Tax",
            accessorKey: "taxAmount",
            cell: (cell) => (
                <span className="text-muted">
                    ₹{parseFloat(cell.row.original.taxAmount || 0).toFixed(2)}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Discount",
            accessorKey: "totalDiscount",
            cell: (cell) => {
                const discount = parseFloat(cell.row.original.totalDiscount || 0);
                if (discount > 0) {
                    return (
                        <span className="text-danger">
                            -₹{discount.toFixed(2)}
                        </span>
                    );
                }
                return <span className="text-muted">₹0.00</span>;
            },
            enableColumnFilter: false
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (cell) => {
                const status = cell.row.original.status || 'draft';
                    const statusConfig = {
        paid: { label: 'Paid', color: 'success', bgColor: 'bg-success' },
        pending: { label: 'Pending', color: 'warning', bgColor: 'bg-warning' },
                    draft: { label: 'Draft', color: 'secondary', bgColor: 'bg-secondary' },
                    cancelled: { label: 'Cancelled', color: 'danger', bgColor: 'bg-danger' }
                };
                const config = statusConfig[status] || statusConfig.draft;

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
                        {config.label}
                    </Badge>
                );
            },
            enableColumnFilter: false
        },
        {
            header: "Notes",
            accessorKey: "notes",
            cell: (cell) => (
                <div className="text-truncate" style={{ maxWidth: '150px' }} title={cell.row.original.internalNotes || ''}>
                    {cell.row.original.internalNotes || '—'}
                </div>
            ),
            enableColumnFilter: false
        },
        {
            header: "Action",
            accessorKey: "action",
            cell: (cell) => {
                const invoice = cell.row.original;
                const isPending = invoice.status === 'pending';
                const hasRemainingAmount = parseFloat(invoice.remainingAmount || 0) > 0;
                
                return (
                    <div className="d-flex align-items-center gap-1">
                        {/* 1. Print Invoice */}
                        <Button
                            color="outline-secondary"
                            size="sm"
                            onClick={() => onPrint && onPrint(invoice)}
                            title="Print Invoice"
                            className="btn-icon btn-soft-secondary"
                            style={{ width: '34px', height: '34px', borderRadius: '6px' }}
                        >
                            <RiPrinterLine size={15} />
                        </Button>
                        
                        {/* 2. Download PDF */}
                        <Button
                            color="outline-primary"
                            size="sm"
                            onClick={() => onGeneratePDF && onGeneratePDF(invoice)}
                            title="Download PDF"
                            disabled={pdfLoading === invoice.id}
                            className="btn-icon btn-soft-primary"
                            style={{ width: '34px', height: '34px', borderRadius: '6px' }}
                        >
                            {pdfLoading === invoice.id ? (
                                <i className="ri-loader-4-line spin" style={{ fontSize: '15px' }}></i>
                            ) : (
                                <RiDownload2Line size={15} />
                            )}
                        </Button>
                        
                        {/* 3. Payment Button - Only for pending invoices */}
                        {isPending && hasRemainingAmount && onCreatePayment && (
                            <Button
                                color="outline-success"
                                size="sm"
                                onClick={() => onCreatePayment(invoice)}
                                title={`Collect Payment (${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(invoice.remainingAmount)})`}
                                className="btn-icon btn-soft-success"
                                style={{ width: '34px', height: '34px', borderRadius: '6px' }}
                            >
                                <RiWalletLine size={15} />
                            </Button>
                        )}
                        <UncontrolledDropdown direction="start">
                            <DropdownToggle tag="button" className="btn btn-soft-secondary btn-sm">
                                <RiMoreFill />
                            </DropdownToggle>
                            <DropdownMenu className="dropdown-menu-end">
                                <DropdownItem onClick={() => onView(invoice)} className="py-2">
                                    <RiEyeLine className="me-2 align-middle text-muted" /> View
                                </DropdownItem>
                                <DropdownItem onClick={() => onEdit(invoice)} className="py-2">
                                    <RiPencilLine className="me-2 align-middle text-muted" /> Edit
                                </DropdownItem>
                                <DropdownItem onClick={() => onShare && onShare(invoice)} className="py-2">
                                    <RiShareLine className="me-2 align-middle text-muted" /> Share
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem onClick={() => onDelete(invoice)} className="py-2">
                                    <RiDeleteBinLine className="me-2 align-middle text-muted" /> Delete
                                </DropdownItem>
                            </DropdownMenu>
                        </UncontrolledDropdown>
                    </div>
                );
            },
            enableColumnFilter: false
        }
    ], [onView, onEdit, onDelete, onGeneratePDF, onCreatePayment, onPrint, pdfLoading, onShare, selectedItems, onSelectionChange, invoices, isAllSelected, isPartiallySelected]);

    return (
        <>
            <style>{spinnerStyle}</style>
            <Card className="shadow-sm">
                <CardBody className="p-3">
                <TableContainer
                    columns={columns}
                    data={invoices || []}
                    isGlobalFilter={false}
                    isAddOptions={false}
                    customPageSize={pagination.limit}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    pagination={pagination}
                    handlePageChange={onPageChange}
                    serverSide={true}
                    divClass="table-responsive sales-invoices-table"
                    loading={loading}
                    onRowDoubleClick={onView}
                />
            </CardBody>
        </Card>
        </>
    );
};

export default SalesInvoiceTable; 
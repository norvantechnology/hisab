import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine, RiFilePdfLine } from 'react-icons/ri';
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
    pdfLoading = null
}) => {
    const columns = useMemo(() => [
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
                const hasContact = cell.row.original.contactName || cell.row.original.contactId;
                const hasBank = cell.row.original.accountName || cell.row.original.bankAccountId;
                
                return (
                    <div>
                        <h6 className="mb-0">
                            {/* Always show contact name if available, otherwise show bank name */}
                            {cell.row.original.contactName || cell.row.original.accountName || 'N/A'}
                        </h6>
                        {cell.row.original.contactGstin && (
                            <small className="text-muted">{cell.row.original.contactGstin}</small>
                        )}
                        {/* Show payment bank info when both contact and bank are present */}
                        {hasContact && hasBank && (
                            <small className="text-info d-block">
                                <i className="ri-arrow-right-line me-1"></i>
                                Amount received in {cell.row.original.accountName}
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
            header: "Payment Method",
            accessorKey: "paymentMethod",
            cell: (cell) => {
                const hasContact = cell.row.original.contactName || cell.row.original.contactId;
                const hasBank = cell.row.original.accountName || cell.row.original.bankAccountId;
                
                                        if (hasContact && hasBank) {
                            return (
                                <div>
                                    <span className="badge bg-primary-subtle text-primary">
                                        <i className="ri-user-line me-1"></i>
                                        Contact
                                    </span>
                                    <br />
                                    <small className="text-muted">
                                        <i className="ri-arrow-right-line me-1"></i>
                                        via {cell.row.original.accountName}
                                    </small>
                                </div>
                            );
                        } else if (hasBank && !hasContact) {
                            return (
                                <div>
                                    <span className="badge bg-success-subtle text-success">
                                        <i className="ri-bank-line me-1"></i>
                                        Bank
                                    </span>
                                </div>
                            );
                        } else if (hasContact && !hasBank) {
                            return (
                                <div>
                                    <span className="badge bg-warning-subtle text-warning">
                                        <i className="ri-user-line me-1"></i>
                                        Contact
                                    </span>
                                </div>
                            );
                        } else {
                            return (
                                <div>
                                    <span className="badge bg-secondary-subtle text-secondary">
                                        <i className="ri-question-line me-1"></i>
                                        Unknown
                                    </span>
                                </div>
                            );
                        }
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
                    partial: { label: 'Partial', color: 'info', bgColor: 'bg-info' },
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
            header: "Action",
            accessorKey: "action",
            cell: (cell) => (
                <div className="d-flex align-items-center gap-2">
                    <Button
                        color="success"
                        size="sm"
                        onClick={() => onGeneratePDF && onGeneratePDF(cell.row.original)}
                        title="Generate Invoice PDF"
                        disabled={pdfLoading === cell.row.original.id}
                    >
                        {pdfLoading === cell.row.original.id ? (
                            <i className="ri-loader-4-line spin"></i>
                        ) : (
                            <RiFilePdfLine />
                        )}
                    </Button>
                    <UncontrolledDropdown direction="start">
                        <DropdownToggle tag="button" className="btn btn-soft-secondary btn-sm">
                            <RiMoreFill />
                        </DropdownToggle>
                        <DropdownMenu className="dropdown-menu-end">
                            <DropdownItem onClick={() => onView(cell.row.original)} className="py-2">
                                <RiEyeLine className="me-2 align-middle text-muted" /> View
                            </DropdownItem>
                            <DropdownItem onClick={() => onEdit(cell.row.original)} className="py-2">
                                <RiPencilLine className="me-2 align-middle text-muted" /> Edit
                            </DropdownItem>
                            <DropdownItem onClick={() => onDelete(cell.row.original)} className="py-2">
                                <RiDeleteBinLine className="me-2 align-middle text-muted" /> Delete
                            </DropdownItem>
                        </DropdownMenu>
                    </UncontrolledDropdown>
                </div>
            ),
            enableColumnFilter: false
        }
    ], [onView, onEdit, onDelete, onGeneratePDF, pdfLoading]);

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
                />
            </CardBody>
        </Card>
        </>
    );
};

export default SalesInvoiceTable; 
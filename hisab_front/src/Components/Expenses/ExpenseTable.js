import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine, RiBankLine, RiUser3Line, RiArrowRightLine } from 'react-icons/ri';
import TableContainer from '../../Components/Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const ExpenseTable = ({ expenses, loading, pagination, onPageChange, onView, onEdit, onDelete }) => {
    const columns = useMemo(() => [
        {
            header: "Date",
            accessorKey: "date",
            cell: (cell) => (
                <span className="text-nowrap">
                    {new Date(cell.row.original.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Category",
            accessorKey: "categoryName",
            cell: (cell) => (
                <Badge color="primary" className="badge-soft-primary">
                    {cell.row.original.categoryName || 'N/A'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Amount",
            accessorKey: "amount",
            cell: (cell) => (
                <span className={`fw-semibold ${parseFloat(cell.row.original.amount) >= 0 ? 'text-success' : 'text-danger'}`}>
                    ₹{parseFloat(cell.row.original.amount || 0).toFixed(2)}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Pending Amount",
            accessorKey: "remaining_amount",
            cell: (cell) => {
                const { remaining_amount, status, contactName } = cell.row.original;
                const pendingAmount = parseFloat(remaining_amount || 0);
                
                // Only show pending amount for contact payments with remaining amounts
                if (contactName && pendingAmount > 0) {
                    return (
                        <span className="fw-semibold text-warning">
                            ₹{pendingAmount.toFixed(2)}
                        </span>
                    );
                }
                
                return <span className="text-muted">—</span>;
            },
            enableColumnFilter: false
        },
        {
            header: "Payment Details",
            accessorKey: "paymentDetails",
            cell: (cell) => {
                const { bankAccountName, contactName, status } = cell.row.original;
                
                // Direct bank payment
                if (bankAccountName && !contactName) {
                    return (
                        <div className="d-flex align-items-center">
                            <RiBankLine className="text-info me-2" />
                            <span className="text-nowrap">{bankAccountName}</span>
                        </div>
                    );
                }
                
                // Contact payment - pending (no bank account)
                if (contactName && !bankAccountName) {
                    return (
                        <div className="d-flex align-items-center">
                            <RiUser3Line className="text-warning me-2" />
                            <span className="text-nowrap">{contactName}</span>
                        </div>
                    );
                }
                
                // Contact payment - paid (has both contact and bank account)
                if (contactName && bankAccountName) {
                    return (
                        <div className="d-flex flex-column" style={{ fontSize: '0.875rem' }}>
                            <div className="d-flex align-items-center mb-1">
                                <RiUser3Line className="text-warning me-1" size={14} />
                                <span className="text-nowrap">{contactName}</span>
                            </div>
                            <div className="d-flex align-items-center text-muted">
                                <RiArrowRightLine className="me-1" size={12} />
                                <RiBankLine className="text-info me-1" size={12} />
                                <span className="text-nowrap" style={{ fontSize: '0.8rem' }}>
                                    Paid via {bankAccountName}
                                </span>
                            </div>
                        </div>
                    );
                }
                
                return <span className="text-muted">N/A</span>;
            },
            enableColumnFilter: false
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (cell) => {
                const { status, bankAccountName, contactName, remaining_amount, paid_amount } = cell.row.original;
                const pendingAmount = parseFloat(remaining_amount || 0);
                const paidAmount = parseFloat(paid_amount || 0);
                
                // Direct bank payment - always paid
                if (bankAccountName && !contactName) {
                    return (
                        <Badge color="success" className="badge-soft-success">
                            Paid
                        </Badge>
                    );
                }
                
                // Contact payments - show status based on remaining amount
                if (contactName) {
                    if (pendingAmount > 0) {
                        return (
                            <Badge color="warning" className="badge-soft-warning">
                                Pending
                            </Badge>
                        );
                    } else {
                        return (
                            <Badge color="success" className="badge-soft-success">
                                Paid
                            </Badge>
                        );
                    }
                }
                
                return <span className="text-muted">—</span>;
            },
            enableColumnFilter: false
        },
        {
            header: "Due Date",
            accessorKey: "dueDate",
            cell: (cell) => {
                const { dueDate, contactName, status, remaining_amount } = cell.row.original;
                const pendingAmount = parseFloat(remaining_amount || 0);
                
                // Only show due date for pending contact payments
                if (contactName && pendingAmount > 0 && dueDate) {
                    const dueDateObj = new Date(dueDate);
                    const today = new Date();
                    const isOverdue = dueDateObj < today;
                    
                    return (
                        <span className={`text-nowrap ${isOverdue ? 'text-danger fw-semibold' : ''}`}>
                            {dueDateObj.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                            {isOverdue && (
                                <small className="d-block text-danger">
                                    (Overdue)
                                </small>
                            )}
                        </span>
                    );
                }
                
                return <span className="text-muted">—</span>;
            },
            enableColumnFilter: false
        },
        {
            header: "Type",
            accessorKey: "type",
            cell: (cell) => {
                const { bankAccountName, contactName, status } = cell.row.original;
                
                if (bankAccountName && !contactName) {
                    return (
                        <Badge color="info" className="badge-soft-info">
                            Direct
                        </Badge>
                    );
                }
                
                if (contactName) {
                    return (
                        <Badge color="secondary" className="badge-soft-secondary">
                            Contact
                        </Badge>
                    );
                }
                
                return <span className="text-muted">—</span>;
            },
            enableColumnFilter: false
        },
        { 
            header: "Notes", 
            accessorKey: "notes",
            cell: (cell) => (
                <div className="text-truncate" style={{ maxWidth: '120px' }}>
                    {cell.row.original.notes || '—'}
                </div>
            ),
            enableColumnFilter: false
        },
        {
            header: "Action",
            accessorKey: "action",
            cell: (cell) => (
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
            ),
            enableColumnFilter: false
        }
    ], [onView, onEdit, onDelete]);

    return (
        <Card className="shadow-sm">
            <CardBody className="p-3">
                <TableContainer
                    columns={columns}
                    data={expenses}
                    isGlobalFilter={false}
                    isAddOptions={false}
                    customPageSize={pagination.limit}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    pagination={pagination}
                    handlePageChange={onPageChange}
                    serverSide={true}
                    divClass="table-responsive expense-table"
                    onRowDoubleClick={onView}
                />
            </CardBody>
        </Card>
    );
};

export default ExpenseTable;
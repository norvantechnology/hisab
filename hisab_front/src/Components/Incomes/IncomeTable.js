import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine, RiBankLine, RiUser3Line, RiArrowRightLine } from 'react-icons/ri';
import TableContainer from '../Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const IncomeTable = ({ incomes, loading, pagination, onPageChange, onView, onEdit, onDelete }) => {
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
                <Badge color="success" className="badge-soft-success">
                    {cell.row.original.categoryName || 'N/A'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Amount",
            accessorKey: "amount",
            cell: (cell) => (
                <span className="fw-semibold text-success">
                    ₹{parseFloat(cell.row.original.amount || 0).toFixed(2)}
                </span>
            ),
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
                        <div className="d-flex align-items-center" style={{ fontSize: '0.875rem' }}>
                            <RiBankLine className="text-info me-2" size={14} />
                            <span className="text-nowrap">{bankAccountName}</span>
                        </div>
                    );
                }
                // Contact payment - pending (no bank account)
                else if (contactName && !bankAccountName) {
                    return (
                        <div className="d-flex align-items-center" style={{ fontSize: '0.875rem' }}>
                            <RiUser3Line className="text-warning me-2" size={14} />
                            <span className="text-nowrap">{contactName}</span>
                        </div>
                    );
                }
                // Contact payment - paid (has both contact and bank account)
                else if (contactName && bankAccountName) {
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
                                    Received via {bankAccountName}
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
            header: "Type",
            accessorKey: "type",
            cell: (cell) => {
                const { bankAccountName, contactName } = cell.row.original;
                const isDirect = bankAccountName && !contactName;
                return (
                    <Badge color={isDirect ? "info" : "warning"} className={`badge-soft-${isDirect ? "info" : "warning"}`}>
                        {isDirect ? "Direct" : "Contact"}
                    </Badge>
                );
            },
            enableColumnFilter: false
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: (cell) => {
                const { bankAccountName, contactName, status } = cell.row.original;
                
                // For direct bank payments, always show "Paid"
                if (bankAccountName && !contactName) {
                    return (
                        <Badge color="success" className="badge-soft-success">
                            Paid
                        </Badge>
                    );
                }
                
                // For contact payments, show actual status
                if (contactName) {
                    const badgeColor = status === 'paid' ? 'success' : 'warning';
                    return (
                        <Badge color={badgeColor} className={`badge-soft-${badgeColor}`}>
                            {status === 'paid' ? 'Paid' : 'Pending'}
                        </Badge>
                    );
                }
                
                return <span className="text-muted">N/A</span>;
            },
            enableColumnFilter: false
        },
        {
            header: "Due Date",
            accessorKey: "dueDate",
            cell: (cell) => {
                const { contactName, status, dueDate } = cell.row.original;
                
                // Only show due date for pending contact payments
                if (contactName && status === 'pending' && dueDate) {
                    const dueDateObj = new Date(dueDate);
                    const today = new Date();
                    const isOverdue = dueDateObj < today;
                    
                    return (
                        <span className={`text-nowrap ${isOverdue ? 'text-danger fw-medium' : ''}`}>
                            {dueDateObj.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                            {isOverdue && <small className="d-block">Overdue</small>}
                        </span>
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
                <div className="text-truncate" style={{ maxWidth: '150px' }}>
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
                    data={incomes}
                    isGlobalFilter={false}
                    isAddOptions={false}
                    customPageSize={pagination.limit}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    pagination={pagination}
                    handlePageChange={onPageChange}
                    serverSide={true}
                    divClass="table-responsive income-table"
                />
            </CardBody>
        </Card>
    );
};

export default IncomeTable;
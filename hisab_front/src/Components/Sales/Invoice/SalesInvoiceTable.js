import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine } from 'react-icons/ri';
import TableContainer from '../../Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const SalesInvoiceTable = ({
    invoices,
    loading,
    pagination,
    onPageChange,
    onView,
    onEdit,
    onDelete
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
            cell: (cell) => (
                <div>
                    <h6 className="mb-0">
                        {cell.row.original.accountName
                            || cell.row.original.contactName || 'N/A'}
                    </h6>
                    {cell.row.original.contactGstin && (
                        <small className="text-muted">{cell.row.original.contactGstin}</small>
                    )}
                </div>
            ),
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
                <UncontrolledDropdown direction="start">
                    <DropdownToggle tag="button" className="btn btn-soft-secondary btn-sm">
                        <RiMoreFill />
                    </DropdownToggle>
                    <DropdownMenu className="dropdown-menu-end">
                        <DropdownItem onClick={() => onView(cell.row.original)} className="py-2">
                            <RiEyeLine className="me-2 align-middle text-muted" /> View
                        </DropdownItem>
                        {(
                            <DropdownItem onClick={() => onEdit(cell.row.original)} className="py-2">
                                <RiPencilLine className="me-2 align-middle text-muted" /> Edit
                            </DropdownItem>
                        )}
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
    );
};

export default SalesInvoiceTable; 
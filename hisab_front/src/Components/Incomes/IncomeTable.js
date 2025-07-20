import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine } from 'react-icons/ri';
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
            header: "Account",
            accessorKey: "bankAccountName",
            cell: (cell) => (
                <span className="text-nowrap">
                    {cell.row.original.bankAccountName || 'N/A'}
                </span>
            ),
            enableColumnFilter: false
        },
        { 
            header: "Notes", 
            accessorKey: "notes",
            cell: (cell) => (
                <div className="text-truncate" style={{ maxWidth: '200px' }}>
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
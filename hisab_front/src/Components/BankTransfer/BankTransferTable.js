import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine } from 'react-icons/ri';
import TableContainer from '../Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const BankTransferTable = ({ 
  transfers, 
  loading, 
  pagination, 
  onPageChange, 
  onView, 
  onEdit, 
  onDelete 
}) => {
    const columns = useMemo(() => [
        {
            header: "Transfer #",
            accessorKey: "transferNumber",
            cell: (cell) => (
                <Badge color="info" className="badge-soft-info">
                    {cell.row.original.transferNumber || 'N/A'}
                </Badge>
            ),
            enableColumnFilter: false
        },
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
            header: "From Account",
            accessorKey: "fromBankName",
            cell: (cell) => (
                <Badge color="warning" className="badge-soft-warning">
                    {cell.row.original.fromBankName || 'N/A'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "To Account",
            accessorKey: "toBankName",
            cell: (cell) => (
                <Badge color="success" className="badge-soft-success">
                    {cell.row.original.toBankName || 'N/A'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Amount",
            accessorKey: "amount",
            cell: (cell) => (
                <span className="fw-semibold text-primary">
                    ₹{parseFloat(cell.row.original.amount || 0).toFixed(2)}
                </span>
            ),
            enableColumnFilter: false
        },
        { 
            header: "Description", 
            accessorKey: "description",
            cell: (cell) => (
                <div className="text-truncate" style={{ maxWidth: '200px' }}>
                    {cell.row.original.description || '—'}
                </div>
            ),
            enableColumnFilter: false
        },
        {
            header: "Reference",
            accessorKey: "referenceNumber",
            cell: (cell) => (
                <div className="text-truncate" style={{ maxWidth: '150px' }}>
                    {cell.row.original.referenceNumber || '—'}
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
                    data={transfers || []}
                    isGlobalFilter={false}
                    isAddOptions={false}
                    customPageSize={pagination.limit}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    pagination={pagination}
                    handlePageChange={onPageChange}
                    serverSide={true}
                    divClass="table-responsive bank-transfer-table"
                    loading={loading}
                />
            </CardBody>
        </Card>
    );
};

export default BankTransferTable;
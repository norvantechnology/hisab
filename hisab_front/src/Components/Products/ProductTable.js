import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine } from 'react-icons/ri';
import TableContainer from '../Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const ProductTable = ({ 
  products, 
  loading, 
  pagination, 
  onPageChange, 
  onView, 
  onEdit, 
  onDelete 
}) => {
    const columns = useMemo(() => [
        {
            header: "Product Name",
            accessorKey: "name",
            cell: (cell) => (
                <span className="fw-semibold">
                    {cell.row.original.name || 'N/A'}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Item Code",
            accessorKey: "itemCode",
            cell: (cell) => (
                <Badge color="info" className="badge-soft-info">
                    {cell.row.original.itemCode || 'N/A'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "HSN Code",
            accessorKey: "hsnCode",
            cell: (cell) => (
                <span>
                    {cell.row.original.hsnCode || '—'}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Rate",
            accessorKey: "rate",
            cell: (cell) => (
                <span className="fw-semibold text-primary">
                    ₹{parseFloat(cell.row.original.rate || 0).toFixed(2)}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Stock",
            accessorKey: "currentStock",
            cell: (cell) => (
                <span>
                    {parseFloat(cell.row.original.currentStock || 0).toFixed(2)} {cell.row.original.unitOfMeasurementName || ''}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Stock Category",
            accessorKey: "categoryName",
            cell: (cell) => (
                <Badge color="success" className="badge-soft-success">
                    {cell.row.original.categoryName || cell.row.original.stockCategoryName || '—'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Type",
            accessorKey: "itemType",
            cell: (cell) => (
                <Badge color={cell.row.original.itemType === 'product' ? 'primary' : 'secondary'} className={`badge-soft-${cell.row.original.itemType === 'product' ? 'primary' : 'secondary'}`}>
                    {cell.row.original.itemType ? cell.row.original.itemType.charAt(0).toUpperCase() + cell.row.original.itemType.slice(1) : '—'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Tax",
            accessorKey: "taxRate",
            cell: (cell) => (
                <span>
                    {cell.row.original.taxCategoryName} ({parseFloat(cell.row.original.taxRate || 0).toFixed(2)}%)
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Tracked",
            accessorKey: "isInventoryTracked",
            cell: (cell) => (
                <Badge color={cell.row.original.isInventoryTracked ? 'success' : 'secondary'} className={`badge-soft-${cell.row.original.isInventoryTracked ? 'success' : 'secondary'}`}>
                    {cell.row.original.isInventoryTracked ? 'Yes' : 'No'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Serialized",
            accessorKey: "isSerialized",
            cell: (cell) => (
                <Badge color={cell.row.original.isSerialized ? 'success' : 'secondary'} className={`badge-soft-${cell.row.original.isSerialized ? 'success' : 'secondary'}`}>
                    {cell.row.original.isSerialized ? 'Yes' : 'No'}
                </Badge>
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
                    data={products || []}
                    isGlobalFilter={false}
                    isAddOptions={false}
                    customPageSize={pagination.limit}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    pagination={pagination}
                    handlePageChange={onPageChange}
                    serverSide={true}
                    divClass="table-responsive product-table"
                    loading={loading}
                />
            </CardBody>
        </Card>
    );
};

export default ProductTable;
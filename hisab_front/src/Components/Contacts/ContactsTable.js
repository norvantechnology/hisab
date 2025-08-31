import React, { useMemo } from 'react';
import { Card, CardBody, Badge } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine } from 'react-icons/ri';
import TableContainer from '../Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const ContactsTable = ({ 
  contacts, 
  loading, 
  pagination, 
  onPageChange, 
  onView, 
  onEdit, 
  onDelete 
}) => {
    const columns = useMemo(() => [
        {
            header: "Name",
            accessorKey: "name",
            cell: (cell) => (
                <div>
                    <h6 className="mb-0">{cell.row.original.name}</h6>
                    <small className="text-muted">{cell.row.original.gstin}</small>
                </div>
            ),
            enableColumnFilter: false
        },
        {
            header: "Contact Info",
            accessorKey: "contactInfo",
            cell: (cell) => (
                <div>
                    <div className="text-nowrap">
                        <small className="text-muted">M: </small>
                        {cell.row.original.mobile || '—'}
                    </div>
                    <div className="text-truncate" style={{ maxWidth: '200px' }}>
                        <small className="text-muted">E: </small>
                        {cell.row.original.email || '—'}
                    </div>
                </div>
            ),
            enableColumnFilter: false
        },
        {
            header: "Type",
            accessorKey: "contactType",
            cell: (cell) => {
                const contactType = cell.row.original.contactType;
                const typeConfig = {
                    customer: { label: 'Customer', color: 'primary' },
                    vendor: { label: 'Vendor', color: 'info' }
                };
                const config = typeConfig[contactType] || { label: 'Unknown', color: 'secondary' };

                return (
                    <Badge color={config.color} className={`badge-soft-${config.color}`}>
                        {config.label}
                    </Badge>
                );
            },
            enableColumnFilter: false
        },
        {
            header: "City",
            accessorKey: "billingCity",
            cell: (cell) => (
                <span>{cell.row.original.billingCity || '—'}</span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Due Days",
            accessorKey: "dueDays",
            cell: (cell) => (
                <span className="text-nowrap">
                    {cell.row.original.dueDays ? `${cell.row.original.dueDays} days` : '—'}
                </span>
            ),
            enableColumnFilter: false
        },
        {
            header: "Current Balance",
            accessorKey: "calculatedBalance",
            cell: (cell) => {
                // Debug logging to see what data we're receiving
                console.log('=== CONTACT BALANCE DEBUG ===');
                console.log('Contact name:', cell.row.original.name);
                console.log('Full contact object:', cell.row.original);
                console.log('calculatedBalance:', cell.row.original.calculatedBalance);
                console.log('calculatedBalance.amount:', cell.row.original.calculatedBalance?.amount);
                console.log('calculatedBalance.type:', cell.row.original.calculatedBalance?.type);
                console.log('currentBalance:', cell.row.original.currentBalance);
                console.log('currentBalanceType:', cell.row.original.currentBalanceType);
                console.log('=== END DEBUG ===');
                
                // Use calculated balance if available, otherwise fall back to stored balance
                const calculatedBalance = cell.row.original.calculatedBalance;
                const balance = calculatedBalance ? 
                    parseFloat(calculatedBalance.amount || 0) : 
                    parseFloat(cell.row.original.currentBalance || 0);
                const balanceType = calculatedBalance ? 
                    calculatedBalance.type : 
                    cell.row.original.currentBalanceType;
                

                
                if (balanceType === 'none' || balance === 0) {
                    return <span className="text-muted">₹0.00</span>;
                }

                const isReceivable = balanceType === 'receivable';
                const color = isReceivable ? 'text-success' : 'text-danger';
                const symbol = isReceivable ? '+' : '-';

                return (
                    <span className={`fw-semibold ${color}`}>
                        {symbol}₹{Math.abs(balance).toFixed(2)}
                    </span>
                );
            },
            enableColumnFilter: false
        },
        {
            header: "Balance Type",
            accessorKey: "calculatedBalanceType",
            cell: (cell) => {
                // Use calculated balance type if available, otherwise fall back to stored type
                const calculatedBalance = cell.row.original.calculatedBalance;
                const balanceType = calculatedBalance ? 
                    calculatedBalance.type : 
                    cell.row.original.currentBalanceType;
                    
                const typeConfig = {
                    receivable: { label: 'Receivable', color: 'success' },
                    payable: { label: 'Payable', color: 'danger' },
                    none: { label: 'None', color: 'secondary' }
                };
                const config = typeConfig[balanceType] || typeConfig.none;

                return (
                    <Badge color={config.color} className={`badge-soft-${config.color}`}>
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
                <div className="text-truncate" style={{ maxWidth: '150px' }} title={cell.row.original.notes || ''}>
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
                    data={contacts || []}
                    isGlobalFilter={false}
                    isAddOptions={false}
                    customPageSize={pagination.limit}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    pagination={pagination}
                    handlePageChange={onPageChange}
                    serverSide={true}
                    divClass="table-responsive contacts-table"
                    loading={loading}
                    onRowDoubleClick={onView}
                />
            </CardBody>
        </Card>
    );
};

export default ContactsTable;
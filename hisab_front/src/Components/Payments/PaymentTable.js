import React, { useMemo, useState } from 'react';
import { Card, CardBody, Badge, Alert } from 'reactstrap';
import { RiMoreFill, RiEyeLine, RiPencilLine, RiDeleteBinLine, RiFilePdfLine } from 'react-icons/ri';
import TableContainer from '../Common/TableContainer';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import PaymentPDFButton from '../Common/PaymentPDFButton';

const PaymentTable = ({ 
  payments, 
  loading, 
  pagination, 
  onPageChange, 
  onView, 
  onEdit, 
  onDelete 
}) => {
    const [pdfAlert, setPdfAlert] = useState(null);

    const handlePDFSuccess = (response) => {
        const actionType = response.actionType || 'generated';
        const message = actionType === 'cached' 
            ? `PDF retrieved from cache! ${response.fileName}` 
            : `PDF generated successfully! ${response.fileName}`;
            
        setPdfAlert({
            type: 'success',
            message: message,
            icon: actionType === 'cached' ? 'ri-database-2-line' : 'ri-file-pdf-line'
        });
        
        // Auto hide alert after 4 seconds for cached, 3 seconds for generated
        const hideTimeout = actionType === 'cached' ? 4000 : 3000;
        setTimeout(() => setPdfAlert(null), hideTimeout);
    };

    const handlePDFError = (error) => {
        setPdfAlert({
            type: 'danger', 
            message: `PDF generation failed: ${error}`
        });
        
        // Auto hide alert after 5 seconds
        setTimeout(() => setPdfAlert(null), 5000);
    };

    const columns = useMemo(() => [
        {
            header: "Payment #",
            accessorKey: "paymentNumber",
            cell: (cell) => (
                <Badge color="info" className="badge-soft-info">
                    {cell.row.original.paymentNumber || 'N/A'}
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
            header: "Contact",
            accessorKey: "contactName",
            cell: (cell) => (
                <Badge color="warning" className="badge-soft-warning">
                    {cell.row.original.contactName || 'N/A'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Bank Account",
            accessorKey: "bankName",
            cell: (cell) => (
                <Badge color="success" className="badge-soft-success">
                    {cell.row.original.bankName || 'N/A'}
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
            header: "Type", 
            accessorKey: "type",
            cell: (cell) => (
                <Badge color={cell.row.original.paymentType === 'receipt' ? 'danger' : 'info'} 
                      className={`badge-soft-${cell.row.original.paymentType === 'receipt' ? 'danger' : 'info'}`}>
                    {cell.row.original.paymentType === 'receipt' ? 'Receipt' : 'Payment'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Adjustment Type",
            accessorKey: "adjustmentType",
            cell: (cell) => (
                <Badge color="secondary" className="badge-soft-secondary">
                    {cell.row.original.adjustmentType || '—'}
                </Badge>
            ),
            enableColumnFilter: false
        },
        {
            header: "Adjustment Value",
            accessorKey: "adjustmentValue",
            cell: (cell) => (
                <span className="fw-semibold">
                    {cell.row.original.adjustmentValue ? 
                     `₹${parseFloat(cell.row.original.adjustmentValue).toFixed(2)}` : '—'}
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
            header: "Action",
            accessorKey: "action",
            cell: (cell) => (
                <div className="d-flex gap-2 align-items-center">
                    {/* PDF Button */}
                    <PaymentPDFButton
                        paymentId={cell.row.original.id}
                        paymentNumber={cell.row.original.paymentNumber}
                        size="sm"
                        variant="outline-info"
                        onSuccess={handlePDFSuccess}
                        onError={handlePDFError}
                    />
                    
                    {/* Actions Dropdown */}
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
                            <DropdownItem divider />
                            <DropdownItem onClick={() => onDelete(cell.row.original)} className="py-2 text-danger">
                                <RiDeleteBinLine className="me-2 align-middle" /> Delete
                            </DropdownItem>
                        </DropdownMenu>
                    </UncontrolledDropdown>
                </div>
            ),
            enableColumnFilter: false
        }
    ], [onView, onEdit, onDelete]);

    return (
        <Card className="shadow-sm">
            <CardBody className="p-3">
                {pdfAlert && (
                    <Alert 
                        color={pdfAlert.type} 
                        className="mb-3"
                        isOpen={!!pdfAlert}
                        toggle={() => setPdfAlert(null)}
                    >
                        {pdfAlert.icon && <i className={`${pdfAlert.icon} me-2`}></i>}
                        {pdfAlert.message}
                    </Alert>
                )}
                
                <TableContainer
                    columns={columns}
                    data={payments || []}
                    isGlobalFilter={false}
                    isAddOptions={false}
                    customPageSize={pagination.limit}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    pagination={pagination}
                    handlePageChange={onPageChange}
                    serverSide={true}
                    divClass="table-responsive payment-table"
                    loading={loading}
                    onRowDoubleClick={onView}
                />
            </CardBody>
        </Card>
    );
};

export default PaymentTable;
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Card, CardBody, Col, Container, Row, Badge, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { ToastContainer, toast } from 'react-toastify';
import * as Yup from "yup";
import { useFormik } from "formik";
import {
    RiLoader4Line,
    RiGridFill,
    RiMoreFill,
    RiListCheck,
    RiAddLine,
    RiEyeLine,
    RiPencilLine,
    RiDeleteBinLine,
    RiDownload2Line,
    RiBankLine,
    RiCheckboxCircleLine,
  
    RiFileTextLine
} from 'react-icons/ri';

// Components
import BreadCrumb from '../../Components/Common/BreadCrumb';
import DeleteModal from "../../Components/Common/DeleteModal";
import TableContainer from '../../Components/Common/TableContainer';
import Loader from '../../Components/Common/Loader';
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import PreviewCardHeader from '../../Components/Common/PreviewCardHeader';
import {
    AccountCard,
    AccountModal,
    AccountDetailsOffcanvas,
    BankStatementModal,
    EmptyState,
    ACCOUNT_TYPES
} from '../../Components/BankAccounts';

// API
import { createBankAccount, getBankAccounts, updateBankAccount, deleteBankAccount } from '../../services/bankAccount';
import { getSelectedCompanyId } from '../../utils/apiCall';

const BankAccounts = () => {
    document.title = "Bank Accounts | Vyavhar - React Admin & Dashboard Template";

    const [bankAccounts, setBankAccounts] = useState([]);
    const [deleteModal, setDeleteModal] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState(null);
    const [modal, setModal] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [currentAccount, setCurrentAccount] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [statementModal, setStatementModal] = useState(false);
    const [selectedBankForStatement, setSelectedBankForStatement] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(6);
    const [exportModal, setExportModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);

    // Check for selected company ID
    useEffect(() => {
        const checkCompanyId = () => {
            const companyId = getSelectedCompanyId();
            setSelectedCompanyId(companyId);
        };
        
        // Check immediately
        checkCompanyId();
        
        // Also check when localStorage changes (in case company selection happens)
        const handleStorageChange = () => {
            checkCompanyId();
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Check periodically to catch company selection
        const interval = setInterval(checkCompanyId, 1000);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    // Only fetch bank accounts when a company is selected
    useEffect(() => {
        if (selectedCompanyId) {
            fetchBankAccounts();
        }
    }, [selectedCompanyId]);

    const fetchBankAccounts = async () => {
        // Don't proceed if no company is selected
        if (!selectedCompanyId) {
            console.log('No company selected, skipping bank accounts fetch');
            return;
        }

        setLoading(true);
        try {
            const response = await getBankAccounts({ includeInactive: true });
            if (response.success) {
                const accounts = response.accounts || [];
                const formattedAccounts = accounts.map(account => ({
                    ...account,
                    id: account.id,
                    bankName: account.accountName,
                    openingBalance: parseFloat(account.openingBalance || 0).toFixed(2),
                    accountType: account.accountType,
                    balance: parseFloat(account.currentBalance || 0).toFixed(2),
                    status: account.isActive ? 'Active' : 'Inactive',
                    openingDate: new Date(account.createdAt).toLocaleDateString()
                }));
                setBankAccounts(formattedAccounts);
                
                // Show info message if no accounts found instead of error
                if (accounts.length === 0) {
                    // No toast message needed for empty state - let UI handle it gracefully
                    console.log("No bank accounts found - showing empty state");
                }
            } else {
                toast.error(response.message || "Failed to fetch bank accounts");
            }
        } catch (error) {
            toast.error("An error occurred while fetching bank accounts");
            console.error("Error fetching bank accounts:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAccounts = useMemo(() => {
        let result = bankAccounts;

        if (statusFilter !== 'all') {
            const filterValue = statusFilter === 'active';
            result = result.filter(account => account.status === (filterValue ? 'Active' : 'Inactive'));
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(account =>
                account.bankName.toLowerCase().includes(term) ||
                account.accountType.toLowerCase().includes(term)
            );
        }

        return result;
    }, [bankAccounts, searchTerm, statusFilter]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredAccounts.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

    const columns = useMemo(() => [
        {
            header: "Bank",
            accessorKey: "bankName",
            cell: ({ row }) => (
                <div className="d-flex align-items-center">
                    <div className="flex-shrink-0 avatar-xs me-2">
                        <div className={`avatar-title bg-${ACCOUNT_TYPES[row.original.accountType]?.color || 'primary'}-subtle text-${ACCOUNT_TYPES[row.original.accountType]?.color || 'primary'} rounded`}>
                            {ACCOUNT_TYPES[row.original.accountType]?.icon || <RiBankLine />}
                        </div>
                    </div>
                    <div className="flex-grow-1">
                        <h6 className="mb-0">{row.original.bankName}</h6>
                    </div>
                </div>
            )
        },
        {
            header: "Type",
            accessorKey: "accountType",
            cell: ({ row }) => (
                <Badge className={`badge-soft-${ACCOUNT_TYPES[row.original.accountType]?.color || 'primary'}`}>
                    {ACCOUNT_TYPES[row.original.accountType]?.label || row.original.accountType}
                </Badge>
            )
        },
        {
            header: "Current Balance",
            accessorKey: "balance",
            cell: ({ row }) => (
                <span className={`fw-semibold ${parseFloat(row.original.balance) >= 0 ? 'text-success' : 'text-danger'}`}>
                    ${row.original.balance}
                </span>
            )
        },
        {
            header: "Opening Balance",
            accessorKey: "openingBalance",
            cell: ({ row }) => (
                <span className="text-muted">
                    ${row.original.openingBalance}
                </span>
            )
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: ({ row }) => (
                <Badge color={row.original.status === 'Active' ? 'success' : 'danger'}>
                    {row.original.status}
                </Badge>
            )
        },
        {
            header: "Created Date",
            accessorKey: "openingDate",
            cell: ({ row }) => (
                <span className="text-muted">
                    {row.original.openingDate}
                </span>
            )
        },
        {
            header: "Action",
            accessorKey: "action",
            cell: ({ row }) => (
                <UncontrolledDropdown>
                    <DropdownToggle tag="a" className="btn btn-soft-secondary btn-sm">
                        <RiMoreFill className="align-middle" />
                    </DropdownToggle>
                    <DropdownMenu className="dropdown-menu-end">
                        <DropdownItem onClick={() => {
                            setIsOpen(true);
                            setSelectedAccount(row.original);
                        }}>
                            <RiEyeLine className="me-2 align-middle text-muted" />View
                        </DropdownItem>
                        <DropdownItem onClick={() => {
                            setSelectedBankForStatement(row.original);
                            setStatementModal(true);
                        }}>
                            <RiFileTextLine className="me-2 align-middle text-muted" />Statement
                        </DropdownItem>
                        <DropdownItem onClick={() => handleAccountClick(row.original)}>
                            <RiPencilLine className="me-2 align-middle text-muted" />Edit
                        </DropdownItem>
                        <DropdownItem onClick={() => handleDeleteClick(row.original)}>
                            <RiDeleteBinLine className="me-2 align-middle text-muted" />Delete
                        </DropdownItem>
                    </DropdownMenu>
                </UncontrolledDropdown>
            )
        }
    ], []);

    const toggleModal = useCallback(() => {
        setModal(prev => !prev);
        if (modal) {
            setCurrentAccount(null);
            setIsEdit(false);
        }
    }, [modal]);

    const handleAccountClick = useCallback((account) => {
        setCurrentAccount(account);
        setIsEdit(true);
        setModal(true);
    }, []);

    const handleAddClick = useCallback(() => {
        setCurrentAccount(null);
        setIsEdit(false);
        setModal(true);
    }, []);

    const handleDeleteClick = useCallback((account) => {
        setAccountToDelete(account);
        setDeleteModal(true);
    }, []);

    const handleDeleteAccount = useCallback(async () => {
        if (accountToDelete) {
            try {
                const response = await deleteBankAccount(accountToDelete.id);
                if (response.success) {
                    toast.success("Bank account deleted successfully");
                    fetchBankAccounts();
                } else {
                    toast.error(response.message || "Failed to delete bank account");
                }
            } catch (error) {
                toast.error("An error occurred while deleting bank account");
                console.error("Error deleting bank account:", error);
            } finally {
                setDeleteModal(false);
                setAccountToDelete(null);
            }
        }
    }, [accountToDelete]);

    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            accountName: currentAccount?.bankName || '',
            accountType: currentAccount?.accountType || 'bank',
            openingBalance: currentAccount ? currentAccount.currentBalance || 0 : 0,
            isActive: currentAccount?.isActive !== undefined ? currentAccount.isActive : true
        },
        validationSchema: Yup.object({
            accountName: Yup.string()
                .min(2, "Bank name must be at least 2 characters")
                .required("Bank name is required"),
            accountType: Yup.string()
                .oneOf(Object.keys(ACCOUNT_TYPES), "Invalid account type")
                .required("Account type is required"),
            openingBalance: Yup.number()
                .min(0, "Balance cannot be negative")
                .required("Opening balance is required"),
        }),
        onSubmit: async (values) => {
            try {
                let response;
                if (isEdit) {
                    response = await updateBankAccount({
                        id: currentAccount.id,
                        accountType: values.accountType,
                        accountName: values.accountName,
                        currentBalance: values.openingBalance.toString(),
                        isActive: values.isActive
                    });
                } else {
                    response = await createBankAccount({
                        accountType: values.accountType,
                        accountName: values.accountName,
                        openingBalance: values.openingBalance.toString(),
                        currentBalance: values.openingBalance.toString(),
                        isActive: values.isActive
                    });
                }

                if (response.success) {
                    toast.success(`Bank account ${isEdit ? 'updated' : 'created'} successfully`);
                    fetchBankAccounts();
                    toggleModal();
                    validation.resetForm();
                } else {
                    toast.error(response.message || `Failed to ${isEdit ? 'update' : 'create'} bank account`);
                }
            } catch (error) {
                toast.error(`An error occurred while ${isEdit ? 'updating' : 'creating'} bank account`);
                console.error(`Error ${isEdit ? 'updating' : 'creating'} bank account:`, error);
            }
        }
    });

    const renderTable = () => (
        <Card className="shadow-sm">
            <PreviewCardHeader title="Bank Accounts" />
            <CardBody>
                <TableContainer
                    columns={columns}
                    data={filteredAccounts}
                    isGlobalFilter={false}
                    customPageSize={10}
                    tableClass="table align-middle table-nowrap mb-0"
                    theadClass="table-light"
                    divClass="table-responsive"
                />
            </CardBody>
        </Card>
    );

    return (
        <React.Fragment>
            <ToastContainer closeButton={false} position="top-right" />                                                                                                                                             
            <DeleteModal
                show={deleteModal}
                onDeleteClick={handleDeleteAccount}
                onCloseClick={() => setDeleteModal(false)}
            />
            <ExportCSVModal
                show={exportModal}
                onCloseClick={() => setExportModal(false)}
                data={bankAccounts}
                filename="bank-accounts"
            />

            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Bank Accounts" pageTitle="Finance" />

                    <Row className="mb-4">
                        <Col md={12} className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                                <div className="btn-group btn-group-sm" role="group">
                                    <Button color={viewMode === 'grid' ? 'primary' : 'light'} onClick={() => setViewMode('grid')} size="sm">
                                        <RiGridFill className="align-bottom" />
                                    </Button>
                                    <Button color={viewMode === 'table' ? 'primary' : 'light'} onClick={() => setViewMode('table')} size="sm">
                                        <RiListCheck className="align-bottom" />
                                    </Button>
                                </div>
                                <Button color="success" onClick={handleAddClick} size="sm">
                                    <RiAddLine className="me-1 align-bottom" /> Add Account
                                </Button>
                                <Button color="info" onClick={() => setExportModal(true)} size="sm">
                                    <RiDownload2Line className="me-1 align-bottom" /> Export
                                </Button>
                            </div>
                        </Col>
                    </Row>

                    <Row className="mb-4">
                        {[
                            { title: "Total Accounts", value: bankAccounts.length, icon: <RiBankLine size={24} />, color: "success" },
                            { title: "Active Accounts", value: bankAccounts.filter(acc => acc.status === 'Active').length, icon: <RiCheckboxCircleLine size={24} />, color: "primary" },
                            { title: "Total Balance", value: bankAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0).toFixed(2), icon: <RiBankLine size={24} />, color: "info" }
                        ].map((stat, idx) => (
                            <Col md={4} key={idx}>
                                <Card className="card-animate">
                                    <CardBody>
                                        <div className="d-flex align-items-start">
                                            <div className="flex-shrink-0 me-3">
                                                <div className={`avatar-md bg-${stat.color}-subtle text-${stat.color} rounded-2 d-flex align-items-center justify-content-center`}>
                                                    {stat.icon}
                                                </div>
                                            </div>
                                            <div className="flex-grow-1 overflow-hidden">
                                                <p className="text-uppercase fw-medium text-muted text-truncate mb-1">{stat.title}</p>
                                                <h4 className="fs-22 fw-semibold ff-secondary mb-0">
                                                    {stat.title === "Total Balance" ? `₹${stat.value}` : stat.value}
                                                </h4>
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            </Col>
                        ))}
                    </Row>

                    {loading ? (
                        <div className="text-center py-5">
                            <Loader />
                        </div>
                    ) : viewMode === 'grid' ? (
                        <>
                            <Row className="grid-view-filter mb-4">
                                {filteredAccounts.map((account) => (
                                    <Col key={account.id} xl={4} lg={6} md={6} className="mb-4">
                                        <AccountCard
                                            account={account}
                                            onView={() => {
                                                setIsOpen(true);
                                                setSelectedAccount(account);
                                            }}
                                            onStatement={() => {
                                                setSelectedBankForStatement(account);
                                                setStatementModal(true);
                                            }}
                                            onEdit={() => handleAccountClick(account)}
                                            onDelete={() => handleDeleteClick(account)}
                                        />
                                    </Col>
                                ))}
                            </Row>
                            {filteredAccounts.length === 0 && (
                                <EmptyState
                                    title="No bank accounts found"
                                    description="Try adjusting your search filters or add a new account to get started"
                                    onAddClick={handleAddClick}
                                />
                            )}
                        </>
                    ) : (
                        renderTable()
                    )}
                </Container>
            </div>

            <AccountModal isOpen={modal} toggle={toggleModal} isEdit={isEdit} validation={validation} />
            <AccountDetailsOffcanvas isOpen={isOpen} toggle={() => setIsOpen(!isOpen)} account={selectedAccount} />
            <BankStatementModal 
                show={statementModal} 
                onCloseClick={() => {
                    setStatementModal(false);
                    setSelectedBankForStatement(null);
                }} 
                bankAccount={selectedBankForStatement}
            />
        </React.Fragment>
    );
};

export default BankAccounts;
import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast } from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import BankTransferFilters from '../../Components/BankTransfer/BankTransferFilters';
import BankTransferTable from '../../Components/BankTransfer/BankTransferTable';
import BankTransferForm from '../../Components/BankTransfer/BankTransferForm';
import BankTransferViewModal from '../../Components/BankTransfer/BankTransferViewModal';
import DeleteModal from "../../Components/Common/DeleteModal";
import ExportCSVModal from '../../Components/Common/ExportCSVModal';
import Loader from '../../Components/Common/Loader';
import { getBankAccounts } from '../../services/bankAccount';
import { getCurrentMonthRange } from '../../utils/dateUtils';
import { createBankTransfer, deleteBankTransfer, listBankTransfers, updateBankTransfer } from '../../services/bankTransfer';

const BankTransfersPage = () => {
    const currentMonthRange = getCurrentMonthRange();

    // State management
    const [state, setState] = useState({
        transfers: [],
        bankAccounts: [],
        loading: false,
        searchTerm: '',
        pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 1,
            currentPage: 1
        },
        filters: {
            fromBankAccountId: '',
            toBankAccountId: '',
            startDate: currentMonthRange.startDate,
            endDate: currentMonthRange.endDate
        },
        modals: {
            delete: false,
            main: false,
            view: false,
            export: false
        },
        selectedTransfer: null,
        isEditMode: false,
        apiLoading: false
    });

    const {
        transfers, bankAccounts, loading, searchTerm,
        pagination, filters, modals, selectedTransfer, isEditMode,
        apiLoading
    } = state;

    // API calls with loading states
    const fetchData = async () => {
        try {
            setState(prev => ({ ...prev, loading: true, apiLoading: true }));

            const [transfersRes, accountsRes] = await Promise.all([
                listBankTransfers({
                    page: pagination.page,
                    limit: pagination.limit,
                    fromBankAccountId: filters.fromBankAccountId,
                    toBankAccountId: filters.toBankAccountId,
                    startDate: filters.startDate,
                    endDate: filters.endDate
                }).catch(() => ({ success: false, transfers: [] })), // Add error handling
                getBankAccounts().catch(() => ({ success: false, accounts: [] })) // Add error handling
            ]);

            setState(prev => ({
                ...prev,
                transfers: transfersRes?.success ? transfersRes.transfers || [] : [],
                bankAccounts: accountsRes?.success ? accountsRes.accounts || [] : prev.bankAccounts,
                pagination: {
                    page: transfersRes?.pagination?.currentPage || 1,
                    limit: transfersRes?.pagination?.limit || 10,
                    total: transfersRes?.pagination?.total || 0,
                    totalPages: transfersRes?.pagination?.totalPages || 1,
                    currentPage: transfersRes?.pagination?.currentPage || 1
                },
                loading: false,
                apiLoading: false
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                apiLoading: false,
                transfers: []
            }));
            toast.error("Failed to load data");
        }
    };

    useEffect(() => {
        fetchData();
    }, [pagination.page, filters.fromBankAccountId, filters.toBankAccountId, filters.startDate, filters.endDate]);

    // Modal handlers
    const toggleModal = (modalName, value) => {
        setState(prev => ({
            ...prev,
            modals: { ...prev.modals, [modalName]: value !== undefined ? value : !prev.modals[modalName] }
        }));
    };

    const handleAddClick = () => {
        setState(prev => ({
            ...prev,
            isEditMode: false,
            selectedTransfer: null,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleEditClick = (transfer) => {
        setState(prev => ({
            ...prev,
            selectedTransfer: transfer,
            isEditMode: true,
            modals: { ...prev.modals, main: true }
        }));
    };

    const handleViewClick = (transfer) => {
        setState(prev => ({
            ...prev,
            selectedTransfer: transfer,
            modals: { ...prev.modals, view: true }
        }));
    };

    const handleDeleteClick = (transfer) => {
        setState(prev => ({
            ...prev,
            selectedTransfer: transfer,
            modals: { ...prev.modals, delete: true }
        }));
    };

    // CRUD operations
    const handleDeleteTransfer = async () => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const response = await deleteBankTransfer(selectedTransfer.id);
            if (response.success) {
                setState(prev => ({
                    ...prev,
                    transfers: prev.transfers.filter(t => t.id !== selectedTransfer.id),
                    modals: { ...prev.modals, delete: false },
                    apiLoading: false,
                    pagination: {
                        ...prev.pagination,
                        total: prev.pagination.total - 1
                    }
                }));
                toast.success("Transfer deleted successfully");
                fetchData();
            }
        } catch (error) {
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error("Failed to delete transfer");
        }
    };

    const handleSubmitTransfer = async (values) => {
        try {
            setState(prev => ({ ...prev, apiLoading: true }));
            const payload = {
                id: values.id,
                fromBankId: values.fromBankId,
                toBankId: values.toBankId,
                date: values.date,
                amount: values.amount.toString(),
                description: values.description || '',
                referenceNumber: values.referenceNumber || null
            };

            const response = isEditMode
                ? await updateBankTransfer(payload)
                : await createBankTransfer(payload);

            if (response.success) {
                toast.success(`Transfer ${isEditMode ? 'updated' : 'created'} successfully`);
                setState(prev => ({
                    ...prev,
                    modals: { ...prev.modals, main: false },
                    apiLoading: false
                }));
                fetchData();
            }
        } catch (error) {
            console.log("error", error.message)
            setState(prev => ({ ...prev, apiLoading: false }));
            toast.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} transfer`);
        }
    };

    // Filter and pagination
    const handlePageChange = (page) => {
        setState(prev => ({
            ...prev,
            pagination: {
                ...prev.pagination,
                page: page,
                currentPage: page
            }
        }));
    };

    const handleFilterChange = (newFilters) => {
        setState(prev => ({
            ...prev,
            filters: newFilters,
            pagination: { ...prev.pagination, page: 1 }
        }));
    };

    const prepareExportData = () => {
        return transfers.map(transfer => ({
            'Transfer Number': transfer.transferNumber || 'N/A',
            'Date': new Date(transfer.date).toLocaleDateString(),
            'From Account': transfer.fromBankName || 'N/A',
            'To Account': transfer.toBankName || 'N/A',
            'Amount': parseFloat(transfer.amount || 0).toFixed(2),
            'Description': transfer.description || '',
            'Reference Number': transfer.referenceNumber || '',
            'Created By': transfer.createdByName || 'N/A',
            'Created At': new Date(transfer.createdAt).toLocaleString()
        }));
    };

    const filteredTransfers = useMemo(() => {
        if (!searchTerm) return transfers;
        const term = searchTerm.toLowerCase();
        return transfers.filter(transfer =>
            transfer.description?.toLowerCase().includes(term) ||
            transfer.transferNumber?.toLowerCase().includes(term) ||
            transfer.fromBankName?.toLowerCase().includes(term) ||
            transfer.toBankName?.toLowerCase().includes(term) ||
            transfer.referenceNumber?.toLowerCase().includes(term)
        );
    }, [transfers, searchTerm]);

    return (
        <div className="page-content">
            <Container fluid>
                <BreadCrumb title="Bank Transfers" pageTitle="Finance" />

                <BankTransferFilters
                    bankAccounts={bankAccounts}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    currentMonthRange={currentMonthRange}
                />

                <Row className="mb-3">
                    <Col sm={12} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                            <Button color="primary" onClick={() => toggleModal('export', true)}>
                                <RiDownload2Line className="align-bottom" /> Export
                            </Button>
                            <Button color="success" onClick={handleAddClick}>
                                <RiAddLine className="align-bottom" /> Add Transfer
                            </Button>
                        </div>
                    </Col>
                </Row>

                {loading ? (
                    <Loader />
                ) : (
                    <BankTransferTable
                        transfers={filteredTransfers || []}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        onView={handleViewClick}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                    />
                )}

                <BankTransferForm
                    isOpen={modals.main}
                    toggle={() => toggleModal('main')}
                    isEditMode={isEditMode}
                    bankAccounts={bankAccounts}
                    selectedTransfer={selectedTransfer}
                    onSubmit={handleSubmitTransfer}
                    isLoading={apiLoading}
                />

                <BankTransferViewModal
                    isOpen={modals.view}
                    toggle={() => toggleModal('view')}
                    transfer={selectedTransfer}
                />

                <DeleteModal
                    show={modals.delete}
                    onDeleteClick={handleDeleteTransfer}
                    onCloseClick={() => toggleModal('delete', false)}
                    isLoading={apiLoading}
                />

                <ExportCSVModal
                    show={modals.export}
                    onCloseClick={() => toggleModal('export', false)}
                    data={prepareExportData()}
                    filename="bank-transfers"
                />
            </Container>
        </div>
    );
};

export default BankTransfersPage;
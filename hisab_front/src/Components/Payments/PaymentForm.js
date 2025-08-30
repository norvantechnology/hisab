import React, { useState, useEffect, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Button, Row, Col, Table, Card, CardBody, Badge } from 'reactstrap';
import { RiLoader4Line, RiBankLine, RiShoppingCartLine, RiWalletLine, RiCalendarLine, RiStoreLine } from 'react-icons/ri';
import ReactSelect from 'react-select';
import * as Yup from "yup";
import { useFormik } from "formik";
import { ACCOUNT_TYPES } from '../BankAccounts/index';
import { getPendingTransactions } from '../../services/payment';
import { adjustmentOptions } from './Constant';

const PaymentForm = ({
    isOpen,
    toggle,
    isEditMode = false,
    bankAccounts = [],
    contacts = [],
    selectedPayment = null,
    selectedInvoice = null,
    invoiceType = null,
    onSubmit,
    isLoading = false
}) => {
    const [pendingTransactions, setPendingTransactions] = useState([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [transactionAllocations, setTransactionAllocations] = useState({});
    const [isEditModeInitialized, setIsEditModeInitialized] = useState(false);
    const [hasAutoSelected, setHasAutoSelected] = useState(false);

    const parseAmount = useCallback((amount) => {
        const parsed = parseFloat(amount);
        return isNaN(parsed) ? 0 : parsed;
    }, []);

    const formatAmount = useCallback((amount) => parseAmount(amount).toFixed(2), [parseAmount]);

    const getTransactionTypeDisplay = useCallback((transaction) => {
        const type = transaction.type || 'purchase'; // Default to purchase for backward compatibility
        
        switch (type) {
            case 'current-balance':
                return {
                    icon: <RiWalletLine className="me-1" size={14} />,
                    label: 'Current Balance',
                    color: 'info'
                };
            case 'purchase':
                return {
                    icon: <RiShoppingCartLine className="me-1" size={14} />,
                    label: 'Purchase',
                    color: 'warning'
                };
            case 'sale':
                return {
                    icon: <RiStoreLine className="me-1" size={14} />,
                    label: 'Sale',
                    color: 'success'
                };
            case 'expense':
                return {
                    icon: <RiBankLine className="me-1" size={14} />,
                    label: 'Expense',
                    color: 'danger'
                };
            case 'income':
                return {
                    icon: <RiBankLine className="me-1" size={14} />,
                    label: 'Income',
                    color: 'success'
                };
            default:
                return {
                    icon: <RiShoppingCartLine className="me-1" size={14} />,
                    label: 'Transaction',
                    color: 'secondary'
                };
        }
    }, []);

    const getTransactionDescription = useCallback((transaction) => {
        const type = transaction.type || 'purchase';
        
        if (type === 'current-balance') {
            return 'Current Balance';
        }
        
        if (transaction.description) {
            return transaction.description;
        }
        
        // Fallback descriptions
        switch (type) {
            case 'purchase':
                return transaction.invoiceNumber ? `Purchase #${transaction.invoiceNumber}` : 'Purchase';
            case 'sale':
                return transaction.invoiceNumber ? `Sale #${transaction.invoiceNumber}` : 'Sale';
            case 'expense':
                return transaction.categoryName ? `Expense: ${transaction.categoryName}` : 'Expense';
            case 'income':
                return transaction.categoryName ? `Income: ${transaction.categoryName}` : 'Income';
            default:
                return 'Transaction';
        }
    }, []);

    const extractTransactionData = useCallback((payment) => {
        if (!payment?.allocations) return { ids: [], allocations: {} };
        const ids = [];
        const allocations = {};
        payment.allocations.forEach(allocation => {
            // Use the transactionId provided by the backend, which correctly handles all allocation types
            const transactionId = allocation.transactionId || 
                (allocation.allocationType === 'current-balance' ? 'current-balance' : 
                 allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId || allocation.id);
            
            // Ensure transaction ID is always a string for consistency
            const transactionIdStr = transactionId.toString();
            ids.push(transactionIdStr);
            allocations[transactionIdStr] = parseAmount(allocation.paidAmount || allocation.amount);
        });
        return { ids, allocations };
    }, [parseAmount]);

    const resetStates = useCallback(() => {
        setPendingTransactions([]);
        setTransactionAllocations({});
        setIsLoadingTransactions(false);
        setHasAutoSelected(false);
        setIsEditModeInitialized(false);
    }, []);

    // Check if any allocation exceeds pending amount
    const hasOverAllocation = useCallback(() => {
        return pendingTransactions.some(transaction => {
            const allocatedAmount = parseAmount(transactionAllocations[transaction.id.toString()] || 0);
            // Check if this transaction was part of the original payment
            const isOriginalTransaction = selectedPayment?.allocations?.some(allocation => 
                allocation.transactionId === transaction.id || 
                allocation.purchaseId === transaction.id || 
                allocation.saleId === transaction.id || 
                allocation.expenseId === transaction.id || 
                allocation.incomeId === transaction.id
            );
            const maxAmount = (isEditMode && isOriginalTransaction) ? (transaction.paidAmount + transaction.pendingAmount) : transaction.pendingAmount;
            return allocatedAmount > maxAmount;
        });
    }, [pendingTransactions, transactionAllocations, isEditMode, selectedPayment, parseAmount]);



    const validationSchema = Yup.object({
        date: Yup.date().required("Date is required"),
        contactId: Yup.string().required("Contact is required"),
        bankId: Yup.string().required("Bank account is required"),
        description: Yup.string().max(500, "Description must be 500 characters or less"),
        adjustmentType: Yup.string().required("Adjustment type is required"),
        adjustmentValue: Yup.number()
            .min(0, "Adjustment value must be positive")
            .when('adjustmentType', ([adjustmentType], schema) => {
                return adjustmentType !== 'none'
                    ? schema.required("Adjustment value is required")
                    : schema;
            }),
        transactionIds: Yup.array().min(1, "At least one transaction must be selected")
    });

    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: selectedPayment?.id || '',
            date: selectedPayment?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            contactId: selectedPayment?.contactId || selectedInvoice?.contactId || selectedInvoice?.contact?.id || '',
            bankId: selectedPayment?.bankId || '',
            description: selectedPayment?.description || 
                (selectedInvoice ? `Payment for ${invoiceType === 'sale' ? 'Sales' : 'Purchase'} Invoice #${selectedInvoice.invoiceNumber}` : ''),
            adjustmentType: selectedPayment?.adjustmentType || 'none',
            adjustmentValue: selectedPayment?.adjustmentValue || 0,
            transactionIds: isEditMode && selectedPayment ? extractTransactionData(selectedPayment).ids : []
        },
        validationSchema,
        onSubmit: async (values) => {
            console.log('🚀 Submitting payment with values:', values);
            console.log('🏦 Bank Account Debug:', {
                bankId: values.bankId,
                bankIdType: typeof values.bankId,
                bankIdExists: !!values.bankId,
                availableBankAccounts: bankAccounts.length,
                selectedBankAccount: bankAccounts.find(b => b.id === values.bankId)
            });
            
            // Transform allocations to match the regular payment page structure
            const allocations = values.transactionIds.map(id => {
                const transaction = pendingTransactions.find(t => t.id.toString() === id);
                
                console.log('💰 Processing transaction allocation:', {
                    id,
                    transaction: transaction ? {
                        id: transaction.id,
                        type: transaction.type,
                        invoiceNumber: transaction.invoiceNumber,
                        balanceType: transaction.balanceType
                    } : null,
                    allocationAmount: transactionAllocations[id]
                });
                
                return {
                    transactionId: id,
                    transactionType: transaction?.type || (invoiceType || 'purchase'),
                    type: transaction?.balanceType || 'receivable',
                    amount: parseFloat(transaction?.pendingAmount || 0),
                    paidAmount: parseFloat(transactionAllocations[id] || 0)
                };
            });

            // Debug form values before validation
            console.log('🔍 Pre-validation debug:', {
                'values.bankId': values.bankId,
                'values.contactId': values.contactId,
                'values.date': values.date,
                'bankIdType': typeof values.bankId,
                'bankIdParsed': parseInt(values.bankId),
                'bankIdParsedType': typeof parseInt(values.bankId)
            });
            
            // Validate required fields before sending
            if (!values.bankId) {
                console.error('❌ Bank account not selected! values.bankId:', values.bankId);
                return;
            }
            
            if (!values.contactId) {
                console.error('❌ Contact not selected! values.contactId:', values.contactId);
                return;
            }
            
            // Structure payload exactly like regular payment page  
            const payload = {
                contactId: parseInt(values.contactId),
                bankAccountId: parseInt(values.bankId),
                date: values.date,
                description: values.description || '',
                adjustmentType: values.adjustmentType || 'none',
                adjustmentValue: values.adjustmentType !== 'none' ? parseFloat(values.adjustmentValue) : 0,
                transactionAllocations: allocations
            };
            
            console.log('🛠️ Payload after creation (before cleanup):', payload);
            
            // Only remove null/undefined fields, not zero values or NaN
            Object.keys(payload).forEach(key => {
                const value = payload[key];
                // Don't remove if it's a valid number (including 0) or valid string
                if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
                    console.log('🗑️ Removing invalid field:', key, value);
                    delete payload[key];
                }
            });
            
            // Ensure bankAccountId is always present if bankId was selected
            if (values.bankId && !payload.hasOwnProperty('bankAccountId')) {
                payload.bankAccountId = parseInt(values.bankId);
                console.log('🔧 Force-added missing bankAccountId:', payload.bankAccountId);
            }
            
            console.log('🔍 Final payload validation:', {
                'values.bankId': values.bankId,
                'payload.bankAccountId': payload.bankAccountId,
                'contactId': payload.contactId,
                'date': payload.date,
                'hasAllRequiredFields': !!(payload.contactId && payload.bankAccountId && payload.date && payload.transactionAllocations?.length),
                'transactionAllocations.length': payload.transactionAllocations.length
            });
            
            console.log('📤 FINAL PAYLOAD being sent to API:', payload);
            
            await onSubmit(payload);
        }
    });

    const formatOptions = {
        contact: (contact) => ({ value: contact.id, label: contact.name }),
        bank: (account) => {
            const accountType = ACCOUNT_TYPES[account.accountType] || ACCOUNT_TYPES.bank;
            return {
                value: account.id,
                label: account.accountName,
                icon: accountType.icon,
                color: accountType.color
            };
        }
    };

    const getCurrentOption = (type, value, items) => {
        if (!value || !items.length) return null;
        const item = items.find(i => String(i.id) === String(value));
        return item ? formatOptions[type](item) : null;
    };

    // Check if any selected transaction has zero allocation
    const hasZeroAllocation = useCallback(() => {
        return validation.values.transactionIds.some(id => {
            const allocatedAmount = parseAmount(transactionAllocations[id] || 0);
            return allocatedAmount <= 0;
        });
    }, [validation.values.transactionIds, transactionAllocations, parseAmount]);

    const calculations = {
        totalReceivable: () => {
            return validation.values.transactionIds.reduce((sum, id) => {
                const transaction = pendingTransactions.find(t => t.id.toString() === id);
                const allocatedAmount = parseAmount(transactionAllocations[id] || 0);
                return transaction?.balanceType === 'receivable' ? sum + allocatedAmount : sum;
            }, 0);
        },
        totalPayable: () => {
            return validation.values.transactionIds.reduce((sum, id) => {
                const transaction = pendingTransactions.find(t => t.id.toString() === id);
                const allocatedAmount = parseAmount(transactionAllocations[id] || 0);
                return transaction?.balanceType === 'payable' ? sum + allocatedAmount : sum;
            }, 0);
        },
        adjustmentImpact: () => {
            const adjustmentAmount = parseAmount(validation.values.adjustmentValue || 0);
            const adjustmentType = validation.values.adjustmentType || 'none';
            return adjustmentType === 'none' ? 0 : adjustmentAmount;
        },
        bankImpact: () => {
            const receivableTotal = calculations.totalReceivable();
            const payableTotal = calculations.totalPayable();
            const adjustmentAmount = calculations.adjustmentImpact();
            const adjustmentType = validation.values.adjustmentType || 'none';
            let net = receivableTotal - payableTotal;
            if (adjustmentType === 'discount') net = net + adjustmentAmount;
            else if (adjustmentType === 'surcharge' || adjustmentType === 'extra_receipt') net = net - adjustmentAmount;
            return {
                amount: Math.abs(net),
                type: net >= 0 ? 'receipt' : 'payment',
                label: net >= 0 ? 'Amount to receive' : 'Amount to pay'
            };
        }
    };

    const transformAllocationsToPendingTransactions = useCallback((allocations) => {
        return allocations.map(allocation => {
            const isCurrentBalance = allocation.allocationType === 'current-balance';
            
            // Use the transactionId provided by backend or determine it based on allocation type
            let transactionId, description, type;
            
            if (isCurrentBalance) {
                transactionId = 'current-balance';
                description = 'Current Balance';
                type = 'current-balance';
            } else if (allocation.allocationType === 'purchase') {
                transactionId = allocation.transactionId || allocation.purchaseId;
                description = allocation.description || `Purchase #${allocation.purchaseInvoiceNumber || transactionId}`;
                type = 'purchase';
            } else if (allocation.allocationType === 'sale') {
                transactionId = allocation.transactionId || allocation.saleId;
                description = allocation.description || `Sale #${allocation.saleInvoiceNumber || transactionId}`;
                type = 'sale';
            } else if (allocation.allocationType === 'expense') {
                transactionId = allocation.transactionId || allocation.expenseId;
                description = allocation.description || `Expense #${transactionId}`;
                type = 'expense';
            } else if (allocation.allocationType === 'income') {
                transactionId = allocation.transactionId || allocation.incomeId;
                description = allocation.description || `Income #${transactionId}`;
                type = 'income';
            } else {
                // Fallback for unknown types
                transactionId = allocation.transactionId || allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId || allocation.id;
                description = allocation.description || `Transaction #${transactionId}`;
                type = allocation.allocationType || 'purchase';
            }

            return {
                id: transactionId,
                type: type,
                description: description,
                date: allocation.expenseDate || allocation.incomeDate || allocation.createdAt,
                amount: parseAmount(allocation.expenseAmount || allocation.incomeAmount || allocation.amount || 0),
                pendingAmount: parseAmount(allocation.pendingAmount || 0),
                paidAmount: parseAmount(allocation.paidAmount || 0),
                balanceType: allocation.balanceType,
                isCurrentBalance: isCurrentBalance,
                // Include additional data that might be useful
                categoryName: allocation.expenseCategoryName || allocation.incomeCategoryName,
                contactName: allocation.expenseContactName || allocation.incomeContactName || allocation.purchaseSupplierName,
                invoiceNumber: allocation.purchaseInvoiceNumber || allocation.saleInvoiceNumber,
                notes: allocation.expenseNotes || allocation.incomeNotes
            };
        });
    }, [parseAmount]);

    const getExistingTransactionIds = useCallback(() => {
        return selectedPayment?.allocations ? selectedPayment.allocations.map(allocation =>
            allocation.transactionId || 
            (allocation.allocationType === 'current-balance' ? 'current-balance' : 
             allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId || allocation.id)
        ) : [];
    }, [selectedPayment?.id]);

    const fetchPendingTransactions = useCallback(async (contactId) => {
        if (!contactId) return;
        setIsLoadingTransactions(true);
        try {
            let allTransactions = [];

            // Step 1: Get existing transactions from selectedPayment.allocations (if in edit mode)
            if (isEditMode && selectedPayment?.allocations) {
                const existingTransactions = transformAllocationsToPendingTransactions(selectedPayment.allocations);
                allTransactions = [...existingTransactions];
            }

            // Step 2: Get fresh pending transactions from API
            const response = await getPendingTransactions(contactId);
            const freshTransactions = response.transactions || [];
            
            console.log('📊 API Response for contactId', contactId, ':', {
                success: response.success,
                transactionCount: freshTransactions.length,
                transactions: freshTransactions.map(t => ({
                    id: t.id,
                    type: t.type,
                    invoiceNumber: t.invoiceNumber,
                    pendingAmount: t.pendingAmount
                }))
            });


            // Step 3: Get IDs of existing transactions to avoid duplicates
            const existingIds = isEditMode ? getExistingTransactionIds() : [];

            // Step 4: Filter out transactions that already exist in selectedPayment.allocations
            const newTransactions = freshTransactions.filter(
                txn => !existingIds.includes(txn.id)
            );

            // Step 5: Update existing transactions with fresh pending amounts from API
            if (isEditMode && selectedPayment?.allocations) {
                allTransactions = allTransactions.map(existingTxn => {
                    // Find matching transaction in fresh data
                    const freshTxn = freshTransactions.find(ft => ft.id === existingTxn.id);
                    if (freshTxn) {
                        // Use fresh pending amount from API
                        return {
                            ...existingTxn,
                            pendingAmount: freshTxn.pendingAmount,
                            paidAmount: freshTxn.paidAmount,
                            amount: freshTxn.amount
                        };
                    } else {
                        // Transaction not found in fresh data, set pendingAmount to 0
                        return {
                            ...existingTxn,
                            pendingAmount: 0,
                            // Keep the original paidAmount and amount
                        };
                    }
                });
            }

            // Step 6: Combine existing (updated) and new transactions
            allTransactions = [...allTransactions, ...newTransactions];
            
            setPendingTransactions(allTransactions);
            
            // Step 7: In edit mode, ensure transaction allocations are preserved
            if (isEditMode && selectedPayment?.allocations) {
                const preservedAllocations = {};
                selectedPayment.allocations.forEach(allocation => {
                    const transactionId = (allocation.transactionId || 
                        (allocation.allocationType === 'current-balance' ? 'current-balance' : 
                         allocation.purchaseId || allocation.saleId || allocation.expenseId || allocation.incomeId || allocation.id)).toString();
                    
                    preservedAllocations[transactionId] = parseAmount(allocation.paidAmount || allocation.amount);
                });
                
                // Merge with any existing allocations to avoid overwriting user changes
                setTransactionAllocations(prev => ({
                    ...prev,
                    ...preservedAllocations
                }));
                
                console.log('💾 Preserved existing allocations:', preservedAllocations);
            }
        } catch (error) {
            console.error('Error fetching pending transactions:', error);
            setPendingTransactions([]);
            // Optionally show user-friendly error message
            // You could add a toast notification here if needed
        } finally {
            setIsLoadingTransactions(false);
        }
    }, [isEditMode, selectedPayment?.id]);

    const initializeEditMode = useCallback(() => {
        if (selectedPayment?.allocations && pendingTransactions.length > 0) {
            const { ids: initialTransactionIds, allocations: initialAllocations } = extractTransactionData(selectedPayment);
            
            console.log('🔧 Edit mode initializing with:', {
                selectedPaymentId: selectedPayment.id,
                allocations: initialAllocations,
                transactionIds: initialTransactionIds,
                pendingTransactionsCount: pendingTransactions.length
            });
            
            // Set both allocations and selected transaction IDs
            setTransactionAllocations(initialAllocations);
            validation.setFieldValue('transactionIds', initialTransactionIds);
        }
    }, [selectedPayment?.id, pendingTransactions.length]);

    useEffect(() => {
        if (isOpen) {
            if (isEditMode && selectedPayment) {
                // For edit mode, first fetch transactions then initialize
                const contactId = selectedPayment.contactId;
                if (contactId) {
                    // Don't call initializeEditMode here - let the useEffect handle it after transactions load
                    fetchPendingTransactions(contactId);
                }
            } else if (selectedInvoice) {
                resetStates();
                // Handle invoice-based payment creation
                // Handle both flat contactId and nested contact.id structures
                const contactId = selectedInvoice.contactId?.toString() || selectedInvoice.contact?.id?.toString();
                
                console.log('🔍 Invoice payment setup:', {
                    selectedInvoice,
                    flatContactId: selectedInvoice.contactId,
                    nestedContactId: selectedInvoice.contact?.id,
                    resolvedContactId: contactId
                });
                
                if (contactId) {
                    // Force set the contact ID in the form
                    validation.setFieldValue('contactId', contactId);
                    
                    // Fetch pending transactions
                    fetchPendingTransactions(contactId);
                } else {
                    console.warn('⚠️ No contact ID found in selectedInvoice:', selectedInvoice);
                }
            } else {
                resetStates();
                // Regular payment creation
                const contactId = validation.values.contactId;
                if (contactId) {
                    fetchPendingTransactions(contactId);
                }
            }
        } else {
            validation.resetForm();
            resetStates();
        }
    }, [isOpen, isEditMode, selectedPayment?.id, selectedInvoice?.id, invoiceType]);

    useEffect(() => {
        if (isOpen && !isEditMode && !selectedInvoice) {
            // Only for regular payment creation (not invoice-based)
            const contactId = validation.values.contactId;
            if (contactId) {
                fetchPendingTransactions(contactId);
            }
        }
    }, [isOpen, isEditMode, selectedInvoice, validation.values.contactId]);

    // Additional useEffect to ensure edit mode data is properly set after pending transactions are loaded
    useEffect(() => {
        if (isEditMode && selectedPayment && pendingTransactions.length > 0 && !isEditModeInitialized) {
            const existingTransactionIds = extractTransactionData(selectedPayment).ids;
            const existingAllocations = extractTransactionData(selectedPayment).allocations;
            
            console.log('🔧 Initializing form with existing payment data (one-time):', {
                existingIds: existingTransactionIds,
                existingAllocations,
                currentIds: validation.values.transactionIds,
                currentAllocations: transactionAllocations,
                pendingTransactionsLoaded: pendingTransactions.length
            });
            
            // Set transaction IDs in form
            validation.setFieldValue('transactionIds', existingTransactionIds);
            
            // Set allocation amounts
            setTransactionAllocations(existingAllocations);
            
            // Mark as initialized to prevent multiple calls
            setIsEditModeInitialized(true);
            
            // Validate that the pending transactions include our selected transactions
            const missingTransactions = existingTransactionIds.filter(id => 
                !pendingTransactions.some(t => t.id.toString() === id)
            );
            
            if (missingTransactions.length > 0) {
                console.warn('⚠️ Some transactions from payment not found in pending transactions:', missingTransactions);
            }
        }
    }, [isEditMode, selectedPayment?.id, pendingTransactions.length, isEditModeInitialized]);

    // Auto-select the invoice transaction after pending transactions are loaded
    useEffect(() => {
        console.log('🔍 Auto-selection check:', {
            isOpen,
            hasSelectedInvoice: !!selectedInvoice,
            isEditMode,
            pendingTransactionsCount: pendingTransactions.length,
            hasAutoSelected,
            selectedInvoiceId: selectedInvoice?.id
        });
        
        if (isOpen && selectedInvoice && !isEditMode && pendingTransactions.length > 0 && !hasAutoSelected) {
            console.log('🎯 Starting auto-selection for invoice:', selectedInvoice.invoiceNumber);
            
            // Find the specific invoice in the pending transactions
            const invoiceId = selectedInvoice.id.toString();
            
            console.log('📋 Available transactions for matching:', pendingTransactions.map(t => ({ 
                id: t.id, 
                type: t.type,
                invoiceNumber: t.invoiceNumber,
                description: t.description,
                pendingAmount: t.pendingAmount
            })));
            
            // Try different matching strategies since transaction structure might vary
            let matchingTransaction = pendingTransactions.find(t => {
                console.log('🔍 Testing match for transaction:', {
                    transactionId: t.id,
                    transactionIdStr: t.id.toString(),
                    targetId: invoiceId,
                    idMatch: t.id.toString() === invoiceId,
                    transactionType: t.type,
                    targetType: invoiceType,
                    typeMatch: t.type === invoiceType,
                    transactionInvoiceNumber: t.invoiceNumber,
                    targetInvoiceNumber: selectedInvoice.invoiceNumber,
                    invoiceNumberMatch: t.invoiceNumber === selectedInvoice.invoiceNumber
                });
                
                // Try exact ID match
                if (t.id.toString() === invoiceId) {
                    console.log('✅ MATCH FOUND - Exact ID match!');
                    return true;
                }
                
                // Try matching by transaction type and ID
                if (invoiceType === 'sale' && t.type === 'sale' && t.transactionId?.toString() === invoiceId) {
                    console.log('✅ MATCH FOUND - Sale type + ID match!');
                    return true;
                }
                if (invoiceType === 'purchase' && t.type === 'purchase' && t.transactionId?.toString() === invoiceId) {
                    console.log('✅ MATCH FOUND - Purchase type + ID match!');
                    return true;
                }
                
                // Try matching by invoice number
                if (t.invoiceNumber === selectedInvoice.invoiceNumber) {
                    console.log('✅ MATCH FOUND - Invoice number match!');
                    return true;
                }
                
                return false;
            });
            
            if (matchingTransaction) {
                const transactionId = matchingTransaction.id.toString();
                
                console.log('📝 Setting form values:', {
                    transactionId,
                    currentTransactionIds: validation.values.transactionIds,
                    settingTo: [transactionId]
                });
                
                // Auto-select the specific invoice using the toggle function for proper state management
                toggleTransactionSelection(transactionId);
                
                // Override the default amount with the specific remaining amount from the invoice  
                const remainingAmount = parseFloat(selectedInvoice.remainingAmount || 0);
                setTransactionAllocations(prev => ({
                    ...prev,
                    [transactionId]: remainingAmount
                }));
                
                setHasAutoSelected(true);
                
                console.log('✅ Auto-selection complete for transaction:', transactionId);
            } else {
                console.warn('❌ Selected invoice not found in pending transactions:', {
                    invoiceId,
                    invoiceType,
                    invoiceNumber: selectedInvoice.invoiceNumber,
                    availableTransactions: pendingTransactions.map(t => ({ 
                        id: t.id, 
                        type: t.type, 
                        transactionId: t.transactionId,
                        invoiceNumber: t.invoiceNumber
                    }))
                });
            }
        }
    }, [isOpen, selectedInvoice, isEditMode, pendingTransactions, invoiceType, hasAutoSelected]);

    const toggleTransactionSelection = (transactionId) => {
        // Ensure transactionId is always a string for consistency
        const transactionIdStr = transactionId.toString();
        
        const currentIds = [...validation.values.transactionIds];
        const index = currentIds.indexOf(transactionIdStr);
        
        console.log('🔄 Toggling transaction selection:', {
            transactionId: transactionIdStr,
            currentIds,
            index,
            action: index === -1 ? 'ADD' : 'REMOVE'
        });
        
        if (index === -1) {
            currentIds.push(transactionIdStr);
            const transaction = pendingTransactions.find(t => t.id.toString() === transactionIdStr);
            if (transaction) {
                // Always use the fresh pending amount from the API
                const defaultAmount = transaction.pendingAmount;
                setTransactionAllocations(prev => ({
                    ...prev,
                    [transactionIdStr]: parseAmount(defaultAmount)
                }));
                
                console.log('✅ Transaction added to selection:', {
                    transactionId: transactionIdStr,
                    defaultAmount,
                    newCurrentIds: currentIds
                });
            } else {
                console.error('❌ Transaction not found in pendingTransactions:', transactionIdStr);
            }
        } else {
            currentIds.splice(index, 1);
            setTransactionAllocations(prev => {
                const newAllocations = { ...prev };
                delete newAllocations[transactionIdStr];
                return newAllocations;
            });
            
            console.log('➖ Transaction removed from selection:', transactionIdStr);
        }
        validation.setFieldValue('transactionIds', currentIds);
    };

    const updateAllocationAmount = (transactionId, amount) => {
        const parsedAmount = amount === '' ? 0 : parseAmount(amount);
        setTransactionAllocations(prev => ({
            ...prev,
            [transactionId]: parsedAmount
        }));
    };

    // Updated form validation logic
    const isFormValid = validation.isValid &&
        validation.values.transactionIds.length > 0 &&
        !hasOverAllocation() &&
        !hasZeroAllocation();

    console.log('PaymentForm Debug:', {
        isValid: validation.isValid,
        hasTransactions: validation.values.transactionIds.length > 0,
        contactId: validation.values.contactId,
        bankId: validation.values.bankId,
        selectedTransactions: validation.values.transactionIds,
        pendingTransactionsCount: pendingTransactions.length,
        selectedInvoiceId: selectedInvoice?.id,
        hasAutoSelected,
        bankAccountsCount: bankAccounts.length,
        bankAccountsAvailable: bankAccounts.map(b => ({ id: b.id, name: b.accountName }))
    });

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="xl">
            <ModalHeader toggle={toggle}>
                {isEditMode ? 'Edit Payment' : 'Create Payment'}
            </ModalHeader>
            <ModalBody>
                <Form onSubmit={validation.handleSubmit}>
                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Date <span className="text-danger">*</span></Label>
                                <Input
                                    type="date"
                                    name="date"
                                    value={validation.values.date}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.date && !!validation.errors.date}
                                    disabled={isLoading}
                                />
                                <FormFeedback>{validation.errors.date}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Contact <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={contacts.map(formatOptions.contact)}
                                    value={getCurrentOption('contact', validation.values.contactId, contacts)}
                                    onChange={(option) => {
                                        validation.setFieldValue('contactId', option?.value || '');
                                        if (!isEditMode) {
                                            validation.setFieldValue('transactionIds', []);
                                            setTransactionAllocations({});
                                        }
                                    }}
                                    onBlur={() => validation.setFieldTouched('contactId', true)}
                                    className={`react-select-container ${validation.touched.contactId && validation.errors.contactId ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Contact"
                                    isDisabled={isLoading || isEditMode}
                                />
                                {validation.touched.contactId && validation.errors.contactId && (
                                    <div className="invalid-feedback d-block">{validation.errors.contactId}</div>
                                )}
                                {!validation.touched.contactId && validation.errors.contactId && (
                                    <div className="text-danger small">{validation.errors.contactId}</div>
                                )}
                            </FormGroup>
                        </Col>
                    </Row>

                    {/* Contact Billing Address Display */}
                    {validation.values.contactId && (() => {
                        const selectedContact = contacts.find(c => c.id === validation.values.contactId);
                        const hasBillingAddress = selectedContact && (
                            selectedContact.billingAddress1 || 
                            selectedContact.billingCity || 
                            selectedContact.billingState
                        );
                        
                        if (hasBillingAddress) {
                            return (
                                <Row className="mb-3">
                                    <Col md={12}>
                                        <div className="border rounded p-3 bg-light">
                                            <h6 className="text-muted mb-2">
                                                <i className="ri-map-pin-line me-2"></i>
                                                Contact Billing Address
                                            </h6>
                                            <div className="small">
                                                {selectedContact.billingAddress1 && (
                                                    <div>{selectedContact.billingAddress1}</div>
                                                )}
                                                {selectedContact.billingAddress2 && (
                                                    <div>{selectedContact.billingAddress2}</div>
                                                )}
                                                <div>
                                                    {[
                                                        selectedContact.billingCity,
                                                        selectedContact.billingState,
                                                        selectedContact.billingPincode
                                                    ].filter(Boolean).join(', ')}
                                                </div>
                                                {selectedContact.billingCountry && (
                                                    <div>{selectedContact.billingCountry}</div>
                                                )}
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            );
                        }
                        return null;
                    })()}

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Bank Account <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={bankAccounts.map(formatOptions.bank)}
                                    value={getCurrentOption('bank', validation.values.bankId, bankAccounts)}
                                    onChange={(option) => validation.setFieldValue('bankId', option?.value || '')}
                                    onBlur={() => validation.setFieldTouched('bankId', true)}
                                    className={`react-select-container ${validation.touched.bankId && validation.errors.bankId ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Bank Account"
                                    formatOptionLabel={(option) => (
                                        <div className="d-flex align-items-center">
                                            <span className={`text-${option.color} me-2`}>{option.icon}</span>
                                            <span>{option.label}</span>
                                        </div>
                                    )}
                                    isDisabled={isLoading}
                                />
                                {validation.touched.bankId && validation.errors.bankId && (
                                    <div className="invalid-feedback d-block">{validation.errors.bankId}</div>
                                )}
                                {!validation.touched.bankId && validation.errors.bankId && (
                                    <div className="text-danger small">{validation.errors.bankId}</div>
                                )}
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Description</Label>
                                <Input
                                    type="textarea"
                                    name="description"
                                    rows="2"
                                    value={validation.values.description}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    placeholder="Purpose of the payment"
                                    invalid={validation.touched.description && !!validation.errors.description}
                                    disabled={isLoading}
                                />
                                <FormFeedback>{validation.errors.description}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Adjustment Type <span className="text-danger">*</span></Label>
                                <ReactSelect
                                    options={adjustmentOptions}
                                    value={adjustmentOptions.find(opt => opt.value === validation.values.adjustmentType)}
                                    onChange={(option) => {
                                        validation.setFieldValue('adjustmentType', option?.value || 'none');
                                        if (option?.value === 'none') validation.setFieldValue('adjustmentValue', 0);
                                    }}
                                    onBlur={() => validation.setFieldTouched('adjustmentType', true)}
                                    className={`react-select-container ${validation.touched.adjustmentType && validation.errors.adjustmentType ? 'is-invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select Adjustment Type"
                                    isDisabled={isLoading}
                                />
                                {validation.touched.adjustmentType && validation.errors.adjustmentType && (
                                    <div className="invalid-feedback d-block">{validation.errors.adjustmentType}</div>
                                )}
                                {!validation.touched.adjustmentType && validation.errors.adjustmentType && (
                                    <div className="text-danger small">{validation.errors.adjustmentType}</div>
                                )}
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>
                                    {validation.values.adjustmentType === 'discount' ? 'Discount Amount' :
                                        validation.values.adjustmentType === 'extra_receipt' ? 'Extra Receipt Amount' :
                                            validation.values.adjustmentType === 'surcharge' ? 'Surcharge Amount' :
                                                'Adjustment Value'}
                                    {validation.values.adjustmentType !== 'none' && <span className="text-danger"> *</span>}
                                </Label>
                                <Input
                                    type="number"
                                    name="adjustmentValue"
                                    min="0"
                                    step="0.01"
                                    value={validation.values.adjustmentValue}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    disabled={isLoading || validation.values.adjustmentType === 'none'}
                                    invalid={validation.touched.adjustmentValue && !!validation.errors.adjustmentValue}
                                />
                                <FormFeedback>{validation.errors.adjustmentValue}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    <div className="mb-4">
                        <h5 className="mb-3">
                            {isEditMode ? 'Payment Allocations' : 'Pending Transactions'}
                        </h5>

                        {isLoadingTransactions ? (
                            <div className="text-center py-3">
                                <RiLoader4Line className="spin" />
                                <span className="ms-2">Loading transactions...</span>
                            </div>
                        ) : pendingTransactions.length > 0 ? (
                            <>
                                <Table bordered responsive>
                                    <thead>
                                        <tr>
                                            <th width="50px"></th>
                                            <th>Description</th>
                                            <th>Transaction Type</th>
                                            <th>Date</th>
                                            <th>Pending Amount</th>
                                            <th>Balance Type</th>
                                            <th width="150px">Payment Amount (Max: Original/New)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingTransactions.map((transaction) => {
                                            const isSelected = validation.values.transactionIds.includes(transaction.id.toString());
                                            const allocatedAmount = parseAmount(transactionAllocations[transaction.id.toString()] || 0);
                                            // Check if this transaction was part of the original payment
                                            const isOriginalTransaction = selectedPayment?.allocations?.some(allocation => 
                                                allocation.transactionId === transaction.id || 
                                                allocation.purchaseId === transaction.id || 
                                                allocation.saleId === transaction.id || 
                                                allocation.expenseId === transaction.id || 
                                                allocation.incomeId === transaction.id
                                            );
                                            const maxAmount = (isEditMode && isOriginalTransaction) ? (transaction.paidAmount + transaction.pendingAmount) : transaction.pendingAmount;
                                            const isOverAllocated = allocatedAmount > maxAmount;
                                            const isZeroAllocated = isSelected && allocatedAmount <= 0;
                                            const typeDisplay = getTransactionTypeDisplay(transaction);
                                            const description = getTransactionDescription(transaction);

                                            return (
                                                <tr key={transaction.id} className={isSelected ? 'table-active' : ''}>
                                                    <td>
                                                        <Input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleTransactionSelection(transaction.id)}
                                                            disabled={isLoading}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div>
                                                            <div className="fw-medium">{description}</div>
                                                            {transaction.notes && (
                                                                <small className="text-muted">{transaction.notes}</small>
                                                            )}
                                                            {transaction.dueDate && (
                                                                <div className="mt-1">
                                                                    <small className="text-warning">
                                                                        <RiCalendarLine className="me-1" size={12} />
                                                                        Due: {new Date(transaction.dueDate).toLocaleDateString()}
                                                                    </small>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <Badge color={typeDisplay.color} className="d-flex align-items-center w-fit">
                                                            {typeDisplay.icon}
                                                            {typeDisplay.label}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        {transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td>
                                                        <strong>₹{formatAmount(transaction.pendingAmount)}</strong>
                                                    </td>
                                                    <td>
                                                        <Badge color={transaction.balanceType === 'payable' ? 'warning' : 'success'}>
                                                            {transaction.balanceType === 'payable' ? 'Payable' : 'Receivable'}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        {isSelected ? (
                                                            <div>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max={maxAmount}
                                                                    value={allocatedAmount || ''}
                                                                    onChange={(e) => updateAllocationAmount(transaction.id, e.target.value)}
                                                                    disabled={isLoading}
                                                                    invalid={isOverAllocated || isZeroAllocated}
                                                                />
                                                                <small className="text-muted">Max: ₹{formatAmount(maxAmount)}</small>
                                                                {isOverAllocated && (
                                                                    <div className="text-danger small">Exceeds maximum amount</div>
                                                                )}
                                                                {isZeroAllocated && (
                                                                    <div className="text-danger small">Amount must be greater than 0</div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted">Select to pay</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>

                                {validation.values.transactionIds.length > 0 && (
                                    <Card className="mt-3">
                                        <CardBody className="bg-light">
                                            <Row>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">Total Receivable</div>
                                                    <div className="h5 text-success">₹{formatAmount(calculations.totalReceivable())}</div>
                                                </Col>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">Total Payable</div>
                                                    <div className="h5 text-warning">₹{formatAmount(calculations.totalPayable())}</div>
                                                </Col>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">
                                                        {validation.values.adjustmentType === 'discount' ? 'Discount' :
                                                            validation.values.adjustmentType === 'extra_receipt' ? 'Extra Receipt' :
                                                                validation.values.adjustmentType === 'surcharge' ? 'Surcharge' : 'Adjustment'}
                                                    </div>
                                                    <div className={`h5 ${validation.values.adjustmentType === 'discount' ? 'text-success' : 'text-danger'}`}>
                                                        {validation.values.adjustmentType === 'discount' ? '-' : '+'}₹{formatAmount(calculations.adjustmentImpact())}
                                                    </div>
                                                </Col>
                                                <Col md={3} className="text-center">
                                                    <div className="text-muted small">{calculations.bankImpact().label}</div>
                                                    <div className={`h5 ${calculations.bankImpact().type === 'receivable' ? 'text-success' : 'text-danger'}`}>
                                                        ₹{formatAmount(calculations.bankImpact().amount)}
                                                    </div>
                                                </Col>
                                            </Row>
                                        </CardBody>
                                    </Card>
                                )}
                            </>
                        ) : (
                            <div className="text-muted py-3 text-center">
                                {validation.values.contactId ? "No pending transactions found" : "Select a contact to view transactions"}
                            </div>
                        )}

                        {/* Enhanced validation messages */}
                        {validation.values.transactionIds.length === 0 && validation.errors.transactionIds && (
                            <div className="text-danger small mt-2">At least one transaction must be selected</div>
                        )}
                        {hasOverAllocation() && (
                            <div className="text-danger small mt-2">Some allocated amounts exceed the maximum allowed</div>
                        )}
                        {hasZeroAllocation() && (
                            <div className="text-danger small mt-2">All selected transactions must have an amount greater than 0</div>
                        )}
                    </div>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button color="light" onClick={toggle} disabled={isLoading}>
                    Cancel
                </Button>
                <Button
                    color="primary"
                    type="submit"
                    onClick={validation.handleSubmit}
                    disabled={isLoading || !isFormValid}
                >
                    {isLoading ? (
                        <>
                            <RiLoader4Line className="spin me-1" />
                            {isEditMode ? 'Updating...' : 'Creating...'}
                        </>
                    ) : isEditMode ? 'Update Payment' : 'Create Payment'}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default PaymentForm;
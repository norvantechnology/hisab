import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Form,
    FormGroup,
    Label,
    Input,
    Button,
    Row,
    Col,
    Table,
    Card,
    CardBody,
    Alert,
    InputGroup,
    InputGroupText,
    FormFeedback,
    Badge,
    Collapse
} from 'reactstrap';
import { 
    RiAddLine, 
    RiDeleteBinLine, 
    RiSaveLine, 
    RiCloseLine, 
    RiLoader4Line, 
    RiEditLine, 
    RiArrowDownSLine,
    RiArrowUpSLine
} from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";
import { toast } from 'react-toastify';
import { TAX_TYPES, DISCOUNT_TYPES, DISCOUNT_VALUE_TYPES, STATUS_OPTIONS, ITEM_RATE_TYPES } from './contant';
import { listProducts } from '../../../services/products';
import { getNextInvoiceNumber } from '../../../services/salesInvoice';
import BankAccountContactDropdown from '../../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../../Common/BankAccountDropdown';
import { calculateItemTaxAndTotal } from '../../../utils/taxCalculations';

const FastSalesInvoiceForm = ({
    isOpen,
    toggle,
    isEditMode = false,
    selectedInvoice = null,
    onSubmit,
    isLoading = false,
    apiError = null
}) => {
    // All state declarations first
    const [items, setItems] = useState([]);
    const [newItem, setNewItem] = useState({
        id: null,
        productId: null,
        productName: '',
        productCode: '',
        quantity: 0,
        rate: 0,
        taxRate: 0,
        discountType: 'rupees',
        discountValue: 0,
        rateType: 'without_tax',
        isSerialized: false,
        serialNumbers: [],
        availableSerialNumbers: [],
        currentStock: 0,
        calculatedTotal: 0,
        calculatedTaxAmount: 0,
        calculatedDiscount: 0
    });

    // Serial number management
    const [newSerialNumber, setNewSerialNumber] = useState('');

    // Product search states
    const [productSearch, setProductSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [isProductSelected, setIsProductSelected] = useState(false);
    const fetchProductsRef = useRef(false);
    const lastSearchTermRef = useRef('');
    const lastPageRef = useRef(1);

    // Other states
    const [suggestedInvoiceNumber, setSuggestedInvoiceNumber] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCharges, setShowCharges] = useState(false);
    const [showAllSerials, setShowAllSerials] = useState(false);

    // Validation schema
    const validationSchema = useMemo(() => Yup.object({
        invoiceNumber: Yup.string().required('Invoice number is required'),
        date: Yup.date().required('Date is required'),
        billTo: Yup.string().required('Bill to is required'),
        billToBank: Yup.string().when(['status', 'billTo'], {
            is: (status, billTo) => status === 'paid' && billTo && billTo.startsWith('contact_'),
            then: (schema) => schema.required('Bank account is required when status is paid and customer is a contact'),
            otherwise: (schema) => schema
        }),
        taxType: Yup.string().required('Tax type is required'),
        rateType: Yup.string().when('taxType', {
            is: (taxType) => {
                const selectedTax = TAX_TYPES.find(tax => tax.value === taxType);
                return selectedTax && selectedTax.rate > 0;
            },
            then: (schema) => schema.required('Rate type is required'),
            otherwise: (schema) => schema
        }),
        discountType: Yup.string().required('Discount type is required'),
        discountValueType: Yup.string().when('discountType', {
            is: (type) => type && type !== 'none',
            then: (schema) => schema.required('Discount value type is required'),
            otherwise: (schema) => schema
        }),
        discountValue: Yup.number().when('discountType', {
            is: (type) => type && type !== 'none' && (type === 'on_invoice' || type === 'per_item_and_invoice'),
            then: (schema) => schema.min(0, 'Discount value cannot be negative').required('Discount value is required'),
            otherwise: (schema) => schema
        }),
        status: Yup.string().when('billTo', {
            is: (billTo) => billTo && billTo.startsWith('contact_'),
            then: (schema) => schema.required('Status is required'),
            otherwise: (schema) => schema
        }),
        internalNotes: Yup.string().max(250, 'Notes cannot exceed 250 characters'),
        transportationCharge: Yup.number().nullable().min(0, 'Transportation charge cannot be negative'),
    }), []);

    // Formik validation object
    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: selectedInvoice?.id || null, // Include ID for edit mode
            invoiceNumber: selectedInvoice?.invoiceNumber || '',
            date: selectedInvoice?.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0],
            billTo: selectedInvoice?.contact?.id ? `contact_${selectedInvoice.contact.id}` : 
                   selectedInvoice?.bankAccount?.id ? `bank_${selectedInvoice.bankAccount.id}` : '',
            billToBank: selectedInvoice?.bankAccount?.id && selectedInvoice?.contact?.id ? 
                       selectedInvoice.bankAccount.id.toString() : '',
            taxType: selectedInvoice?.taxType || 'no_tax',
            rateType: selectedInvoice?.rateType || 'without_tax',
            discountType: selectedInvoice?.discountScope || selectedInvoice?.discountType || 'none', // Use discountScope from new schema
            discountValueType: selectedInvoice?.discountValueType || 'rupees',
            discountValue: selectedInvoice?.discountValue || 0,
            status: selectedInvoice?.status || 'pending',
            internalNotes: selectedInvoice?.internalNotes || '',
            transportationCharge: selectedInvoice?.transportationCharge || '',
            roundOff: selectedInvoice?.roundOff || 0
        },
        validationSchema,
        onSubmit: async (values) => {
            if (items.length === 0) {
                toast.error('Please add at least one item');
                return;
            }

            try {
                setIsSubmitting(true);
                const calculatedValues = calculateInvoiceTotals(values, items);
                await onSubmit(calculatedValues);
            } catch (error) {
                console.error('Error submitting form:', error);
            } finally {
                setIsSubmitting(false);
            }
        }
    });

    // Update new item calculations in real-time
    const updateNewItemCalculations = useCallback((updatedItem) => {
        const quantity = updatedItem.isSerialized ? (updatedItem.serialNumbers || []).length : parseFloat(updatedItem.quantity) || 0;
        const rate = parseFloat(updatedItem.rate) || 0;
        const taxRate = parseFloat(updatedItem.taxRate) || 0;
        const discountRate = parseFloat(updatedItem.discountValue) || 0;
        const rateType = validation.values.rateType || updatedItem.rateType || 'without_tax'; // Use form's rateType first

        // Check if tax should be calculated based on form's tax type
        const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
        const shouldCalculateTax = selectedTax && selectedTax.rate > 0;

        if (quantity > 0 && rate > 0) {
            try {
                const result = calculateItemTaxAndTotal({
                    rate,
                    quantity,
                    taxRate: shouldCalculateTax ? taxRate : 0,
                    discountRate,
                    rateType,
                    discountValueType: 'percentage', // Sales invoices use percentage discount
                    discountValue: discountRate
                });

                return {
                    ...updatedItem,
                    calculatedTotal: result.total || 0,
                    calculatedTaxAmount: shouldCalculateTax ? (result.taxAmount || 0) : 0,
                    calculatedDiscount: result.discount || 0
                };
            } catch (error) {
                console.error('Calculation error:', error);
            }
        }

        return {
            ...updatedItem,
            calculatedTotal: 0,
            calculatedTaxAmount: 0,
            calculatedDiscount: 0
        };
    }, [validation.values.rateType, validation.values.taxType]);

    // Handle new item field changes with live calculation
    const handleNewItemChange = useCallback((field, value) => {
        setNewItem(prev => {
            let updatedItem = { ...prev, [field]: value };
            return updateNewItemCalculations(updatedItem);
        });
    }, [updateNewItemCalculations]);

    // Handle product search changes - clear product data when search is cleared
    const handleProductSearchChange = useCallback((value) => {
        setProductSearch(value);
        setIsProductSelected(false);
        
        // If search field is cleared or becomes empty, reset product data
        if (!value || value.trim() === '') {
            setNewItem(prev => ({
                ...prev,
                productId: null,
                productName: '',
                productCode: '',
                rate: 0,
                taxRate: 0,
                isSerialized: false,
                availableSerialNumbers: [],
                serialNumbers: [],
                currentStock: 0,
                quantity: 0,
                calculatedTotal: 0,
                calculatedTaxAmount: 0,
                calculatedDiscount: 0
            }));
            setNewSerialNumber('');
        }
    }, []);

    // Edit existing item
    const editItem = useCallback((item) => {
        // Use the rate as stored - no conversion needed
        const displayRate = parseFloat(item.rate || 0);

        setNewItem({
            id: item.id,
            productId: item.productId,
            productName: item.productName || item.name,
            productCode: item.productCode || item.code,
            quantity: item.quantity,
            rate: displayRate,
            taxRate: item.taxRate,
            discountType: item.discountType || 'rupees',
            discountValue: item.discountValue || 0,
            rateType: validation.values.rateType || 'without_tax',
            isSerialized: item.isSerialized || false,
            serialNumbers: item.serialNumbers || [],
            availableSerialNumbers: [],
            currentStock: item.currentStock || 0,
            calculatedTotal: item.lineTotal || item.total || 0,
            calculatedTaxAmount: item.taxAmount || 0,
            calculatedDiscount: item.discount || 0
        });
        
        setProductSearch(item.productName || item.name);
        setIsProductSelected(true);
        setItems(prev => prev.filter(i => i.id !== item.id));
        setHasChanges(true); // Mark that changes have been made when editing
        
        if (item.isSerialized) {
            setTimeout(() => document.getElementById('serialNumberInput')?.focus(), 100);
        } else {
            setTimeout(() => document.getElementById('quantityInput')?.focus(), 100);
        }
    }, [validation.values.rateType]);

    // Select from available serial numbers (SALES - select existing serial numbers)
    const selectAvailableSerial = useCallback((serialNumber) => {
        if (newItem.serialNumbers.includes(serialNumber)) {
            toast.warning('Serial number already selected');
            return;
        }

        setNewItem(prev => {
            const updatedSerialNumbers = [...prev.serialNumbers, serialNumber];
            const updatedItem = {
                ...prev,
                serialNumbers: updatedSerialNumbers,
                quantity: updatedSerialNumbers.length
            };
            
            return updateNewItemCalculations(updatedItem);
        });
    }, [newItem.serialNumbers, updateNewItemCalculations]);

    // Remove serial number from selection
    const removeSerialNumber = useCallback((serialToRemove) => {
        setNewItem(prev => {
            const updatedSerialNumbers = prev.serialNumbers.filter(serial => serial !== serialToRemove);
            const updatedItem = {
                ...prev,
                serialNumbers: updatedSerialNumbers,
                quantity: updatedSerialNumbers.length
            };
            
            return updateNewItemCalculations(updatedItem);
        });
    }, [updateNewItemCalculations]);

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        if (!productSearch || productSearch.trim() === '' || isProductSelected) return [];
        
        const filtered = products.filter(product => 
            product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            product.itemCode?.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 5);
        
        return filtered;
    }, [products, productSearch, isProductSelected]);

    // Fetch next invoice number
    const fetchNextInvoiceNumber = useCallback(async () => {
        if (!isEditMode) {
            try {
                const response = await getNextInvoiceNumber();
                if (response.success && response.nextInvoiceNumber) {
                    setSuggestedInvoiceNumber(response.nextInvoiceNumber);
                }
            } catch (error) {
                console.error('Error fetching next invoice number:', error);
            }
        }
    }, [isEditMode]);

    // Fetch products
    const fetchProducts = useCallback(async (page = 1, search = '', reset = false) => {
        if (fetchProductsRef.current) return;

        if (page === lastPageRef.current && search === lastSearchTermRef.current && !reset) {
            return;
        }

        fetchProductsRef.current = true;

        if (page === 1 || reset) {
            setLoadingProducts(true);
        } else {
            setIsFetchingMore(true);
        }

        try {
            const response = await listProducts({
                page,
                limit: 10,
                search,
                includeSerialNumbers: true
            });

            if (reset || page === 1) {
                setProducts(response.products || []);
            } else {
                setProducts(prev => [...prev, ...(response.products || [])]);
            }

            setPagination(response.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
            lastPageRef.current = page;
            lastSearchTermRef.current = search;

        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoadingProducts(false);
            setIsFetchingMore(false);
            fetchProductsRef.current = false;
        }
    }, []);

    // Calculate invoice totals
    const calculateInvoiceTotals = useCallback((values, itemsData) => {
        // Calculate basic amount as Rate × Qty (before any discounts/tax)
        const basicAmount = itemsData.reduce((sum, item) => {
            const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity);
            const rate = parseFloat(item.rate) || 0;
            return sum + (quantity * rate);
        }, 0);
        
        // Calculate total item-level discounts
        const totalItemDiscount = itemsData.reduce((sum, item) => {
            return sum + (parseFloat(item.discount) || 0);
        }, 0);
        
        // Calculate invoice-level discount on basicAmount (not on item totals)
        let invoiceDiscount = 0;
        if (values.discountType === 'on_invoice' || values.discountType === 'per_item_and_invoice') {
            if (values.discountValueType === 'percentage') {
                // Apply percentage discount on basicAmount + tax
                const itemTotalsSum = itemsData.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
                invoiceDiscount = (itemTotalsSum * parseFloat(values.discountValue)) / 100;
            } else if (values.discountValueType === 'rupees') {
                invoiceDiscount = parseFloat(values.discountValue);
            }
        }
        
        // Total discount = item-level + invoice-level
        const totalDiscount = totalItemDiscount + invoiceDiscount;
        
        // Use actual tax amounts from items (already calculated correctly)
        const totalTax = itemsData.reduce((sum, item) => {
            return sum + (parseFloat(item.taxAmount) || 0);
        }, 0);

        const transportationCharge = parseFloat(values.transportationCharge || 0);
        const roundOff = parseFloat(values.roundOff || 0);
        
        // Calculate netReceivable: itemTotals - invoiceDiscount + charges
        const itemTotalsSum = itemsData.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
        const netReceivable = itemTotalsSum - invoiceDiscount + transportationCharge + roundOff;

        // Extract contactId and bankAccountId from billTo
        const billToParts = values.billTo.split('_');
        const billToType = billToParts[0];
        const billToId = billToParts[1];

        const payload = {
            // Map to sales table fields
            invoiceNumber: values.invoiceNumber,
            invoiceDate: values.date,
            contactId: billToType === 'contact' ? parseInt(billToId) : null,
            bankAccountId: billToType === 'bank' ? parseInt(billToId) : 
                          (values.status === 'paid' && values.billToBank ? parseInt(values.billToBank) : null),
            taxType: values.taxType,
            rateType: values.rateType,
            discountScope: values.discountType, // maps to discountScope in DB
            discountValueType: values.discountValueType,
            discountValue: parseFloat((parseFloat(values.discountValue) || 0).toFixed(2)),
            status: values.status,
            internalNotes: values.internalNotes,
            transportationCharge: parseFloat(transportationCharge.toFixed(2)),
            roundOff: parseFloat(roundOff.toFixed(2)),
            basicAmount: parseFloat(basicAmount.toFixed(2)),
            totalItemDiscount: parseFloat(totalItemDiscount.toFixed(2)),
            invoiceDiscount: parseFloat(invoiceDiscount.toFixed(2)),
            totalDiscount: parseFloat(totalDiscount.toFixed(2)),
            taxAmount: parseFloat(totalTax.toFixed(2)),
            netReceivable: parseFloat(netReceivable.toFixed(2)),
            
            // Items array
            items: itemsData.map(item => {
                const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity);
                const rate = parseFloat((parseFloat(item.rate) || 0).toFixed(2));
                const lineBasic = parseFloat((quantity * rate).toFixed(2));
                
                return {
                    productId: item.productId,
                    quantity: quantity,
                    rate: rate,
                    rateType: item.rateType || values.rateType,
                    discountType: item.discountType || 'rupees',
                    discountValue: parseFloat((parseFloat(item.discountValue) || 0).toFixed(2)),
                    discountAmount: parseFloat((parseFloat(item.discount) || 0).toFixed(2)),
                    taxRate: parseFloat(item.taxRate) || 0,
                    taxAmount: parseFloat((parseFloat(item.taxAmount) || 0).toFixed(2)),
                    lineBasic: lineBasic,
                    lineTotal: parseFloat((parseFloat(item.total) || 0).toFixed(2)),
                    isSerialized: item.isSerialized || false,
                    ...(item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0 && {
                        serialNumbers: item.serialNumbers.map(serial => ({
                            serialNumber: serial
                        }))
                    })
                };
            }),
            
            // Add id at the bottom for edit mode
            ...(values.id && { id: values.id })
        };

        return payload;
    }, []);

    // Track if any changes have been made since opening edit mode
    const [hasChanges, setHasChanges] = useState(false);

    // Handle form field changes and track modifications
    const handleFormFieldChange = useCallback((field, value) => {
        validation.setFieldValue(field, value);
        setHasChanges(true); // Mark that changes have been made
    }, []);

    // Calculate totals for display
    const totals = useMemo(() => {
        // Calculate subtotal as Rate × Qty (before tax and discount)
        const subtotal = items.reduce((sum, item) => {
            const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity) || 0;
            const rate = parseFloat(item.rate) || 0;
            return sum + (quantity * rate);
        }, 0);
        
        // Calculate total item-level discounts
        const itemLevelDiscounts = items.reduce((sum, item) => {
            return sum + (parseFloat(item.discountAmount || item.discount) || 0);
        }, 0);
        
        // Basic amount is the sum of item totals (after item-level discounts and tax)
        const basicAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
        
        // Calculate invoice-level discount
        let invoiceLevelDiscount = 0;
        if (validation.values.discountType === 'on_invoice' || validation.values.discountType === 'per_item_and_invoice') {
            if (validation.values.discountValueType === 'percentage') {
                invoiceLevelDiscount = (basicAmount * validation.values.discountValue) / 100;
            } else if (validation.values.discountValueType === 'rupees') {
                invoiceLevelDiscount = validation.values.discountValue;
            }
        }
        
        // Total discount = item-level + invoice-level discounts
        const totalDiscount = itemLevelDiscounts + invoiceLevelDiscount;
        
        // Calculate tax amount - use the sum of tax amounts from items (already calculated correctly)
        const taxAmount = items.reduce((sum, item) => {
            return sum + (parseFloat(item.taxAmount) || 0);
        }, 0);
        
        const transportationCharge = parseFloat(validation.values.transportationCharge || 0);
        const roundOff = parseFloat(validation.values.roundOff || 0);
        
        // In edit mode, use original netReceivable only if no changes have been made
        // If changes have been made, calculate live
        let netReceivable;
        if (isEditMode && selectedInvoice?.netReceivable !== undefined && !hasChanges) {
            netReceivable = parseFloat(selectedInvoice.netReceivable || 0);
        } else {
            // Calculate netReceivable live when changes are made
            netReceivable = basicAmount - invoiceLevelDiscount + transportationCharge + roundOff;
        }
        
        return { 
            subtotal, // Rate × Qty before tax and discount
            basicAmount, // Item totals after item-level processing
            itemLevelDiscounts, // Sum of all item-level discounts
            invoiceLevelDiscount, // Invoice-level discount
            totalDiscount, // Combined discount for display
            taxAmount, // Sum of actual tax amounts from items
            transportationCharge, 
            roundOff, 
            netReceivable 
        };
    }, [items, validation.values.discountType, validation.values.discountValueType, validation.values.discountValue, validation.values.taxType, validation.values.transportationCharge, validation.values.roundOff, isEditMode, selectedInvoice?.netReceivable, hasChanges]);

    // Add item to list with rate conversion for "With Tax"
    const addItem = useCallback(() => {
        // Validation for serialized vs non-serialized products
        if (!newItem.productName || parseFloat(newItem.rate) <= 0) {
            toast.warning('Please select a product and enter a rate');
            return;
        }

        if (newItem.isSerialized) {
            if (newItem.serialNumbers.length === 0) {
                toast.warning('Please select at least one serial number for this serialized product');
                return;
            }
        } else {
            if (parseFloat(newItem.quantity) <= 0) {
                toast.warning('Please enter a valid quantity');
                return;
            }
            // Check stock for non-serialized products
            if (parseFloat(newItem.quantity) > parseFloat(newItem.currentStock)) {
                toast.error(`Insufficient stock. Available: ${newItem.currentStock}, Required: ${newItem.quantity}`);
                return;
            }
        }

        const quantity = newItem.isSerialized ? newItem.serialNumbers.length : parseFloat(newItem.quantity) || 0;
        let rate = parseFloat(newItem.rate) || 0;
        const taxRate = parseFloat(newItem.taxRate) || 0;
        const discountRate = parseFloat(newItem.discountValue) || 0;

        // For "With Tax", the user enters the desired total (inclusive of tax)
        // For "Without Tax", the user enters the base rate (before tax)
        // The calculation function handles both cases correctly based on rateType

        // Calculate final values
        const result = calculateItemTaxAndTotal({
            rate: rate, // Use the rate as entered by user
            quantity,
            taxRate: validation.values.taxType && TAX_TYPES.find(tax => tax.value === validation.values.taxType)?.rate > 0 ? taxRate : 0,
            discountRate,
            rateType: validation.values.rateType,
            discountValueType: 'percentage', // Sales invoices use percentage discount
            discountValue: discountRate
        });

        const item = {
            id: newItem.id || Date.now() + Math.random(),
            productId: newItem.productId,
            productName: newItem.productName,
            name: newItem.productName,
            productCode: newItem.productCode,
            code: newItem.productCode,
            quantity: quantity,
            rate: rate, // Store the rounded base rate
            rateType: validation.values.rateType || 'without_tax',
            taxRate: taxRate,
            taxAmount: parseFloat((result.taxAmount || 0).toFixed(2)),
            discount: parseFloat((result.discount || 0).toFixed(2)),
            discountType: newItem.discountType,
            discountValue: discountRate,
            total: parseFloat((result.total || 0).toFixed(2)),
            isSerialized: newItem.isSerialized,
            serialNumbers: newItem.serialNumbers || [],
            currentStock: newItem.currentStock || 0
        };

        setItems(prev => [...prev, item]);
        
        // Mark that changes have been made (for edit mode)
        setHasChanges(true);
        
        // Reset new item form
        setNewItem({
            id: null,
            productId: null,
            productName: '',
            productCode: '',
            quantity: 0,
            rate: 0,
            taxRate: 0,
            discountType: 'rupees',
            discountValue: 0,
            rateType: validation.values.rateType || 'without_tax',
            isSerialized: false,
            serialNumbers: [],
            availableSerialNumbers: [],
            currentStock: 0,
            calculatedTotal: 0,
            calculatedTaxAmount: 0,
            calculatedDiscount: 0
        });
        setProductSearch('');
        setIsProductSelected(false);
        setNewSerialNumber('');
        
        setTimeout(() => document.getElementById('productSearch')?.focus(), 100);
    }, [newItem, validation.values.rateType, validation.values.taxType]);

    // Remove item
    const removeItem = (itemId) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
        setHasChanges(true); // Mark that changes have been made
    };

    // Quick product selection
    const selectProduct = useCallback((product) => {
        const productStock = parseFloat(product.currentStock) || 0;
        
        // Check if product has zero stock
        if (productStock === 0) {
            toast.warning(`"${product.name}" is out of stock. Current stock: ${productStock}`);
            return;
        }
        
        const productRate = parseFloat(product.sellingPrice || product.rate) || 0; // Use sellingPrice for sales
        
        // Only use product's tax rate if a tax type with rate > 0 is selected
        const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
        const shouldUseTax = selectedTax && selectedTax.rate > 0;
        const defaultTaxRate = shouldUseTax ? (parseFloat(product.taxRate) || 0) : 0;
        
        setNewItem(prev => {
            const updatedItem = {
            ...prev,
                productId: product.id,
            productName: product.name,
            productCode: product.itemCode || '',
                rate: productRate,
                taxRate: defaultTaxRate,
                isSerialized: product.isSerialized || false,
                availableSerialNumbers: product.availableSerialNumbers || [],
                currentStock: parseFloat(product.currentStock) || 0,
                rateType: validation.values.rateType || 'without_tax',
                serialNumbers: [],
                quantity: product.isSerialized ? 0 : 1 // Set quantity to 1 for non-serialized products
            };
            
            return updateNewItemCalculations(updatedItem);
        });
        
        setProductSearch(product.name);
        setIsProductSelected(true);
        
        if (product.isSerialized) {
            setTimeout(() => document.getElementById('serialNumberInput')?.focus(), 100);
        } else {
        setTimeout(() => document.getElementById('quantityInput')?.focus(), 100);
        }
    }, [updateNewItemCalculations, validation.values.rateType, validation.values.taxType]);

    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addItem();
        } else if (e.key === 'Enter' && e.target.id === 'productSearch') {
            e.preventDefault();
            if (filteredProducts.length > 0) {
                selectProduct(filteredProducts[0]);
            }
        } else if (e.key === 'Escape' && e.target.id === 'productSearch') {
            setProductSearch('');
            setIsProductSelected(false);
        } else if (e.key === 's' && e.ctrlKey) {
            e.preventDefault();
            validation.handleSubmit();
        }
    };

    // Add global keyboard listener
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (isOpen && e.key === 's' && e.ctrlKey) {
                e.preventDefault();
                validation.handleSubmit();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleGlobalKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [isOpen, validation]);

    // Event handlers
    const handleBillToChange = useCallback((selectedOption) => {
        validation.setFieldValue('billTo', selectedOption?.value || '');
        if (!selectedOption?.value?.startsWith('contact_')) {
            validation.setFieldValue('billToBank', '');
            setSelectedContact(null);
        } else {
            setSelectedContact(selectedOption?.contact || null);
        }
    }, []);

    const handleBillToBankChange = useCallback((selectedOption) => {
        validation.setFieldValue('billToBank', selectedOption?.value || '');
    }, []);

    const handleTaxTypeChange = useCallback((e) => {
        const newTaxType = e.target.value;
        validation.setFieldValue('taxType', newTaxType);
        
        const selectedTax = TAX_TYPES.find(tax => tax.value === newTaxType);
        if (!selectedTax || selectedTax.rate === 0) {
            validation.setFieldValue('rateType', '');
        } else if (!validation.values.rateType) {
            validation.setFieldValue('rateType', 'without_tax');
        }
    }, []);

    const handleRateTypeChange = useCallback((e) => {
        const newRateType = e.target.value;
        validation.setFieldValue('rateType', newRateType);
        
        setNewItem(prev => updateNewItemCalculations({ ...prev, rateType: newRateType }));
        
        // Update existing items
        if (items.length > 0) {
            const updatedItems = items.map(item => {
                const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity) || 0;
                let rate = parseFloat(item.rate) || 0;
                const taxRate = parseFloat(item.taxRate) || 0;
                const discountRate = parseFloat(item.discountValue) || 0;
                
                // Convert rate based on rate type interpretation
                if (newRateType === 'with_tax' && item.rateType === 'without_tax' && rate > 0 && taxRate > 0) {
                    // Switching from "Without Tax" to "With Tax"
                    // Current rate is base rate, but for "With Tax" we need the total as the rate
                    // So: new rate = base rate * (1 + tax%)
                    rate = rate * (1 + (taxRate / 100));
                } else if (newRateType === 'without_tax' && item.rateType === 'with_tax' && rate > 0 && taxRate > 0) {
                    // Switching from "With Tax" to "Without Tax"  
                    // Current rate represents total, but for "Without Tax" we need base rate
                    // So: new rate = total / (1 + tax%)
                    rate = rate / (1 + (taxRate / 100));
                }
                
                const result = calculateItemTaxAndTotal({
                    rate,
                    quantity,
                    taxRate,
                    discountRate,
                    rateType: newRateType,
                    discountValueType: 'percentage', // Sales invoices use percentage discount
                    discountValue: discountRate
                });
                
                return {
                    ...item,
                    rate: parseFloat(rate.toFixed(2)), // Round to avoid precision errors
                    rateType: newRateType, // Update item's rate type to match invoice
                    taxAmount: result.taxAmount,
                    discount: result.discount,
                    total: result.total
                };
            });
            
            setItems(updatedItems);
        }
    }, [items, updateNewItemCalculations]);

    const handleStatusChange = useCallback((e) => {
        const newStatus = e.target.value;
        validation.setFieldValue('status', newStatus);
        
        if (newStatus === 'pending' && validation.values.billToBank) {
            validation.setFieldValue('billToBank', '');
        }
    }, []);

    // Conditional display logic
    const shouldShowStatusDropdown = useMemo(() => {
        return validation.values.billTo && validation.values.billTo.startsWith('contact_');
    }, [validation.values.billTo]);

    const shouldShowBankAccountDropdown = useMemo(() => {
        return validation.values.status === 'paid' && 
               validation.values.billTo && 
               validation.values.billTo.startsWith('contact_');
    }, [validation.values.status, validation.values.billTo]);

    const shouldShowTaxRate = useMemo(() => {
        const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
        return selectedTax && selectedTax.rate > 0;
    }, [validation.values.taxType]);

    const shouldShowDiscountValueType = useMemo(() => {
        return validation.values.discountType && 
               validation.values.discountType !== 'none' && 
               (validation.values.discountType === 'on_invoice' || validation.values.discountType === 'per_item_and_invoice');
    }, [validation.values.discountType]);

    const shouldShowItemDiscountField = useMemo(() => {
        return validation.values.discountType === 'per_item' || validation.values.discountType === 'per_item_and_invoice';
    }, [validation.values.discountType]);

    const isProcessing = isSubmitting || isLoading;

    // Effects
    useEffect(() => {
        if (isEditMode && selectedInvoice?.items) {
            const initialItems = selectedInvoice.items.map(item => ({
                id: item.id,
                productId: item.productId,
                productName: item.name,
                name: item.name,
                productCode: item.code,
                code: item.code,
                quantity: parseFloat(item.quantity || 0),
                rate: parseFloat(item.rate || 0),
                rateType: item.rateType || 'without_tax',
                taxRate: parseFloat(item.taxRate || 0),
                taxAmount: parseFloat(item.taxAmount || 0),
                discount: parseFloat(item.discountAmount || 0),
                discountType: item.discountType || 'rupees',
                discountValue: parseFloat(item.discountValue || 0),
                total: parseFloat(item.lineTotal || 0),
                lineTotal: parseFloat(item.lineTotal || 0),
                lineBasic: parseFloat(item.lineBasic || 0),
                isSerialized: item.isSerialized || false,
                serialNumbers: item.serialNumbers || [],
                currentStock: parseFloat(item.currentStock || 0)
            }));
            setItems(initialItems);
        } else {
            setItems([]);
        }

        if (isEditMode && selectedInvoice?.contact) {
            setSelectedContact(selectedInvoice.contact);
        } else {
            setSelectedContact(null);
        }

        // Reset change tracking when modal opens
        setHasChanges(false);

        if (isOpen) {
            fetchNextInvoiceNumber();
        }
    }, [isEditMode, selectedInvoice, isOpen, fetchNextInvoiceNumber]);

    useEffect(() => {
        if (productSearch !== lastSearchTermRef.current) {
            const timeoutId = setTimeout(() => {
                setProducts([]);
                setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
                fetchProducts(1, productSearch, true);
            }, 300);

            return () => clearTimeout(timeoutId);
        }
    }, [productSearch, fetchProducts]);

    useEffect(() => {
        setNewItem(prev => updateNewItemCalculations({ ...prev, rateType: validation.values.rateType }));
    }, [validation.values.rateType, updateNewItemCalculations]);

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="xl" centered className="fast-invoice-modal" style={{ maxWidth: '70vw' }}>
            <ModalHeader toggle={toggle}>
                <h5 className="mb-0">
                    {isEditMode ? 'Edit Sales Invoice' : 'Create Sales Invoice'}
                </h5>
            </ModalHeader>

            <Form onSubmit={(e) => {
                e.preventDefault();
                validation.handleSubmit();
            }}>
                <ModalBody className="p-4" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
                    {apiError && (
                        <Alert color="danger" className="mb-4">
                            <strong>Error:</strong> {apiError}
                        </Alert>
                    )}

                    {/* Header Information */}
                    <Row className="g-3 mb-4">
                        <Col md={2}>
                            <FormGroup className="mb-0">
                                <Label className="form-label small fw-bold">Invoice# *</Label>
                                <div className="d-flex">
                                    <Input
                                        type="text"
                                        size="sm"
                                        name="invoiceNumber"
                                        value={validation.values.invoiceNumber}
                                        onChange={validation.handleChange}
                                        onBlur={validation.handleBlur}
                                        invalid={validation.touched.invoiceNumber && !!validation.errors.invoiceNumber}
                                        placeholder="SI-001"
                                        disabled={isProcessing}
                                        style={{ height: '35px' }}
                                    />
                                    {suggestedInvoiceNumber && !validation.values.invoiceNumber && (
                                        <Button 
                                            color="outline-secondary"
                                            size="sm"
                                            onClick={() => validation.setFieldValue('invoiceNumber', suggestedInvoiceNumber)}
                                            disabled={isProcessing}
                                            style={{ height: '35px', fontSize: '0.7rem', marginLeft: '2px' }}
                                            title={`Use ${suggestedInvoiceNumber}`}
                                        >
                                            Use
                                        </Button>
                                    )}
                                </div>
                                <FormFeedback>{validation.errors.invoiceNumber}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={2}>
                            <FormGroup className="mb-0">
                                <Label className="form-label small fw-bold">Date *</Label>
                                <Input
                                    type="date"
                                    size="sm"
                                    name="date"
                                    value={validation.values.date}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.date && !!validation.errors.date}
                                    disabled={isProcessing}
                                    style={{ height: '35px' }}
                                />
                                <FormFeedback>{validation.errors.date}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup className="mb-0">
                                <Label className="form-label small fw-bold">Customer *</Label>
                                <div style={{ height: '35px', position: 'relative', zIndex: 1000 }}>
                                    <BankAccountContactDropdown
                                        value={validation.values.billTo}
                                        onChange={handleBillToChange}
                                        onBlur={validation.handleBlur}
                                        disabled={isProcessing}
                                        placeholder="Select Customer"
                                        error={validation.errors.billTo}
                                        touched={validation.touched.billTo}
                                    />
                                </div>
                                <FormFeedback>{validation.errors.billTo}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={1}>
                            <FormGroup className="mb-0">
                                <Label className="form-label small fw-bold">Status</Label>
                            <Input
                                type="select"
                                size="sm"
                                    name="status"
                                    value={validation.values.status}
                                    onChange={handleStatusChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.status && !!validation.errors.status}
                                    disabled={isProcessing}
                                    style={{ height: '35px' }}
                                >
                                    {STATUS_OPTIONS.map(status => (
                                        <option key={status.value} value={status.value}>{status.label}</option>
                                ))}
                            </Input>
                                <FormFeedback>{validation.errors.status}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={2}>
                            <FormGroup className="mb-0">
                                <Label className="form-label small fw-bold">Tax Type *</Label>
                            <Input
                                type="select"
                                size="sm"
                                name="taxType"
                                value={validation.values.taxType}
                                    onChange={handleTaxTypeChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.taxType && !!validation.errors.taxType}
                                    disabled={isProcessing}
                                    style={{ height: '35px' }}
                                >
                                    <option value="">Select Tax Type</option>
                                {TAX_TYPES.map(tax => (
                                        <option key={tax.value} value={tax.value}>{tax.label}</option>
                                ))}
                            </Input>
                                <FormFeedback>{validation.errors.taxType}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={2}>
                            <FormGroup className="mb-0">
                                <Label className="form-label small fw-bold">Discount</Label>
                            <Input
                                type="select"
                                size="sm"
                                    name="discountType"
                                    value={validation.values.discountType}
                                onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.discountType && !!validation.errors.discountType}
                                    disabled={isProcessing}
                                    style={{ height: '35px' }}
                            >
                                    {DISCOUNT_TYPES.map(discount => (
                                        <option key={discount.value} value={discount.value}>{discount.label}</option>
                                    ))}
                            </Input>
                                <FormFeedback>{validation.errors.discountType}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    {/* Rate Type Selection */}
                    {shouldShowTaxRate && (
                        <Row className="g-3 mb-4">
                            <Col md={4}>
                                <FormGroup className="mb-0">
                                    <Label className="form-label small fw-bold">Item Rate Type *</Label>
                            <Input
                                type="select"
                                size="sm"
                                        name="rateType"
                                        value={validation.values.rateType}
                                        onChange={handleRateTypeChange}
                                        onBlur={validation.handleBlur}
                                        invalid={validation.touched.rateType && !!validation.errors.rateType}
                                        disabled={isProcessing}
                                        style={{ height: '35px' }}
                                    >
                                        <option value="">Select Rate Type</option>
                                        {ITEM_RATE_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                            </Input>
                                    {validation.touched.rateType && validation.errors.rateType && (
                                        <div className="text-danger small">{validation.errors.rateType}</div>
                                    )}
                                    <small className="form-text text-muted">Rate type affects tax calculations.</small>
                                </FormGroup>
                            </Col>
                            {shouldShowDiscountValueType && (
                                <Col md={4}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small fw-bold">Discount Value</Label>
                                        <InputGroup size="sm">
                                            <Input
                                                type="number"
                                                name="discountValue"
                                                min="0"
                                                step="0.01"
                                                value={validation.values.discountValue}
                                                onChange={(e) => handleFormFieldChange('discountValue', e.target.value)}
                                                onBlur={validation.handleBlur}
                                                invalid={validation.touched.discountValue && !!validation.errors.discountValue}
                                                disabled={isProcessing}
                                                placeholder="0"
                                                style={{ height: '35px' }}
                                            />
                                            <Button
                                                color={validation.values.discountValueType === 'rupees' ? 'primary' : 'outline-secondary'}
                                                size="sm"
                                                onClick={() => handleFormFieldChange('discountValueType', 'rupees')}
                                                style={{ minWidth: '35px', height: '35px' }}
                                                type="button"
                                            >
                                                ₹
                                            </Button>
                                            <Button
                                                color={validation.values.discountValueType === 'percentage' ? 'primary' : 'outline-secondary'}
                                                size="sm"
                                                onClick={() => handleFormFieldChange('discountValueType', 'percentage')}
                                                style={{ minWidth: '35px', height: '35px' }}
                                                type="button"
                                            >
                                                %
                                            </Button>
                                        </InputGroup>
                                        <FormFeedback>{validation.errors.discountValue}</FormFeedback>
                                    </FormGroup>
                                </Col>
                            )}
                        </Row>
                    )}

                    {/* Bank Account Dropdown */}
                    {shouldShowBankAccountDropdown && (
                        <Row className="g-3 mb-4">
                            <Col md={6}>
                                <FormGroup className="mb-0">
                                    <Label className="form-label small fw-bold">Payment Bank Account *</Label>
                                    <BankAccountDropdown
                                        value={validation.values.billToBank}
                                        onChange={handleBillToBankChange}
                                        onBlur={() => validation.setFieldTouched('billToBank', true)}
                                        disabled={isProcessing}
                                        placeholder="Select Bank Account"
                                        error={validation.errors.billToBank}
                                        touched={validation.touched.billToBank}
                                    />
                                    {validation.touched.billToBank && validation.errors.billToBank && (
                                        <div className="invalid-feedback d-block">{validation.errors.billToBank}</div>
                                    )}
                                </FormGroup>
                            </Col>
                        </Row>
                    )}



                    {/* Item Entry Section */}
                                            <div className="border rounded p-2 mb-2" style={{ backgroundColor: 'var(--vz-light-bg-subtle)' }}>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="mb-0 text-primary">Add Items</h6>
                            <small className="text-muted">Press Tab to navigate • Ctrl+Enter to add item</small>
                            </div>
                        
                            <Row className="g-2 align-items-end">
                            {/* Product - Fixed position, wider when no serial number field */}
                            <Col md={newItem.isSerialized ? 3 : 4}>
                                <Label className="form-label small fw-bold">Product *</Label>
                                    <div className="position-relative">
                                        <Input
                                            id="productSearch"
                                            type="text"
                                            size="sm"
                                            value={productSearch}
                                        onChange={(e) => handleProductSearchChange(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                        placeholder="Type product name or code..."
                                            autoComplete="off"
                                        style={{ height: '35px' }}
                                        className="fw-medium"
                                        />
                                        {productSearch && filteredProducts.length > 0 && (
                                        <div className="position-absolute bg-white border rounded shadow mt-1 w-100" style={{ zIndex: 1050, maxHeight: '120px', overflowY: 'auto' }}>
                                                {filteredProducts.map(product => (
                                                    <div
                                                        key={product.id}
                                                    className={`p-2 border-bottom small ${parseFloat(product.currentStock || 0) === 0 ? 'cursor-not-allowed' : 'cursor-pointer hover-bg-light'}`}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (parseFloat(product.currentStock || 0) > 0) {
                                                            selectProduct(product);
                                                        }
                                                    }}
                                                        style={{ 
                                                            cursor: parseFloat(product.currentStock || 0) === 0 ? 'not-allowed' : 'pointer',
                                                            opacity: parseFloat(product.currentStock || 0) === 0 ? '0.6' : '1'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (parseFloat(product.currentStock || 0) > 0) {
                                                                e.target.style.backgroundColor = 'var(--vz-light-bg-subtle)';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                                    >
                                                        <div className="fw-medium">{product.name}</div>
                                                    <div className="text-muted">
                                                        {product.itemCode} • ₹{parseFloat(product.sellingPrice || product.rate || 0).toFixed(2)} • 
                                                        <span className={parseFloat(product.currentStock || 0) === 0 ? 'text-danger fw-bold' : 'text-success'}>
                                                            Stock: {product.currentStock || 0}
                                                            {parseFloat(product.currentStock || 0) === 0 && ' (Out of Stock)'}
                                                        </span>
                                                    </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Col>
                            
                            {/* Serial Number - Only visible for serialized products */}
                            {newItem.isSerialized && (
                                <Col md={2}>
                                    <Label className="form-label small fw-bold">Serial Selection</Label>
                                    <div style={{ height: '35px', display: 'flex', alignItems: 'center' }} className="bg-white border rounded px-2">
                                        <small className="text-muted fw-medium">Click serials below</small>
                                    </div>
                                </Col>
                            )}
                            
                            {/* Qty - Fixed position */}
                                <Col md={1}>
                                <Label className="form-label small fw-bold">Qty *</Label>
                                {!newItem.isSerialized ? (
                                    <Input
                                        id="quantityInput"
                                        type="number"
                                        size="sm"
                                        step="0.01"
                                        value={newItem.quantity}
                                        onChange={(e) => handleNewItemChange('quantity', e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        style={{ height: '35px' }}
                                        placeholder="0"
                                        className="text-center fw-bold"
                                    />
                                ) : (
                                    <Input
                                        type="text"
                                        size="sm"
                                        value={newItem.serialNumbers.length}
                                        disabled
                                        style={{ height: '35px', backgroundColor: 'var(--vz-light-bg-subtle)' }}
                                        className="text-center fw-bold"
                                    />
                                )}
                                </Col>
                            
                            {/* Rate - Reduced width */}
                            <Col md={1}>
                                <Label className="form-label small fw-bold">Rate *</Label>
                                    <InputGroup size="sm">
                                    <InputGroupText style={{ height: '35px', backgroundColor: '#e9ecef' }}>₹</InputGroupText>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={newItem.rate}
                                        onChange={(e) => handleNewItemChange('rate', e.target.value)}
                                            onKeyDown={handleKeyDown}
                                        style={{ height: '35px', fontWeight: '600' }}
                                        placeholder="0.00"
                                        />
                                    </InputGroup>
                                </Col>
                            
                            {/* Tax - Fixed position */}
                                <Col md={1}>
                                <Label className="form-label small fw-bold">Tax%</Label>
                                {shouldShowTaxRate ? (
                                    <Input
                                        type="number"
                                        size="sm"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={newItem.taxRate}
                                        onChange={(e) => handleNewItemChange('taxRate', e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="0"
                                        style={{ height: '35px' }}
                                        className="text-center"
                                    />
                                ) : (
                                    <div style={{ height: '35px' }} className="bg-light border rounded d-flex align-items-center justify-content-center">
                                        <small className="text-muted">0</small>
                                    </div>
                                )}
                                </Col>
                            
                            {/* Item Discount - Only visible when per-item discount is enabled */}
                            {shouldShowItemDiscountField && (
                                <Col md={1}>
                                    <Label className="form-label small fw-bold">Item Disc</Label>
                                    <div style={{ display: 'flex', height: '35px' }}>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={newItem.discountValue}
                                            onChange={(e) => handleNewItemChange('discountValue', e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="0"
                                            size="sm"
                                            style={{ 
                                                height: '35px', 
                                                borderRadius: '0.375rem 0 0 0.375rem',
                                                borderRight: 'none',
                                                width: '65%'
                                            }}
                                        />
                                        <Input
                                            type="select"
                                            size="sm"
                                            value={newItem.discountType}
                                            onChange={(e) => handleNewItemChange('discountType', e.target.value)}
                                            style={{ 
                                                height: '35px', 
                                                borderRadius: '0 0.375rem 0.375rem 0',
                                                borderLeft: 'none',
                                                width: '35%',
                                                fontSize: '0.7rem',
                                                paddingLeft: '4px',
                                                paddingRight: '4px'
                                            }}
                                        >
                                            <option value="rupees">₹</option>
                                            <option value="percentage">%</option>
                                        </Input>
                                    </div>
                                </Col>
                            )}
                            
                            {/* Total - Fixed position */}
                            <Col md={shouldShowItemDiscountField ? 2 : 3}>
                                <Label className="form-label small fw-bold">Total</Label>
                                <div className="bg-white border border-primary rounded px-1 py-1 text-center" style={{ height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="fw-bold text-primary" style={{ fontSize: '0.8rem' }}>
                                        ₹{(newItem.calculatedTotal || 0).toFixed(2)}
                                    </span>
                                </div>
                            </Col>
                            
                            {/* Add Button - Fixed position */}
                                <Col md={1}>
                                <Label className="form-label small" style={{ visibility: 'hidden' }}>.</Label>
                                    <Button
                                        color="success"
                                        size="sm"
                                        onClick={addItem}
                                    disabled={
                                        !newItem.productName || 
                                        !newItem.productId ||
                                        parseFloat(newItem.rate) <= 0 || 
                                        (newItem.isSerialized ? 
                                            newItem.serialNumbers.length === 0 : 
                                            (parseFloat(newItem.quantity) <= 0 || parseFloat(newItem.quantity) > parseFloat(newItem.currentStock))
                                        )
                                    }
                                    title="Add Item (Ctrl+Enter)"
                                    className="w-100 fw-bold"
                                    type="button"
                                    style={{ height: '35px' }}
                                >
                                    ADD
                                    </Button>
                                </Col>
                            </Row>
                    </div>

                    {/* Available Serial Numbers for Selection - Professional and compact */}
                    {newItem.isSerialized && newItem.productName && newItem.availableSerialNumbers.length > 0 && (
                        <div className="mb-2 p-2 border rounded" style={{ backgroundColor: '#e3f2fd', borderColor: '#2196f3' }}>
                            <div className="d-flex justify-content-between align-items-center">
                                <strong className="small text-dark">
                                    {newItem.availableSerialNumbers.length} serial numbers available in stock
                                </strong>
                                <Button
                                    color="link"
                                    size="sm"
                                    onClick={() => setShowAllSerials(!showAllSerials)}
                                    className="p-0 text-decoration-none"
                                >
                                    <small>{showAllSerials ? 'Hide' : 'View All'}</small>
                                    {showAllSerials ? <RiArrowUpSLine size={12} /> : <RiArrowDownSLine size={12} />}
                                </Button>
                            </div>
                            <div className="mt-1">
                                <div className="d-flex flex-wrap gap-1">
                                    {(showAllSerials ? newItem.availableSerialNumbers : newItem.availableSerialNumbers.slice(-5)).map((serial, index) => (
                                        <Badge
                                            key={index}
                                            color={newItem.serialNumbers.includes(serial) ? 'success' : 'primary'}
                                            className="cursor-pointer"
                                            onClick={() => selectAvailableSerial(serial)}
                                            style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                                        >
                                            {serial}
                                        </Badge>
                                    ))}
                                    {!showAllSerials && newItem.availableSerialNumbers.length > 5 && (
                                        <Badge color="secondary" style={{ fontSize: '0.7rem' }}>
                                            +{newItem.availableSerialNumbers.length - 5} more
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Selected Serial Numbers for Sale - Compact */}
                    {newItem.isSerialized && newItem.productName && newItem.serialNumbers.length > 0 && (
                        <div className="mb-2 p-2 border rounded" style={{ backgroundColor: '#e8f5e8', borderColor: '#28a745' }}>
                            <strong className="small text-dark">
                                Selected Serial Numbers ({newItem.serialNumbers.length}): 
                            </strong>
                            <div className="mt-1">
                                {newItem.serialNumbers.map((serial, index) => (
                                    <Badge
                                        key={index}
                                        color="success"
                                        className="cursor-pointer me-2 mb-1"
                                        onClick={() => removeSerialNumber(serial)}
                                        style={{ cursor: 'pointer', fontSize: '0.7rem' }}
                                        title="Click to remove"
                                    >
                                        {serial} ✕
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Items Table */}
                    {items.length > 0 && (
                        <div className="table-responsive mb-3">
                            <Table size="sm" className="mb-0 table-bordered">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: '4%' }}>#</th>
                                        <th style={{ width: shouldShowTaxRate && shouldShowItemDiscountField ? '22%' : '28%' }}>Product</th>
                                        <th style={{ width: '8%' }}>Qty</th>
                                        <th style={{ width: '12%' }}>Rate</th>
                                        {shouldShowTaxRate && (
                                            <>
                                        <th style={{ width: '8%' }}>Tax%</th>
                                                <th style={{ width: '10%' }}>Tax Amt</th>
                                            </>
                                        )}
                                        {shouldShowItemDiscountField && (
                                            <th style={{ width: '10%' }}>Discount</th>
                                        )}
                                        <th style={{ width: '12%' }}>Total</th>
                                        <th style={{ width: '4%' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={item.id}>
                                            <td className="text-center small">{index + 1}</td>
                                            <td>
                                                <div className="fw-medium small">{item.productName || item.name}</div>
                                                {(item.productCode || item.code) && <small className="text-muted">{item.productCode || item.code}</small>}
                                                {item.isSerialized && item.serialNumbers && item.serialNumbers.length > 0 && (
                                                    <div className="mt-1">
                                                        {item.serialNumbers.map((serial, idx) => (
                                                            <Badge key={idx} color="info" className="me-1 mb-1" style={{ fontSize: '0.7rem' }}>
                                                                {serial}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-center small">{item.quantity}</td>
                                            <td className="text-end small">₹{parseFloat(item.rate).toFixed(2)}</td>
                                            {shouldShowTaxRate && (
                                                <>
                                                    <td className="text-center small">{item.taxRate}%</td>
                                                    <td className="text-end small">₹{parseFloat(item.taxAmount || 0).toFixed(2)}</td>
                                                </>
                                            )}
                                            {shouldShowItemDiscountField && (
                                                <td className="text-end small">
                                                {item.discountValue > 0 ? (
                                                    item.discountType === 'percentage' ? `${item.discountValue}%` : `₹${item.discountValue}`
                                                ) : '-'}
                                            </td>
                                            )}
                                            <td className="text-end fw-bold small">₹{parseFloat(item.lineTotal || item.total || 0).toFixed(2)}</td>
                                            <td className="text-center">
                                                <Button
                                                    color="danger"
                                                    size="sm"
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-1"
                                                    type="button"
                                                >
                                                    <RiDeleteBinLine size={10} />
                                                </Button>
                                                <Button
                                                    color="info"
                                                    size="sm"
                                                    onClick={() => editItem(item)}
                                                    className="p-1 ms-1"
                                                    type="button"
                                                    title="Edit Item"
                                                >
                                                    <RiEditLine size={10} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {/* Notes and Totals */}
                    <Row className="g-2">
                        <Col md={8}>
                            {/* Optional Charges - Collapsible */}
                            <div className="mb-3">
                                <Button
                                    color="link"
                                    size="sm"
                                    onClick={() => setShowCharges(!showCharges)}
                                    className="p-0 text-decoration-none mb-2"
                                >
                                    <span className="fw-bold">Optional Charges</span>
                                    {showCharges ? <RiArrowUpSLine className="ms-1" size={14} /> : <RiArrowDownSLine className="ms-1" size={14} />}
                                </Button>
                                <Collapse isOpen={showCharges}>
                                    <Card className="border-light">
                                        <CardBody className="p-2">
                                            <Row className="g-2">
                                                <Col md={6}>
                                                    <FormGroup className="mb-0">
                                                        <Label className="form-label small">Transportation Charge (₹)</Label>
                                                        <InputGroup size="sm">
                                                            <InputGroupText>₹</InputGroupText>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                name="transportationCharge"
                                                                value={validation.values.transportationCharge || ''}
                                                                onChange={(e) => {
                                                                    const charge = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                                                    handleFormFieldChange('transportationCharge', e.target.value === '' ? '' : charge);
                                                                }}
                                                                onBlur={validation.handleBlur}
                                                                invalid={validation.touched.transportationCharge && !!validation.errors.transportationCharge}
                                                                disabled={isProcessing}
                                                                placeholder="0.00"
                                                                style={{ height: '35px' }}
                                                            />
                                                        </InputGroup>
                                                        <FormFeedback>{validation.errors.transportationCharge}</FormFeedback>
                                                    </FormGroup>
                                                </Col>
                                                <Col md={6}>
                                                    <FormGroup className="mb-0">
                                                        <Label className="form-label small">Round Off (₹)</Label>
                                                        <InputGroup size="sm">
                                                            <InputGroupText>₹</InputGroupText>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                name="roundOff"
                                                                value={validation.values.roundOff || ''}
                                                                onChange={(e) => {
                                                                    const roundOff = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                                                    handleFormFieldChange('roundOff', roundOff);
                                                                }}
                                                                onBlur={validation.handleBlur}
                                                                disabled={isProcessing}
                                                                placeholder="0.00"
                                                                style={{ height: '35px' }}
                                                            />
                                                        </InputGroup>
                                                    </FormGroup>
                                                </Col>
                                            </Row>
                                        </CardBody>
                                    </Card>
                                </Collapse>
                            </div>
                            
                            <FormGroup className="mb-0">
                                <Label className="form-label small">Internal Notes</Label>
                                <Input
                                    type="textarea"
                                    rows={3}
                                    size="sm"
                                    name="internalNotes"
                                    value={validation.values.internalNotes}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.internalNotes && !!validation.errors.internalNotes}
                                    placeholder="Eg. Delivery by end of month, special instructions..."
                                    disabled={isProcessing}
                                    style={{ height: '80px' }}
                                />
                                <FormFeedback>{validation.errors.internalNotes}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={4}>
                            {/* Live Summary Box */}
                            <Card className="border-primary">
                                <CardBody className="p-3">
                                    <h6 className="mb-2 text-primary fw-bold">Invoice Summary</h6>
                                    
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="small">Subtotal:</span>
                                        <span className="small fw-medium">₹{parseFloat(totals.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    
                                    {parseFloat(totals.itemLevelDiscounts || 0) > 0 && (
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="small text-danger">Item Discount:</span>
                                            <span className="small fw-medium text-danger">-₹{parseFloat(totals.itemLevelDiscounts || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    
                                    {parseFloat(totals.invoiceLevelDiscount || 0) > 0 && (
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="small text-danger">Invoice Discount:</span>
                                            <span className="small fw-medium text-danger">-₹{parseFloat(totals.invoiceLevelDiscount || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    
                                    {parseFloat(totals.taxAmount || 0) > 0 && (
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="small text-success">Tax:</span>
                                            <span className="small fw-medium text-success">+₹{parseFloat(totals.taxAmount || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    
                                    {parseFloat(totals.transportationCharge || 0) > 0 && (
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="small text-info">Transportation:</span>
                                            <span className="small fw-medium text-info">+₹{parseFloat(totals.transportationCharge || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    
                                    {parseFloat(totals.roundOff || 0) !== 0 && (
                                        <div className="d-flex justify-content-between mb-1">
                                            <span className="small">Round Off:</span>
                                            <span className={`small fw-medium ${parseFloat(totals.roundOff || 0) > 0 ? 'text-success' : 'text-danger'}`}>
                                                {parseFloat(totals.roundOff || 0) > 0 ? '+' : ''}₹{Math.abs(parseFloat(totals.roundOff || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    
                                    <hr className="my-2" />
                                    
                                    <div className="d-flex justify-content-between">
                                        <span className="fw-bold text-primary">Grand Total:</span>
                                        <span className="fw-bold text-primary fs-5">₹{parseFloat(totals.netReceivable || 0).toFixed(2)}</span>
                                    </div>
                                    
                                    {items.length > 0 && (
                                        <div className="mt-2 pt-2 border-top">
                                            <small className="text-muted">
                                                {items.length} item(s) • Last updated: {new Date().toLocaleTimeString()}
                                            </small>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </ModalBody>

                <ModalFooter className="p-2">
                    <div className="d-flex justify-content-between w-100 align-items-center">
                        <Button color="secondary" onClick={toggle} disabled={isProcessing} size="sm">
                            <RiCloseLine className="me-1" /> Cancel
                        </Button>
                        <div className="d-flex align-items-center gap-2">
                            <span className="small text-muted">
                                Items: {items.length} | Total: ₹{parseFloat(totals.netReceivable || 0).toFixed(2)}
                            </span>
                            <Button 
                                color="primary" 
                                type="submit" 
                                disabled={isProcessing || items.length === 0 || !validation.isValid}
                                size="sm"
                            >
                                {isProcessing ? (
                                    <>
                                        <RiLoader4Line className="spin me-1" />
                                        {isEditMode ? 'Updating...' : 'Creating...'}
                                    </>
                                ) : (
                                    <>
                                        <RiSaveLine className="me-1" />
                                        {isEditMode ? 'Update' : 'Create'} Invoice
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </ModalFooter>
            </Form>
        </Modal>
    );
};

export default FastSalesInvoiceForm; 
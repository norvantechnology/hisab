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
    RiAlertLine,
    RiEyeLine,
    RiArrowDownSLine,
    RiArrowUpSLine
} from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";
import { toast } from 'react-toastify';
import { TAX_TYPES, DISCOUNT_TYPES, DISCOUNT_VALUE_TYPES, STATUS_OPTIONS, ITEM_RATE_TYPES } from './contant';
import { listProducts } from '../../../services/products';
import { getNextInvoiceNumber } from '../../../services/purchaseInvoice';
import BankAccountContactDropdown from '../../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../../Common/BankAccountDropdown';
import { calculateItemTaxAmount, calculateItemTaxAndTotal } from '../../../utils/taxCalculations';

const FastPurchaseInvoiceForm = ({
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
        quantity: 0, // Change default from 1 to 0
        rate: 0,
        taxRate: 0,
        discountType: 'rupees',
        discountValue: 0,
        discountRate: 0,
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

    // Track if any changes have been made since opening edit mode
    const [hasChanges, setHasChanges] = useState(false);

    // Validation schema
    const validationSchema = useMemo(() => Yup.object({
        invoiceNumber: Yup.string().required('Invoice number is required'),
        date: Yup.date().required('Date is required'),
        billFrom: Yup.string().required('Bill from is required'),
        billFromBank: Yup.string().when(['status', 'billFrom'], {
            is: (status, billFrom) => status === 'paid' && billFrom && billFrom.startsWith('contact_'),
            then: (schema) => schema.required('Bank account is required when status is paid and vendor is a contact'),
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
        discountScope: Yup.string().required('Discount scope is required'),
        discountValueType: Yup.string().when('discountScope', {
            is: (type) => type && type !== 'none',
            then: (schema) => schema.required('Discount value type is required'),
            otherwise: (schema) => schema
        }),
        discountValue: Yup.number().when('discountScope', {
            is: (type) => type && type !== 'none' && (type === 'invoice' || type === 'per_item_and_invoice'),
            then: (schema) => schema.min(0, 'Discount value cannot be negative').required('Discount value is required'),
            otherwise: (schema) => schema
        }),
        status: Yup.string().when('billFrom', {
            is: (billFrom) => billFrom && billFrom.startsWith('contact_'),
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
            invoiceNumber: selectedInvoice?.invoiceNumber || '',
            date: selectedInvoice?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            billFrom: selectedInvoice?.contact?.id ? `contact_${selectedInvoice.contact.id}` : 
                     selectedInvoice?.bankAccount?.id ? `bank_${selectedInvoice.bankAccount.id}` : '',
            billFromBank: selectedInvoice?.bankAccount?.id && selectedInvoice?.contact?.id ? 
                         selectedInvoice.bankAccount.id.toString() : '',
            taxType: selectedInvoice?.taxType || 'no_tax',
            rateType: selectedInvoice?.rateType || 'without_tax',
            discountScope: selectedInvoice?.discountScope || 'none',
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
                    taxRate: shouldCalculateTax ? taxRate : 0, // Force tax rate to 0 if "No Tax" is selected
                    discountRate,
                    rateType,
                    discountValueType: updatedItem.discountType || 'percentage', // Use item's discount type or default to percentage
                    discountValue: discountRate
                });



                return {
                    ...updatedItem,
                    calculatedTotal: result.total || 0,
                    calculatedTaxAmount: shouldCalculateTax ? (result.taxAmount || 0) : 0, // Force tax amount to 0 if "No Tax"
                    calculatedDiscount: result.discount || 0,
                    rateWithoutTax: result.rateWithoutTax || 0,
                    rateWithTax: result.rateWithTax || 0
                };
            } catch (error) {
                console.error('❌ Calculation error:', error);
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
            
            if (field === 'discountValue') {
                updatedItem.discountRate = value;
            }
            
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
        let displayRate = parseFloat(item.rate || 0);

        setNewItem({
            id: item.id,
            productId: item.productId,
            productName: item.productName || item.name,
            productCode: item.productCode || item.code,
            quantity: item.quantity,
            rate: displayRate,
            taxRate: item.taxRate,
            discountType: item.discountType || 'rupees',
            discountValue: item.discountValue || item.discountRate || 0,
            discountRate: item.discountRate || 0,
            rateType: item.rateType || validation.values.rateType || 'without_tax',
            isSerialized: item.isSerialized || false,
            serialNumbers: item.serialNumbers || [],
            availableSerialNumbers: [],
            currentStock: item.currentStock || 0,
            calculatedTotal: item.total || 0,
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

    // Add serial number to the list (for purchase - only NEW serial numbers)
    const addSerialNumber = useCallback(() => {
        if (!newSerialNumber.trim()) return;
        
        const serialNumber = newSerialNumber.trim();
        
        // Check if serial number already exists in inventory (purchase should not allow existing serials)
        if (newItem.availableSerialNumbers.includes(serialNumber)) {
            toast.warning(`Serial number "${serialNumber}" already exists in inventory. Please enter a new serial number.`);
            return;
        }
        
        // Check if already added to current purchase
        if (newItem.serialNumbers.includes(serialNumber)) {
            toast.warning('Serial number already added to this purchase');
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
        
        setNewSerialNumber('');
    }, [newSerialNumber, newItem.serialNumbers, newItem.availableSerialNumbers, updateNewItemCalculations]);

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
        // Calculate subtotal as Rate (Without tax) × Qty (before any discounts/tax)
        const basicAmount = itemsData.reduce((sum, item) => {
            const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity);
            const rate = parseFloat(item.rate) || 0;
            const taxRate = parseFloat(item.taxRate) || 0;
            // Use rate without tax for subtotal calculation based on rate type
            let rateWithoutTax;
            if (values.rateType === 'with_tax' && taxRate > 0) {
                // Rate includes tax, so extract the base rate
                rateWithoutTax = rate / (1 + (taxRate / 100));
            } else {
                // Rate is already without tax or no tax applicable
                rateWithoutTax = rate;
            }
            return sum + (quantity * rateWithoutTax);
        }, 0);
        
        // Calculate total item-level discounts
        const totalItemDiscount = itemsData.reduce((sum, item) => {
            return sum + (parseFloat(item.discountAmount) || 0);
        }, 0);
        
        // Calculate invoice-level discount
        let invoiceDiscount = 0;
        if (values.discountScope === 'invoice' || values.discountScope === 'per_item_and_invoice') {
            if (values.discountValueType === 'percentage') {
                // Apply percentage discount on item totals (after item-level processing)
                const itemTotalsSum = itemsData.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
                invoiceDiscount = (itemTotalsSum * values.discountValue) / 100;
            } else if (values.discountValueType === 'rupees') {
                invoiceDiscount = values.discountValue;
            }
        }
        
        // Total discount = item-level + invoice-level
        const totalDiscount = totalItemDiscount + invoiceDiscount;
        
        // Use actual tax amounts from items (already calculated correctly)
        const taxAmount = itemsData.reduce((sum, item) => {
            return sum + (parseFloat(item.taxAmount) || 0);
        }, 0);

        const transportationCharge = parseFloat(values.transportationCharge || 0);
        const userRoundOff = parseFloat(values.roundOff || 0);
        
        // Calculate netPayable: basicAmount + tax - invoiceDiscount + charges
        // Note: itemLevelDiscounts are already included in item totals
        const itemTotalsSum = itemsData.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
        const netPayable = itemTotalsSum - invoiceDiscount + transportationCharge + userRoundOff;

        const billFromParts = values.billFrom.split('_');
        const billFromType = billFromParts[0];
        const billFromId = billFromParts[1];

        const payload = {
            ...values,
            date: new Date(values.date).toISOString(),
            items: itemsData.map(item => {
                const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity);
                return {
                    id: item.id,
                    productId: item.productId,
                    name: item.productName || item.name,
                    code: item.productCode || item.code,
                    quantity: quantity,
                    rate: parseFloat((parseFloat(item.rate) || 0).toFixed(2)),
                    rateType: item.rateType || values.rateType,
                    taxRate: parseFloat(item.taxRate) || 0,
                    taxAmount: parseFloat((parseFloat(item.taxAmount) || 0).toFixed(2)),
                    discount: parseFloat((parseFloat(item.discount) || 0).toFixed(2)),
                    discountType: item.discountType || 'rupees',
                    discountValue: parseFloat((parseFloat(item.discountValue) || 0).toFixed(2)),
                    discountAmount: parseFloat((parseFloat(item.discountAmount) || 0).toFixed(2)),
                    total: parseFloat((parseFloat(item.total) || 0).toFixed(2)),
                    isSerialized: item.isSerialized || false,
                    serialNumbers: item.isSerialized ? (item.serialNumbers || []) : undefined,
                    currentStock: item.currentStock || 0
                };
            }),
            basicAmount: parseFloat(basicAmount.toFixed(2)),
            taxAmount: parseFloat(taxAmount.toFixed(2)), // Use actual tax amounts from items
            totalDiscount: parseFloat(totalDiscount.toFixed(2)),
            roundOff: parseFloat(userRoundOff.toFixed(2)),
            transportationCharge: parseFloat(values.transportationCharge || 0),
            netPayable: parseFloat(netPayable.toFixed(2)),
            discountScope: values.discountScope,
            discountValueType: values.discountValueType,
            discountValue: parseFloat((parseFloat(values.discountValue) || 0).toFixed(2))
        };

        // Handle bill from logic
        if (billFromType === 'bank') {
            payload.billFromBank = billFromId;
            payload.billFromContact = null;
            payload.status = 'paid';
        } else if (billFromType === 'contact') {
            payload.billFromContact = billFromId;
            if (!values.status) {
                payload.status = 'pending';
            } else {
                payload.status = values.status;
            }
            if (payload.status === 'paid' && values.billFromBank) {
                payload.billFromBank = values.billFromBank;
            } else {
                payload.billFromBank = null;
            }
        }

        return payload;
    }, []);

    // Handle form field changes and track modifications
    const handleFormFieldChange = useCallback((field, value) => {
        validation.setFieldValue(field, value);
        setHasChanges(true); // Mark that changes have been made
    }, []);

    // Calculate totals for display
    const totals = useMemo(() => {
        // Calculate subtotal as Rate (Without tax) × Qty (before tax and discount)
        const subtotal = items.reduce((sum, item) => {
            const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity) || 0;
            const rate = parseFloat(item.rate) || 0;
            const taxRate = parseFloat(item.taxRate) || 0;
            // Use rate without tax for subtotal calculation based on rate type
            let rateWithoutTax;
            if (validation?.values?.rateType === 'with_tax' && taxRate > 0) {
                // Rate includes tax, so extract the base rate
                rateWithoutTax = rate / (1 + (taxRate / 100));
            } else {
                // Rate is already without tax or no tax applicable
                rateWithoutTax = rate;
            }
            return sum + (quantity * rateWithoutTax);
        }, 0);
        
        // Calculate total item-level discounts
        const itemLevelDiscounts = items.reduce((sum, item) => {
            return sum + (parseFloat(item.discountAmount) || 0);
        }, 0);
        
        // Basic amount is the sum of item totals (after item-level discounts and tax)
        const basicAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
        
        // Calculate invoice-level discount
        let invoiceLevelDiscount = 0;
        if (validation.values.discountScope === 'invoice' || validation.values.discountScope === 'per_item_and_invoice') {
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
        
        // In edit mode, use original netPayable only if no changes have been made
        // If changes have been made, calculate live
        let netPayable;
        if (isEditMode && selectedInvoice?.netPayable !== undefined && !hasChanges) {
            netPayable = parseFloat(selectedInvoice.netPayable || 0);
        } else {
            // Calculate netPayable live when changes are made
            netPayable = basicAmount - invoiceLevelDiscount + transportationCharge + roundOff;
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
            netPayable 
        };
    }, [items, validation.values.discountType, validation.values.discountValueType, validation.values.discountValue, validation.values.taxType, validation.values.transportationCharge, validation.values.roundOff, isEditMode, selectedInvoice?.netPayable, hasChanges]);

    // Add item to list with rate conversion for "With Tax"
    const addItem = useCallback(() => {
        // Validation for serialized vs non-serialized products
        if (!newItem.productName || parseFloat(newItem.rate) <= 0) {
            toast.warning('Please select a product and enter a rate');
            return;
        }

        if (newItem.isSerialized) {
            if (newItem.serialNumbers.length === 0) {
                toast.warning('Please add at least one serial number for this serialized product');
                return;
            }
        } else {
            if (parseFloat(newItem.quantity) <= 0) {
                toast.warning('Please enter a valid quantity');
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
            discountValueType: newItem.discountType, // Use the actual discount type selected by user
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
            rate: rate, // Store the rate as entered by user
            rateType: validation.values.rateType || 'without_tax',
            taxRate: taxRate,
            taxAmount: parseFloat((result.taxAmount || 0).toFixed(2)), // Round tax amount
            discountType: newItem.discountType || 'rupees',
            discountValue: discountRate,
            discountAmount: parseFloat((result.discount || 0).toFixed(2)), // Round discount amount
            total: parseFloat((result.total || 0).toFixed(2)), // Round total
            rateWithoutTax: parseFloat((result.rateWithoutTax || 0).toFixed(2)),
            rateWithTax: parseFloat((result.rateWithTax || 0).toFixed(2)),
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
            discountRate: 0,
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
        const productRate = parseFloat(product.rate) || 0;
        
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
                taxRate: defaultTaxRate, // Use 0 if "No Tax" is selected
                isSerialized: product.isSerialized || false,
                availableSerialNumbers: product.availableSerialNumbers || [],
                currentStock: parseFloat(product.currentStock) || 0,
                rateType: validation.values.rateType || 'without_tax',
                serialNumbers: [],
                quantity: product.isSerialized ? 0 : 1 // Set to 1 for non-serialized, 0 for serialized
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

    // Handle bulk serial number input
    const handleBulkSerialInput = useCallback((serialsText) => {
        if (!serialsText.trim()) return;
        
        const serials = serialsText.split(',').map(s => s.trim()).filter(s => s);
        const validSerials = [];
        
        for (const serial of serials) {
            if (newItem.availableSerialNumbers.includes(serial)) {
                toast.warning(`Serial number "${serial}" already exists in inventory`);
                continue;
            }
            if (newItem.serialNumbers.includes(serial)) {
                toast.warning(`Serial number "${serial}" already added`);
                continue;
            }
            validSerials.push(serial);
        }
        
        if (validSerials.length > 0) {
            setNewItem(prev => {
                const updatedSerialNumbers = [...prev.serialNumbers, ...validSerials];
                const updatedItem = {
                    ...prev,
                    serialNumbers: updatedSerialNumbers,
                    quantity: updatedSerialNumbers.length
                };
                return updateNewItemCalculations(updatedItem);
            });
            toast.success(`Added ${validSerials.length} serial numbers`);
        }
    }, [newItem.availableSerialNumbers, newItem.serialNumbers, updateNewItemCalculations]);

    // Event handlers
    const handleBillFromChange = useCallback((selectedOption) => {
        validation.setFieldValue('billFrom', selectedOption?.value || '');
        if (!selectedOption?.value?.startsWith('contact_')) {
            validation.setFieldValue('billFromBank', '');
            setSelectedContact(null);
        } else {
            setSelectedContact(selectedOption?.contact || null);
        }
    }, []);

    const handleBillFromBankChange = useCallback((selectedOption) => {
        validation.setFieldValue('billFromBank', selectedOption?.value || '');
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
        
        // Update the new item's rate type
        setNewItem(prev => updateNewItemCalculations({ ...prev, rateType: newRateType }));
        
        // Update existing items
        if (items.length > 0) {
            const updatedItems = items.map(item => {
                const quantity = item.isSerialized ? (item.serialNumbers || []).length : parseFloat(item.quantity) || 0;
                let rate = parseFloat(item.rate) || 0;
                const taxRate = parseFloat(item.taxRate) || 0;
                const discountRate = parseFloat(item.discountRate) || parseFloat(item.discountValue) || 0;
                
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
                
                // Use common utility function for tax calculations
                const result = calculateItemTaxAndTotal({
                    rate,
                    quantity,
                    taxRate,
                    discountRate,
                    rateType: newRateType,
                    discountValueType: item.discountType || 'percentage', // Use item's discount type or default to percentage
                    discountValue: discountRate
                });
                
                return {
                    ...item,
                    rate: parseFloat(rate.toFixed(2)), // Round to avoid precision errors
                    rateType: newRateType, // Update item's rate type to match invoice
                    taxAmount: result.taxAmount,
                    discount: result.discount,
                    total: result.total,
                    rateWithoutTax: result.rateWithoutTax,
                    rateWithTax: result.rateWithTax
                };
            });
            
            setItems(updatedItems);
        }
    }, [items, updateNewItemCalculations, newItem.rate, newItem.taxRate]);

    const handleStatusChange = useCallback((e) => {
        const newStatus = e.target.value;
        validation.setFieldValue('status', newStatus);
        
        if (newStatus === 'pending' && validation.values.billFromBank) {
            validation.setFieldValue('billFromBank', '');
        }
    }, []);

    // Conditional display logic
    const shouldShowStatusDropdown = useMemo(() => {
        return validation.values.billFrom && validation.values.billFrom.startsWith('contact_');
    }, [validation.values.billFrom]);

    const shouldShowBankAccountDropdown = useMemo(() => {
        return validation.values.status === 'paid' && 
               validation.values.billFrom && 
               validation.values.billFrom.startsWith('contact_');
    }, [validation.values.status, validation.values.billFrom]);

    const shouldShowTaxRate = useMemo(() => {
        const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
        return selectedTax && selectedTax.rate > 0;
    }, [validation.values.taxType]);

    const shouldShowDiscountValueType = useMemo(() => {
        return validation.values.discountScope && 
               validation.values.discountScope !== 'none' && 
               (validation.values.discountScope === 'invoice' || validation.values.discountScope === 'per_item_and_invoice');
    }, [validation.values.discountScope]);

    const shouldShowItemDiscountField = useMemo(() => {
        return validation.values.discountScope === 'per_item' || validation.values.discountScope === 'per_item_and_invoice';
    }, [validation.values.discountScope]);

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
                quantity: item.quantity,
                rate: parseFloat(item.rate) || 0,
                rateType: item.rateType || 'without_tax',
                taxRate: parseFloat(item.taxRate) || 0,
                taxAmount: parseFloat(item.taxAmount) || 0,
                discountType: item.discountType || 'rupees',
                discountValue: parseFloat(item.discountValue) || 0,
                discountAmount: parseFloat(item.discountAmount) || 0,
                total: parseFloat(item.total) || 0,
                isSerialized: item.isSerialized || false,
                serialNumbers: item.serialNumbers || [],
                currentStock: item.currentStock || 0
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
                    {isEditMode ? 'Edit Purchase Invoice' : 'Create Purchase Invoice'}
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

                    {/* Header Information - More compact single row */}
                    <Row className="g-2 mb-3">
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
                                placeholder="PI-001"
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
                            <Label className="form-label small fw-bold">Vendor *</Label>
                                <div className="contact-dropdown-container">
                                    <BankAccountContactDropdown
                                        value={validation.values.billFrom}
                                        onChange={handleBillFromChange}
                                        onBlur={validation.handleBlur}
                                        disabled={isProcessing}
                                        placeholder="Select Vendor"
                                        error={validation.errors.billFrom}
                                        touched={validation.touched.billFrom}
                                        showBankAccounts={true}
                                        showContacts={true}
                                    />
                                </div>
                                <FormFeedback>{validation.errors.billFrom}</FormFeedback>
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
                                    <option value="">Select Tax</option>
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
                                    name="discountScope"
                                    value={validation.values.discountScope}
                                onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    invalid={validation.touched.discountScope && !!validation.errors.discountScope}
                                    disabled={isProcessing}
                                    style={{ height: '35px' }}
                            >
                                    {DISCOUNT_TYPES.map(discount => (
                                        <option key={discount.value} value={discount.value}>{discount.label}</option>
                                    ))}
                            </Input>
                                <FormFeedback>{validation.errors.discountScope}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    {/* Secondary Options Row - Only show when needed */}
                    {(shouldShowTaxRate || shouldShowDiscountValueType || shouldShowBankAccountDropdown) && (
                        <Row className="g-2 mb-3">
                            {shouldShowTaxRate && (
                                <Col md={3}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small fw-bold">Rate Type *</Label>
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
                                        <FormFeedback>{validation.errors.rateType}</FormFeedback>
                                    </FormGroup>
                        </Col>
                            )}
                            {shouldShowDiscountValueType && (
                                <Col md={3}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small fw-bold">Discount Value</Label>
                                        <InputGroup size="sm">
                                            <Input
                                                type="number"
                                                name="discountValue"
                                                min="0"
                                                step="0.01"
                                                value={validation.values.discountValue}
                                                onChange={validation.handleChange}
                                                onBlur={validation.handleBlur}
                                                invalid={validation.touched.discountValue && !!validation.errors.discountValue}
                                                disabled={isProcessing}
                                                placeholder="0"
                                                style={{ height: '35px' }}
                                            />
                                            <Button
                                                color={validation.values.discountValueType === 'rupees' ? 'primary' : 'outline-secondary'}
                                                size="sm"
                                                onClick={() => {
                                                    validation.setFieldValue('discountValueType', 'rupees');
                                                    setHasChanges(true); // Mark that changes have been made
                                                }}
                                                style={{ minWidth: '35px', height: '35px' }}
                                                type="button"
                                            >
                                                ₹
                                            </Button>
                                            <Button
                                                color={validation.values.discountValueType === 'percentage' ? 'primary' : 'outline-secondary'}
                                                size="sm"
                                                onClick={() => {
                                                    validation.setFieldValue('discountValueType', 'percentage');
                                                    setHasChanges(true); // Mark that changes have been made
                                                }}
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
                            {shouldShowBankAccountDropdown && (
                                <Col md={4}>
                                    <FormGroup className="mb-0">
                                        <Label className="form-label small fw-bold">Payment Bank *</Label>
                                        <div style={{ height: '35px' }}>
                                            <BankAccountDropdown
                                                value={validation.values.billFromBank}
                                                onChange={handleBillFromBankChange}
                                                onBlur={() => validation.setFieldTouched('billFromBank', true)}
                                                disabled={isProcessing}
                                                placeholder="Select Bank"
                                                error={validation.errors.billFromBank}
                                                touched={validation.touched.billFromBank}
                                            />
                                        </div>
                                        {validation.touched.billFromBank && validation.errors.billFromBank && (
                                            <div className="invalid-feedback d-block">{validation.errors.billFromBank}</div>
                                        )}
                                    </FormGroup>
                                </Col>
                            )}
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
                                <Col md={3}>
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
                                                    className="p-2 border-bottom small cursor-pointer hover-bg-light"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        selectProduct(product);
                                                    }}
                                                        style={{ cursor: 'pointer' }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--vz-light-bg-subtle)'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                                    >
                                                        <div className="fw-medium">{product.name}</div>
                                                    <div className="text-muted">{product.itemCode} • ₹{parseFloat(product.rate || 0).toFixed(2)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Col>
                            
                            {/* Serial Number - Only visible for serialized products */}
                            {newItem.isSerialized && (
                                <Col md={2}>
                                    <Label className="form-label small fw-bold">Serial Number</Label>
                                    <InputGroup size="sm">
                                        <Input
                                            id="serialNumberInput"
                                            type="text"
                                            value={newSerialNumber}
                                            onChange={(e) => setNewSerialNumber(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addSerialNumber();
                                                }
                                            }}
                                            placeholder="Enter serial"
                                            style={{ height: '35px' }}
                                        />
                                        <Button
                                            color="primary"
                                            size="sm"
                                            onClick={addSerialNumber}
                                            disabled={!newSerialNumber.trim()}
                                            type="button"
                                            style={{ height: '35px', minWidth: '30px' }}
                                        >
                                            +
                                        </Button>
                                    </InputGroup>
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
                                            parseFloat(newItem.quantity) <= 0
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

                    {/* Existing Serial Numbers Reference - Professional and compact */}
                    {newItem.isSerialized && newItem.productName && newItem.availableSerialNumbers.length > 0 && (
                        <div className="mb-2 p-2 border rounded" style={{ backgroundColor: '#fff8e1', borderColor: '#ffc107' }}>
                            <div className="d-flex justify-content-between align-items-center">
                                <strong className="small text-dark">
                                    {newItem.availableSerialNumbers.length} serial numbers already in stock
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
                                            color="light"
                                            className="text-dark border"
                                            style={{ fontSize: '0.7rem' }}
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

                    {/* New Serial Numbers for Purchase - Compact */}
                    {newItem.isSerialized && newItem.productName && newItem.serialNumbers.length > 0 && (
                        <div className="mb-2 p-2 border rounded" style={{ backgroundColor: '#e8f5e8', borderColor: '#28a745' }}>
                            <strong className="small text-dark">
                                New Serial Numbers ({newItem.serialNumbers.length}): 
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
                                        <th style={{ width: shouldShowTaxRate && shouldShowItemDiscountField ? '20%' : '26%' }}>Product</th>
                                        <th style={{ width: '8%' }}>Qty</th>
                                        {validation?.values?.rateType === 'with_tax' && shouldShowTaxRate ? (
                                            <th style={{ width: '10%' }}>Rate (Without tax)</th>
                                        ) : (
                                            <th style={{ width: '10%' }}>Rate</th>
                                        )}
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
                                            {validation?.values?.rateType === 'with_tax' && shouldShowTaxRate ? (
                                                <td className="text-end small">
                                                    ₹{parseFloat(item.rateWithoutTax || item.rate / (1 + (parseFloat(item.taxRate) / 100))).toFixed(2)}
                                                </td>
                                            ) : (
                                                <td className="text-end small">₹{parseFloat(item.rate).toFixed(2)}</td>
                                            )}
                                            {shouldShowTaxRate && (
                                                <>
                                            <td className="text-center small">{item.taxRate}%</td>
                                                    <td className="text-end small">₹{parseFloat(item.taxAmount || 0).toFixed(2)}</td>
                                                </>
                                            )}
                                            {shouldShowItemDiscountField && (
                                            <td className="text-end small">
                                                {item.discountAmount > 0 ? (
                                                    `₹${parseFloat(item.discountAmount || 0).toFixed(2)}`
                                                ) : '-'}
                                            </td>
                                            )}
                                            <td className="text-end fw-bold small">₹{parseFloat(item.total || 0).toFixed(2)}</td>
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
                                                                    validation.setFieldValue('transportationCharge', e.target.value === '' ? '' : charge);
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
                                                                    validation.setFieldValue('roundOff', roundOff);
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
                                        <span className="fw-bold text-primary fs-5">₹{parseFloat(totals.netPayable || 0).toFixed(2)}</span>
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

                <ModalFooter className="p-3">
                    <div className="d-flex justify-content-between w-100 align-items-center">
                        <Button color="secondary" onClick={toggle} disabled={isProcessing} size="sm">
                            <RiCloseLine className="me-1" /> Cancel
                        </Button>
                        <div className="d-flex align-items-center gap-2">
                            <span className="small text-muted">
                                Items: {items.length} | Total: ₹{parseFloat(totals.netPayable || 0).toFixed(2)}
                            </span>
                            <Button 
                                color="primary" 
                                type="submit" 
                                disabled={isProcessing || items.length === 0 || !validation.isValid}
                                size="sm"
                                title="Create Invoice (Ctrl+S)"
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

export default FastPurchaseInvoiceForm; 
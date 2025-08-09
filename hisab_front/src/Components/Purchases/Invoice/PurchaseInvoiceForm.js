import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  FormFeedback,
  Button,
  Row,
  Col,
  Table,
  InputGroup,
  InputGroupText,
  Badge
} from 'reactstrap';
import {
  RiLoader4Line,
  RiCloseLine,
  RiAddLine,
} from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { listProducts } from '../../../services/products';
import { getNextInvoiceNumber } from '../../../services/purchaseInvoice';
import ItemModal from './ItemModal';
import { DISCOUNT_TYPES, TAX_TYPES, STATUS_OPTIONS } from './contant'
import BankAccountContactDropdown from '../../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../../Common/BankAccountDropdown';

const PurchaseInvoiceForm = ({
  isOpen,
  toggle,
  isEditMode,
  selectedInvoice,
  onSubmit,
  isLoading = false
}) => {
  const getInitialItems = useCallback(() => {
    return selectedInvoice?.items?.map(item => {
      // Calculate the correct values for the item
      const quantity = item.isSerialized ? (item.serialNumbers || []).length : item.quantity;
      const subtotal = quantity * item.rate;
      const taxAmount = (subtotal * (item.taxRate || 0)) / 100;
      const discount = (subtotal * (item.discountRate || 0)) / 100;
      const total = subtotal + taxAmount - discount;
      
      // For edit mode: Subtract the original quantity from current stock for validation
      // This represents the stock that was there before this purchase was made
      const originalQuantity = parseFloat(item.quantity || 0);
      const currentStockWithPurchase = parseFloat(item.currentStock || 0);
      const stockBeforePurchase = isEditMode ? Math.max(0, currentStockWithPurchase - originalQuantity) : currentStockWithPurchase;
      
      return {
        id: item.id,
        productId: item.productId,
        name: item.name,        // This should now match the transformed data
        code: item.code,        // This should now match the transformed data
        quantity: item.quantity,
        rate: item.rate,
        taxRate: item.taxRate,
        taxAmount: taxAmount,
        discount: discount,
        discountRate: item.discountRate,
        total: total,
        isSerialized: item.isSerialized,
        serialNumbers: item.serialNumbers || [],
        currentStock: stockBeforePurchase,
        originalQuantity: originalQuantity // Keep track of original quantity for reference
      };
    }) || [
        {
          id: Date.now(),
          productId: null,
          name: '',
          code: '',
          quantity: 1,
          rate: 0,
          taxRate: 0,
          taxAmount: 0,
          discount: 0,
          discountRate: 0,
          total: 0,
          isSerialized: false,
          serialNumbers: [],
          currentStock: 0,
          originalQuantity: 0
        }
      ];
  }, [selectedInvoice, isEditMode]);

  const [items, setItems] = useState(() => getInitialItems());
  const [selectedDate, setSelectedDate] = useState(() =>
    selectedInvoice?.date ? new Date(selectedInvoice.date) : new Date()
  );
  const [addItemModal, setAddItemModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollContainerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const [suggestedInvoiceNumber, setSuggestedInvoiceNumber] = useState('');

  const fetchProductsRef = useRef(false);
  const lastSearchTermRef = useRef('');
  const lastPageRef = useRef(1);

  // Fetch next invoice number
  const fetchNextInvoiceNumber = useCallback(async () => {
    if (!isEditMode) {
      try {
        console.log('Fetching next invoice number for purchase...');
        const response = await getNextInvoiceNumber();
        console.log('Purchase invoice number response:', response);
        if (response.success && response.nextInvoiceNumber) {
          setSuggestedInvoiceNumber(response.nextInvoiceNumber);
          console.log('Set suggested purchase invoice number:', response.nextInvoiceNumber);
        }
      } catch (error) {
        console.error('Error fetching next invoice number:', error);
      }
    }
  }, [isEditMode]);

  const calculateItemTotal = useCallback((item) => {
    const quantity = item.isSerialized ? item.serialNumbers.length : item.quantity;
    const subtotal = quantity * item.rate;
    
    // Calculate discount first
    const discountRate = parseFloat(item.discountRate) || 0;
    const discount = (subtotal * discountRate) / 100;
    const afterDiscount = subtotal - discount;
    
    // Calculate tax on the amount after discount
    const taxRate = parseFloat(item.taxRate) || 0;
    const taxAmount = (afterDiscount * taxRate) / 100;
    
    const total = afterDiscount + taxAmount;
    
    return { 
      ...item, 
      quantity, 
      subtotal,
      taxAmount, 
      discount, 
      total 
    };
  }, []);

  // Function to calculate the correct total for display in the table
  const calculateItemTotalForDisplay = useCallback((item) => {
    const quantity = item.isSerialized ? item.serialNumbers.length : item.quantity;
    const subtotal = quantity * item.rate;
    
    // Calculate discount first
    const discountRate = parseFloat(item.discountRate) || 0;
    const discount = (subtotal * discountRate) / 100;
    const afterDiscount = subtotal - discount;
    
    // Calculate tax on the amount after discount
    const taxRate = parseFloat(item.taxRate) || 0;
    const taxAmount = (afterDiscount * taxRate) / 100;
    
    const total = afterDiscount + taxAmount;
    
    return total;
  }, []);

  const calculateInvoiceTotals = useCallback((values, itemsData) => {
    // Basic Amount is the sum of all items' Total column (which includes item-level discounts and tax)
    const basicAmount = itemsData.reduce((sum, item) => sum + calculateItemTotalForDisplay(item), 0);
    let totalDiscount = 0;
    let updatedItems = [...itemsData];

    if (values.discountType === 'per_item') {
      // For per_item, no invoice discount
      totalDiscount = 0;
    } else if (values.discountType === 'on_invoice') {
      totalDiscount = (basicAmount * values.discountValue) / 100;
    } else if (values.discountType === 'per_item_and_invoice') {
      // For per_item_and_invoice, invoice discount is applied on the basic amount
      totalDiscount = (basicAmount * values.discountValue) / 100;
    }

    const netBeforeRound = basicAmount - totalDiscount;
    const roundOff = Math.round(netBeforeRound) - netBeforeRound;
    const netPayable = Math.round(netBeforeRound);

    const billFromParts = values.billFrom.split('_');
    const billFromType = billFromParts[0];
    const billFromId = billFromParts[1];

    const payload = {
      ...values,
      date: new Date(values.date).toISOString(),
      items: updatedItems.map(item => {
        const quantity = item.isSerialized ? item.serialNumbers.length : item.quantity;
        const subtotal = quantity * item.rate;
        
        // Calculate discount first
        const discountRate = parseFloat(item.discountRate) || 0;
        const discount = (subtotal * discountRate) / 100;
        const afterDiscount = subtotal - discount;
        
        // Calculate tax on the amount after discount
        const taxRate = parseFloat(item.taxRate) || 0;
        const taxAmount = (afterDiscount * taxRate) / 100;
        
        const total = afterDiscount + taxAmount;
        
        return {
          id: item.id,
          productId: item.productId,
          name: item.name,
          code: item.code,
          quantity: item.isSerialized ? item.serialNumbers.length : item.quantity,
          rate: item.rate,
          taxRate: item.taxRate,
          taxAmount: taxAmount,
          discount: discount,
          discountRate: item.discountRate,
          total: total,
          isSerialized: item.isSerialized,
          serialNumbers: item.isSerialized ? item.serialNumbers : undefined,
          currentStock: item.currentStock
        };
      }),
      basicAmount,
      totalDiscount,
      roundOff,
      netPayable
    };

    // Handle both billFromBank and billFromContact - they can both be present
    if (billFromType === 'bank') {
      payload.billFromBank = billFromId;
      payload.billFromContact = null;
      payload.status = 'paid'; // Bank transactions are always paid
    } else if (billFromType === 'contact') {
      payload.billFromContact = billFromId;
      // Set default status if none selected
      if (!values.status) {
        payload.status = 'pending';
      } else {
        payload.status = values.status;
      }
      // Only include bank account if status is 'paid'
      if (payload.status === 'paid' && values.billFromBank) {
        payload.billFromBank = values.billFromBank;
      } else {
        payload.billFromBank = null; // Clear bank account for pending status
      }
    }

    return payload;
  }, []);

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
    discountType: Yup.string().required('Discount type is required'),
    discountValue: Yup.number().min(0, 'Discount cannot be negative'),
    status: Yup.string().when('billFrom', {
      is: (billFrom) => billFrom && billFrom.startsWith('contact_'),
      then: (schema) => schema.required('Status is required'),
      otherwise: (schema) => schema
    }),
    items: Yup.array().of(
      Yup.object().shape({
        name: Yup.string().required('Item name is required'),
        quantity: Yup.number().min(0.01, 'Quantity must be at least 0.01').required('Quantity is required'),
        rate: Yup.number().min(0, 'Rate cannot be negative').required('Rate is required'),
        taxAmount: Yup.number().min(0, 'Tax cannot be negative'),
        discount: Yup.number().min(0, 'Discount cannot be negative'),
        total: Yup.number().min(0, 'Total cannot be negative').required('Total is required'),
        isSerialized: Yup.boolean(),
        serialNumbers: Yup.array().when('isSerialized', {
          is: true,
          then: (schema) => schema
            .min(1, 'At least one serial number is required for serialized products')
            .test(
              'stock-check',
              'Number of serial numbers cannot exceed current stock',
              function (value) {
                const currentStock = this.parent.currentStock;
                return !currentStock || !value || value.length <= currentStock;
              }
            ),
          otherwise: (schema) => schema
        })
      })
    ).min(1, 'At least one item is required'),
    internalNotes: Yup.string().max(250, 'Notes cannot exceed 250 characters'),
    basicAmount: Yup.number().min(0, 'Basic amount cannot be negative'),
    totalDiscount: Yup.number().min(0, 'Discount cannot be negative'),
    taxAmount: Yup.number().min(0, 'Tax cannot be negative'),
    roundOff: Yup.number(),
    netPayable: Yup.number().min(0, 'Net payable cannot be negative').required('Net payable is required')
  }), []);

  const initialValues = useMemo(() => {
    let billFromValue = '';
    let billFromBankValue = '';
    
    if (isEditMode && selectedInvoice) {
      // If both contact and bankAccount are present, show contact in Bill From and bank in Payment Bank Account
      if (selectedInvoice.contact?.id && selectedInvoice.bankAccount?.id) {
        billFromValue = `contact_${selectedInvoice.contact.id}`;
        billFromBankValue = selectedInvoice.bankAccount.id.toString();
      }
      // If only bankAccount is present, show bank in Bill From
      else if (selectedInvoice.bankAccount?.id) {
        billFromValue = `bank_${selectedInvoice.bankAccount.id}`;
      }
      // If only contact is present, show contact in Bill From
      else if (selectedInvoice.contact?.id) {
        billFromValue = `contact_${selectedInvoice.contact.id}`;
      }
    }

    return {
      id: isEditMode && selectedInvoice ? selectedInvoice.id : '',
      invoiceNumber: isEditMode && selectedInvoice ? selectedInvoice.invoiceNumber : '',
      date: isEditMode && selectedInvoice ? selectedInvoice.date?.split('T')[0] : new Date().toISOString().split('T')[0],
      billFrom: billFromValue,
      billFromBank: billFromBankValue,
      taxType: isEditMode && selectedInvoice ? selectedInvoice.taxType : 'no_tax',
      discountType: isEditMode && selectedInvoice ? selectedInvoice.discountType : 'none',
      discountValue: isEditMode && selectedInvoice ? selectedInvoice.discountValue : 0,
      status: isEditMode && selectedInvoice ? selectedInvoice.status : '',
      items: isEditMode && selectedInvoice ? selectedInvoice.items : [
        {
          id: Date.now(),
          name: '',
          code: '',
          quantity: 1,
          rate: 0,
          taxRate: 0,
          taxAmount: 0,
          discount: 0,
          discountRate: 0,
          total: 0,
          isSerialized: false,
          serialNumbers: [],
          currentStock: 0
        }
      ],
      internalNotes: isEditMode && selectedInvoice ? selectedInvoice.internalNotes : '',
      basicAmount: isEditMode && selectedInvoice ? selectedInvoice.basicAmount : 0,
      totalDiscount: isEditMode && selectedInvoice ? selectedInvoice.totalDiscount : 0,
      taxAmount: isEditMode && selectedInvoice ? selectedInvoice.taxAmount : 0,
      roundOff: isEditMode && selectedInvoice ? selectedInvoice.roundOff : 0,
      netPayable: isEditMode && selectedInvoice ? selectedInvoice.netPayable : 0
    };
  }, [isEditMode, selectedInvoice]);

  const validation = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        setIsSubmitting(true);
        const calculatedValues = calculateInvoiceTotals(values, items);
        await onSubmit(calculatedValues);
      } catch (error) {
        console.error('Error submitting form:', error);
      } finally {
        setIsSubmitting(false);
        setSubmitting(false);
      }
    }
  });

  // Custom handler for billFrom dropdown (ReactSelect)
  const handleBillFromChange = (selectedOption) => {
    validation.setFieldValue('billFrom', selectedOption?.value || '');
    // Only clear billFromBank if the selected option is not a contact
    if (!selectedOption?.value?.startsWith('contact_')) {
      validation.setFieldValue('billFromBank', '');
    }
  };

  // Custom handler for billFromBank dropdown
  const handleBillFromBankChange = (selectedOption) => {
    validation.setFieldValue('billFromBank', selectedOption?.value || '');
  };

  // Custom handler for status changes
  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    validation.setFieldValue('status', newStatus);
    
    // Clear bank account if status changes from 'paid' to 'pending'
    if (newStatus === 'pending' && validation.values.billFromBank) {
      validation.setFieldValue('billFromBank', '');
    }
  };

  // Check if status dropdown should be shown
  const shouldShowStatusDropdown = useMemo(() => {
    // Show status dropdown only when a contact is selected
    return validation.values.billFrom && 
           validation.values.billFrom.startsWith('contact_');
  }, [validation.values.billFrom]);

  // Check if bank account dropdown should be shown
  const shouldShowBankAccountDropdown = useMemo(() => {
    // Show dropdown only when status is 'paid' and a contact is selected
    return validation.values.status === 'paid' && 
           validation.values.billFrom && 
           validation.values.billFrom.startsWith('contact_');
  }, [validation.values.status, validation.values.billFrom]);

  const calculatedTotals = useMemo(() => {
    // Basic Amount is the sum of all items' Total column (which includes item-level discounts and tax)
    const basicAmount = items.reduce((sum, item) => sum + calculateItemTotalForDisplay(item), 0);
    
    let totalDiscount = 0;
    let invoiceDiscount = 0;

    const discountType = validation.values.discountType || 'none';
    const discountValue = validation.values.discountValue || 0;

    if (discountType === 'per_item') {
      // For per_item, no invoice discount
      totalDiscount = 0;
    } else if (discountType === 'on_invoice') {
      invoiceDiscount = (basicAmount * discountValue) / 100;
      totalDiscount = invoiceDiscount;
    } else if (discountType === 'per_item_and_invoice') {
      // For per_item_and_invoice, invoice discount is applied on the basic amount
      invoiceDiscount = (basicAmount * discountValue) / 100;
      totalDiscount = invoiceDiscount;
    }

    const netBeforeRound = basicAmount - totalDiscount;
    const roundOff = Math.round(netBeforeRound) - netBeforeRound;
    const netPayable = Math.round(netBeforeRound);

    return {
      basicAmount,
      totalDiscount,
      invoiceDiscount,
      roundOff,
      netPayable
    };
  }, [items, validation.values.discountType, validation.values.discountValue, calculateItemTotalForDisplay]);

  useEffect(() => {
    if (isOpen) {
      // Reset all state
      const initialItems = getInitialItems();
      setItems(initialItems);
      setSelectedDate(isEditMode && selectedInvoice?.date ? new Date(selectedInvoice.date) : new Date());

      // Fetch next invoice number for new invoices
      fetchNextInvoiceNumber();

      // Clear search-related states
      setProducts([]);
      setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
      setSearchTerm('');
      fetchProductsRef.current = false;
      lastSearchTermRef.current = '';
      lastPageRef.current = 1;

      // Mark as initialized
      isInitializedRef.current = true;
    } else {
      // Reset initialization flag when modal closes
      isInitializedRef.current = false;
    }
  }, [isOpen, isEditMode, selectedInvoice?.id, selectedInvoice?.date, getInitialItems, fetchNextInvoiceNumber]);

  useEffect(() => {
    if (isOpen && isInitializedRef.current) {
      validation.setValues(prev => ({
        ...prev,
        items: items,
        basicAmount: calculatedTotals.basicAmount,
        taxAmount: calculatedTotals.taxAmount,
        totalDiscount: calculatedTotals.totalDiscount,
        roundOff: calculatedTotals.roundOff,
        netPayable: calculatedTotals.netPayable
      }), false);
    }
  }, [calculatedTotals, items, isOpen]);

  // Recalculate all items when discount type changes
  useEffect(() => {
    if (isOpen && items.length > 0) {
      const updatedItems = items.map(item => calculateItemTotal(item));
      setItems(updatedItems);
    }
  }, [validation.values.discountType, isOpen, calculateItemTotal]);

  useEffect(() => {
    fetchNextInvoiceNumber();
  }, [fetchNextInvoiceNumber]);

  // Auto-populate invoice number when suggestion is available
  useEffect(() => {
    if (suggestedInvoiceNumber && !validation.values.invoiceNumber && !isEditMode) {
      validation.setFieldValue('invoiceNumber', suggestedInvoiceNumber);
    }
  }, [suggestedInvoiceNumber, validation.values.invoiceNumber, isEditMode]);

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

  useEffect(() => {
    if (addItemModal) {
      const timeoutId = setTimeout(() => {
        if (searchTerm !== lastSearchTermRef.current) {
          setProducts([]);
          setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
          fetchProducts(1, searchTerm, true);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [addItemModal, searchTerm, fetchProducts]);

  useEffect(() => {
    if (addItemModal && products.length === 0) {
      fetchProducts(1, '', true);
    }
  }, [addItemModal]);

  const getDefaultTaxRate = useCallback(() => {
    const selectedTaxType = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
    return selectedTaxType ? selectedTaxType.rate : 0;
  }, [validation.values.taxType]);

  const handleDateChange = useCallback((date) => {
    setSelectedDate(date);
    validation.setFieldValue('date', date.toISOString());
  }, [validation]);

  const openAddItemModal = useCallback((item = null) => {
    const defaultTaxRate = getDefaultTaxRate();
    setCurrentItem(item || {
      id: Date.now(),
      productId: null,
      name: '',
      code: '',
      quantity: 1,
      rate: 0,
      taxRate: defaultTaxRate,
      taxAmount: 0,
      discount: 0,
      discountRate: 0,
      total: 0,
      isSerialized: false,
      serialNumbers: [],
      currentStock: 0
    });
    setAddItemModal(true);
    setSearchTerm('');
    setProducts([]);
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
    fetchProductsRef.current = false;
    lastSearchTermRef.current = '';
    lastPageRef.current = 1;
  }, [getDefaultTaxRate]);

  const closeAddItemModal = useCallback(() => {
    setAddItemModal(false);
    setCurrentItem(null);
    setSearchTerm('');
  }, []);

  const saveItem = useCallback((item) => {
    const calculatedItem = calculateItemTotal(item);
    setItems(prevItems => {
      const existingIndex = prevItems.findIndex(i => i.id === calculatedItem.id);
      let updatedItems;
      if (existingIndex >= 0) {
        updatedItems = [...prevItems];
        updatedItems[existingIndex] = calculatedItem;
      } else {
        updatedItems = [...prevItems, calculatedItem];
      }
      // Force Formik to re-validate items
      validation.setFieldTouched('items', true, false);
      validation.setFieldValue('items', updatedItems, true);
      return updatedItems;
    });
    closeAddItemModal();
  }, [calculateItemTotal, closeAddItemModal, validation]);

  const removeItem = useCallback((id) => {
    if (items.length > 1) {
      const updatedItems = items.filter(item => item.id !== id);
      setItems(updatedItems);
      // Force Formik to re-validate items
      validation.setFieldTouched('items', true, false);
      validation.setFieldValue('items', updatedItems, true);
    }
  }, [items, validation]);

  const updateCurrentItem = useCallback((field, value) => {
    setCurrentItem(prev => {
      if (!prev) return null;
  
      const updatedItem = { ...prev, [field]: value };
  
      if (['rate', 'quantity', 'taxRate', 'discountRate'].includes(field)) {
        const quantity = updatedItem.isSerialized ? updatedItem.serialNumbers.length : updatedItem.quantity;
        const subtotal = updatedItem.rate * quantity;
        const taxRate = parseFloat(updatedItem.taxRate) || 0;
        const discountRate = parseFloat(updatedItem.discountRate) || 0;
  
        updatedItem.taxAmount = (subtotal * taxRate) / 100;
        updatedItem.discount = (subtotal * discountRate) / 100;
        updatedItem.total = subtotal + updatedItem.taxAmount - updatedItem.discount;
      }
  
      return updatedItem;
    });
  }, []);

  const selectProduct = useCallback((product) => {
    const defaultTaxRate = getDefaultTaxRate();
    const productTaxRate = parseFloat(product.taxRate) || defaultTaxRate;
    const quantity = currentItem?.isSerialized ? currentItem.serialNumbers.length : currentItem?.quantity || 1;
    const subtotal = (currentItem?.rate || 0) * quantity;

    const updatedItem = {
      ...currentItem,
      id: currentItem?.id || Date.now(),
      productId: product.id,
      name: product.name,
      code: product.itemCode,
      taxRate: productTaxRate,
      isSerialized: product.isSerialized,
      currentStock: product.currentStock,
      taxAmount: (subtotal * productTaxRate) / 100,
      total: subtotal + ((subtotal * productTaxRate) / 100) - (currentItem?.discount || 0)
    };

    setCurrentItem(updatedItem);
  }, [currentItem, getDefaultTaxRate]);

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isNearBottom = scrollHeight - scrollTop <= clientHeight * 1.2;

    if (isNearBottom &&
      pagination.page < pagination.totalPages &&
      !isFetchingMore &&
      !loadingProducts &&
      !fetchProductsRef.current) {
      fetchProducts(pagination.page + 1, searchTerm);
    }
  }, [pagination, isFetchingMore, loadingProducts, searchTerm, fetchProducts]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const isProcessing = isSubmitting || isLoading;



  return (
    <>
      <Modal isOpen={isOpen} toggle={toggle} size="xl">
        <ModalHeader toggle={toggle}>
          {isEditMode ? 'Edit Purchase Invoice' : 'New Purchase Invoice'}
        </ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => {
            e.preventDefault();
            validation.handleSubmit();
          }}>
            <Row className="mb-4">
              <Col md={6}>
                <h4>Purchase Invoice</h4>
                <div className="text-muted">{new Date().toLocaleDateString('en-GB')}</div>
              </Col>
            </Row>

            <Row className="mb-4">
              <Col md={6}>
                <FormGroup>
                  <Label>Date</Label>
                  <DatePicker
                    selected={selectedDate}
                    onChange={handleDateChange}
                    className="form-control"
                    dateFormat="dd/MM/yyyy"
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Invoice Number</Label>
                  <Input
                    type="text"
                    name="invoiceNumber"
                    value={validation.values.invoiceNumber}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.invoiceNumber && !!validation.errors.invoiceNumber}
                    disabled={isProcessing}
                    placeholder="Enter invoice number"
                  />
                  {suggestedInvoiceNumber && !validation.values.invoiceNumber && (
                    <div className="mt-2">
                      <small className="text-muted me-2">Suggested: {suggestedInvoiceNumber}</small>
                      <button 
                        type="button" 
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => validation.setFieldValue('invoiceNumber', suggestedInvoiceNumber)}
                        disabled={isProcessing}
                      >
                        Use Suggested
                      </button>
                    </div>
                  )}
                  {!suggestedInvoiceNumber && !isEditMode && (
                    <small className="text-muted">
                      <button 
                        type="button" 
                        className="btn btn-link btn-sm p-0" 
                        onClick={fetchNextInvoiceNumber}
                        disabled={isProcessing}
                      >
                        Click to generate invoice number
                      </button>
                    </small>
                  )}
                  <FormFeedback>{validation.errors.invoiceNumber}</FormFeedback>
                </FormGroup>
              </Col>
            </Row>

            <Row className="mb-4">
              <Col md={6}>
                <FormGroup>
                  <Label>Bill From</Label>
                  <BankAccountContactDropdown
                    value={validation.values.billFrom}
                    onChange={handleBillFromChange}
                    onBlur={validation.handleBlur}
                    disabled={isProcessing}
                    placeholder="Select Vendor"
                    error={validation.errors.billFrom}
                    touched={validation.touched.billFrom}
                  />
                  <FormFeedback>{validation.errors.billFrom}</FormFeedback>
                </FormGroup>
              </Col>
              {shouldShowStatusDropdown && (
                <Col md={6}>
                  <FormGroup>
                    <Label>Status</Label>
                    <Input
                      type="select"
                      name="status"
                      value={validation.values.status}
                      onChange={handleStatusChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.status && !!validation.errors.status}
                      disabled={isProcessing}
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </Input>
                    <FormFeedback>{validation.errors.status}</FormFeedback>
                  </FormGroup>
                </Col>
              )}
            </Row>

            {shouldShowBankAccountDropdown && (
              <Row className="mb-4">
                <Col md={6}>
                  <FormGroup>
                    <Label>Payment Bank Account <span className="text-danger">*</span></Label>
                    <BankAccountDropdown
                      value={validation.values.billFromBank}
                      onChange={handleBillFromBankChange}
                      onBlur={() => validation.setFieldTouched('billFromBank', true)}
                      disabled={isProcessing}
                      placeholder="Select Bank Account"
                      error={validation.errors.billFromBank}
                      touched={validation.touched.billFromBank}
                    />
                    {validation.touched.billFromBank && validation.errors.billFromBank && (
                      <div className="invalid-feedback d-block">{validation.errors.billFromBank}</div>
                    )}
                  </FormGroup>
                </Col>
              </Row>
            )}

            <Row className="mb-4">
              <Col md={6}>
                <FormGroup>
                  <Label>Tax Type</Label>
                  <Input
                    type="select"
                    name="taxType"
                    value={validation.values.taxType}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.taxType && !!validation.errors.taxType}
                    disabled={isProcessing}
                  >
                    <option value="">Select Tax Type</option>
                    {TAX_TYPES.map(tax => (
                      <option key={tax.value} value={tax.value}>{tax.label}</option>
                    ))}
                  </Input>
                  <FormFeedback>{validation.errors.taxType}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Discount Type</Label>
                  <Input
                    type="select"
                    name="discountType"
                    value={validation.values.discountType}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.discountType && !!validation.errors.discountType}
                    disabled={isProcessing}
                  >
                    <option value="">Select Discount Type</option>
                    {DISCOUNT_TYPES.map(discount => (
                      <option key={discount.value} value={discount.value}>{discount.label}</option>
                    ))}
                  </Input>
                  <FormFeedback>{validation.errors.discountType}</FormFeedback>
                </FormGroup>
              </Col>
            </Row>

            {(validation.values.discountType === 'on_invoice' || validation.values.discountType === 'per_item_and_invoice') && (
              <Row className="mb-4">
                <Col md={6}>
                  <FormGroup>
                    <Label>Discount Value (%)</Label>
                    <InputGroup>
                      <Input
                        type="number"
                        name="discountValue"
                        min="0"
                        max="100"
                        step="0.01"
                        value={validation.values.discountValue}
                        onChange={validation.handleChange}
                        onBlur={validation.handleBlur}
                        invalid={validation.touched.discountValue && !!validation.errors.discountValue}
                        disabled={isProcessing}
                        placeholder="Enter discount percentage"
                      />
                      <InputGroupText>%</InputGroupText>
                    </InputGroup>
                    <FormFeedback>{validation.errors.discountValue}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>
            )}

            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Items</h5>
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => openAddItemModal()}
                  disabled={isProcessing}
                >
                  <RiAddLine className="me-1" /> Add Item
                </Button>
              </div>

              <Table bordered responsive>
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Code</th>
                    <th className="text-end">Qty</th>
                    <th className="text-end">Rate</th>
                    <th className="text-end">Tax (%)</th>
                    <th className="text-end">Tax Amount</th>
                    {(validation.values.discountType === 'per_item' || validation.values.discountType === 'per_item_and_invoice') && (
                      <th className="text-end">Discount</th>
                    )}
                    <th className="text-end">Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="fw-semibold">{item.name || 'Select item'}</div>
                        {item.code && <div className="text-muted small">{item.code}</div>}
                      </td>
                      <td>{item.code || '-'}</td>
                      <td className="text-end">{item.quantity}</td>
                      <td className="text-end">₹{item.rate.toFixed(2)}</td>
                      <td className="text-end">{item.taxRate}%</td>
                      <td className="text-end">₹{item.taxAmount.toFixed(2)}</td>
                      {(validation.values.discountType === 'per_item' || validation.values.discountType === 'per_item_and_invoice') && (
                        <td className="text-end">₹{item.discount.toFixed(2)}</td>
                      )}
                      <td className="text-end fw-bold">₹{calculateItemTotalForDisplay(item).toFixed(2)}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            color="primary"
                            size="sm"
                            onClick={() => openAddItemModal(item)}
                            disabled={isProcessing}
                          >
                            Edit
                          </Button>
                          <Button
                            color="danger"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            disabled={isProcessing || items.length <= 1}
                          >
                            <RiCloseLine />
                          </Button>
                        </div>
                        {/* Show validation errors for this item below the action buttons */}
                        {validation.errors.items && Array.isArray(validation.errors.items) && validation.errors.items[index] && (
                          <div className="text-danger small mt-1">
                            {Object.values(validation.errors.items[index]).map((err, i) => (
                              <div key={i}>{err}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <Row className="mb-4">
              <Col md={6}>
                <FormGroup>
                  <Label>Internal Notes</Label>
                  <Input
                    type="textarea"
                    name="internalNotes"
                    rows="3"
                    value={validation.values.internalNotes}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.internalNotes && !!validation.errors.internalNotes}
                    disabled={isProcessing}
                    placeholder="Enter any internal notes (optional)"
                  />
                  <FormFeedback>{validation.errors.internalNotes}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={6}>
                <div className="border p-3 bg-light">
                  <h5>Summary</h5>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Basic Amount:</span>
                    <span>₹ {calculatedTotals.basicAmount.toFixed(2)}</span>
                  </div>
                  {(validation.values.discountType === 'on_invoice' || validation.values.discountType === 'per_item_and_invoice') && calculatedTotals.invoiceDiscount > 0 && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Invoice Discount ({validation.values.discountValue}%):</span>
                      <span className="text-danger">- ₹ {calculatedTotals.invoiceDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {Math.abs(calculatedTotals.roundOff) > 0 && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Round Off:</span>
                      <span className={calculatedTotals.roundOff > 0 ? 'text-success' : 'text-danger'}>
                        {calculatedTotals.roundOff > 0 ? '+' : ''} ₹ {calculatedTotals.roundOff.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mt-3 pt-2 border-top">
                    <span className="fw-bold">Net Payable:</span>
                    <span className="fw-bold">₹ {calculatedTotals.netPayable.toFixed(2)}</span>
                  </div>
                </div>
              </Col>
            </Row>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            color="light"
            onClick={toggle}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            type="button"
            onClick={() => {
              validation.handleSubmit();
            }}
            disabled={isProcessing || !validation.isValid}
          >
            {isProcessing ? (
              <>
                <RiLoader4Line className="spin me-1" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditMode ? 'Update Invoice' : 'Create Invoice'
            )}
          </Button>
        </ModalFooter>
      </Modal>

      <ItemModal
        isOpen={addItemModal}
        toggle={closeAddItemModal}
        currentItem={currentItem}
        validation={validation}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        loadingProducts={loadingProducts}
        isFetchingMore={isFetchingMore}
        filteredProducts={filteredProducts}
        scrollContainerRef={scrollContainerRef}
        selectProduct={selectProduct}
        updateCurrentItem={updateCurrentItem}
        saveItem={saveItem}
      />
    </>
  );
};

export default PurchaseInvoiceForm;
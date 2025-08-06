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
  Table
} from 'reactstrap';
import {
  RiCloseLine,
  RiAddLine,
  RiLoader4Line,
} from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { listProducts } from '../../../services/products';
import { getNextInvoiceNumber } from '../../../services/salesInvoice';
import ItemModal from './ItemModal';
import { STATUS_OPTIONS } from './contant'
import BankAccountContactDropdown from '../../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../../Common/BankAccountDropdown';

const SalesInvoiceForm = ({
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
      const subtotal = quantity * parseFloat(item.rate || 0);
      const taxAmount = (subtotal * parseFloat(item.taxRate || 0)) / 100;
      const discount = (subtotal * parseFloat(item.discountRate || 0)) / 100;
      const total = subtotal + taxAmount - discount;
      
      return {
        id: item.id,
        productId: item.productId,
        name: item.productName || item.name,
        code: item.productCode || item.code,
        quantity: parseFloat(item.quantity || 0),
        rate: parseFloat(item.rate || 0),
        taxRate: parseFloat(item.taxRate || 0),
        taxAmount: taxAmount,
        discount: discount,
        discountRate: parseFloat(item.discountRate || 0),
        total: total,
        isSerialized: item.isSerialized,
        serialNumbers: item.serialNumbers || [],
        currentStock: parseFloat(item.currentStock || 0)
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
          currentStock: 0
        }
      ];
  }, [selectedInvoice]);

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
  const [modalKey, setModalKey] = useState(0);
  const [suggestedInvoiceNumber, setSuggestedInvoiceNumber] = useState('');

  const fetchProductsRef = useRef(false);
  const lastSearchTermRef = useRef('');
  const lastPageRef = useRef(1);
  const searchTimeoutRef = useRef(null); // Add debounce timeout ref

  // Fetch next invoice number
  const fetchNextInvoiceNumber = useCallback(async () => {
    if (!isEditMode) {
      try {
        console.log('Fetching next invoice number for sales...');
        const response = await getNextInvoiceNumber();
        console.log('Sales invoice number response:', response);
        if (response.success && response.nextInvoiceNumber) {
          setSuggestedInvoiceNumber(response.nextInvoiceNumber);
          console.log('Set suggested sales invoice number:', response.nextInvoiceNumber);
        }
      } catch (error) {
        console.error('Error fetching next invoice number:', error);
      }
    }
  }, [isEditMode]);

  const calculateItemTotal = useCallback((item) => {
    const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
    const subtotal = quantity * parseFloat(item.rate || 0);
    
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
    const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
    const subtotal = quantity * parseFloat(item.rate || 0);
    
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
    
    // Calculate total tax and total discount from all items
    const totalTax = itemsData.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const subtotal = quantity * parseFloat(item.rate || 0);
      const discountRate = parseFloat(item.discountRate) || 0;
      const discount = (subtotal * discountRate) / 100;
      const afterDiscount = subtotal - discount;
      const taxRate = parseFloat(item.taxRate) || 0;
      const taxAmount = (afterDiscount * taxRate) / 100;
      return sum + taxAmount;
    }, 0);

    const totalDiscount = itemsData.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const subtotal = quantity * parseFloat(item.rate || 0);
      const discountRate = parseFloat(item.discountRate) || 0;
      const discount = (subtotal * discountRate) / 100;
      return sum + discount;
    }, 0);
    
    const netBeforeRound = basicAmount;
    const roundOff = Math.round(netBeforeRound) - netBeforeRound;
    const netReceivable = Math.round(netBeforeRound);

    const billToParts = values.billTo.split('_');
    const billToType = billToParts[0];
    const billToId = billToParts[1];

    const payload = {
      ...values,
      date: new Date(values.date).toISOString(),
      items: itemsData.map(item => {
        const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
        const subtotal = quantity * parseFloat(item.rate || 0);
        
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
          quantity: item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0),
          rate: parseFloat(item.rate || 0),
          taxRate: parseFloat(item.taxRate || 0),
          taxAmount: taxAmount,
          discount: discount,
          discountRate: parseFloat(item.discountRate || 0),
          total: total,
          isSerialized: item.isSerialized,
          serialNumbers: item.isSerialized ? item.serialNumbers : undefined,
          currentStock: parseFloat(item.currentStock || 0)
        };
      }),
      basicAmount,
      totalTax,
      totalDiscount,
      roundOff,
      netReceivable
    };

    // Handle both billToBank and billToContact - they can both be present
    if (billToType === 'bank') {
      payload.billToBank = billToId;
      payload.billToContact = null;
    } else if (billToType === 'contact') {
      payload.billToContact = billToId;
      // Only include bank account if status is 'paid'
      if (values.status === 'paid' && values.billToBank) {
        payload.billToBank = values.billToBank;
      } else {
        payload.billToBank = null; // Clear bank account for pending status
      }
    }

    return payload;
  }, [calculateItemTotalForDisplay]);

  const validationSchema = useMemo(() => Yup.object({
    invoiceNumber: Yup.string().required('Invoice number is required'),
    date: Yup.date().required('Date is required'),
    billTo: Yup.string().required('Bill to is required'),
    status: Yup.string().required('Status is required'),
    billToBank: Yup.string().when(['status', 'billTo'], {
      is: (status, billTo) => status === 'paid' && billTo && billTo.startsWith('contact_'),
      then: (schema) => schema.required('Bank account is required when status is paid and customer is a contact'),
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
    totalTax: Yup.number().min(0, 'Total tax cannot be negative'),
    totalDiscount: Yup.number().min(0, 'Total discount cannot be negative'),
    taxAmount: Yup.number().min(0, 'Tax cannot be negative'),
    roundOff: Yup.number(),
    netReceivable: Yup.number().min(0, 'Net receivable cannot be negative').required('Net receivable is required')
  }), []);

  const initialValues = useMemo(() => {
    let billToValue = '';
    let billToBankValue = '';
    
    if (isEditMode && selectedInvoice) {
      // If both contactId and bankAccountId are present, show contact in Bill To and bank in Payment Bank Account
      if (selectedInvoice.contactId && selectedInvoice.bankAccountId) {
        billToValue = `contact_${selectedInvoice.contactId}`;
        billToBankValue = selectedInvoice.bankAccountId.toString();
      }
      // If only bankAccountId is present, show bank in Bill To
      else if (selectedInvoice.bankAccountId) {
        billToValue = `bank_${selectedInvoice.bankAccountId}`;
      }
      // If only contactId is present, show contact in Bill To
      else if (selectedInvoice.contactId) {
        billToValue = `contact_${selectedInvoice.contactId}`;
      }
    }

    return {
      id: isEditMode && selectedInvoice ? selectedInvoice.id : '',
      invoiceNumber: isEditMode && selectedInvoice ? selectedInvoice.invoiceNumber : '',
      date: isEditMode && selectedInvoice ? selectedInvoice.date : new Date().toISOString(),
      billTo: billToValue,
      billToBank: billToBankValue,
      status: isEditMode && selectedInvoice ? selectedInvoice.status : 'pending',
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
      totalTax: isEditMode && selectedInvoice ? selectedInvoice.totalTax : 0,
      totalDiscount: isEditMode && selectedInvoice ? selectedInvoice.totalDiscount : 0,
      taxAmount: isEditMode && selectedInvoice ? selectedInvoice.taxAmount : 0,
      roundOff: isEditMode && selectedInvoice ? selectedInvoice.roundOff : 0,
      netReceivable: isEditMode && selectedInvoice ? selectedInvoice.netReceivable : 0
    };
  }, [isEditMode, selectedInvoice]);

  const validation = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        setIsSubmitting(true);
        const calculatedValues = calculateInvoiceTotals(values, items);
        await onSubmit(calculatedValues);
        
        // Clear form state after successful submission
        resetForm();
        setItems([{
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
          currentStock: 0
        }]);
        setSelectedDate(new Date());
        setSearchTerm('');
        setProducts([]);
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
        // Clear billToBank field
        validation.setFieldValue('billToBank', '');
        
        // Close the modal
        toggle();
      } catch (error) {
        console.error('Error submitting form:', error);
      } finally {
        setIsSubmitting(false);
        setSubmitting(false);
      }
    }
  });

  // Custom handler for billTo dropdown (ReactSelect)
  const handleBillToChange = (selectedOption) => {
    validation.setFieldValue('billTo', selectedOption?.value || '');
    
    // Only clear billToBank if the selected option is not a contact
    // This allows preserving the bank account when switching between contacts
    if (!selectedOption?.value?.startsWith('contact_')) {
      validation.setFieldValue('billToBank', '');
    }
  };

  // Custom handler for billToBank dropdown
  const handleBillToBankChange = (selectedOption) => {
    validation.setFieldValue('billToBank', selectedOption?.value || '');
  };

  // Custom handler for status changes
  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    validation.setFieldValue('status', newStatus);
    
    // Clear bank account if status changes from 'paid' to 'pending'
    if (newStatus === 'pending' && validation.values.billToBank) {
      validation.setFieldValue('billToBank', '');
    }
  };

  // Check if bank account dropdown should be shown
  const shouldShowBankAccountDropdown = useMemo(() => {
    // Show dropdown only when status is 'paid' and a contact is selected
    return validation.values.status === 'paid' && 
           validation.values.billTo && 
           validation.values.billTo.startsWith('contact_');
  }, [validation.values.status, validation.values.billTo]);

  // Handle add contact action
  const handleAddContact = () => {
    // TODO: Open contact creation modal or navigate to contact creation page
    console.log('Add contact clicked');
    // You can implement this to open a contact creation modal
    // or navigate to a contact creation page
  };

  const calculatedTotals = useMemo(() => {
    // Basic Amount is the sum of all items' Total column (which includes item-level discounts and tax)
    const basicAmount = items.reduce((sum, item) => sum + calculateItemTotalForDisplay(item), 0);
    
    // Calculate total tax and total discount from all items
    const totalTax = items.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const subtotal = quantity * parseFloat(item.rate || 0);
      const discountRate = parseFloat(item.discountRate) || 0;
      const discount = (subtotal * discountRate) / 100;
      const afterDiscount = subtotal - discount;
      const taxRate = parseFloat(item.taxRate) || 0;
      const taxAmount = (afterDiscount * taxRate) / 100;
      return sum + taxAmount;
    }, 0);

    const totalDiscount = items.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const subtotal = quantity * parseFloat(item.rate || 0);
      const discountRate = parseFloat(item.discountRate) || 0;
      const discount = (subtotal * discountRate) / 100;
      return sum + discount;
    }, 0);
    
    const netBeforeRound = basicAmount;
    const roundOff = Math.round(netBeforeRound) - netBeforeRound;
    const netReceivable = Math.round(netBeforeRound);

    return {
      basicAmount,
      totalTax,
      totalDiscount,
      roundOff,
      netReceivable
    };
  }, [items, calculateItemTotalForDisplay]);

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      // Reset all state only when modal opens
      setSelectedDate(isEditMode && selectedInvoice?.date ? new Date(selectedInvoice.date) : new Date());
      
      // Fetch next invoice number for new invoices
      fetchNextInvoiceNumber();
      
      // Clear search-related states only if not already loaded
      if (products.length === 0) {
        setProducts([]);
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
        setSearchTerm('');
        fetchProductsRef.current = false;
        lastSearchTermRef.current = '';
        lastPageRef.current = 1;
      }

      // Mark as initialized
      isInitializedRef.current = true;
    } else {
      // Reset initialization flag when modal closes
      isInitializedRef.current = false;
    }
  }, [isOpen, isEditMode, selectedInvoice?.id, selectedInvoice?.date, fetchNextInvoiceNumber]);

  // Remove the separate useEffect for customer fetching since we're calling it in the main useEffect above

  // Separate useEffect to handle initial items when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialItems = getInitialItems();
      setItems(initialItems);
    }
  }, [isOpen, getInitialItems]);

  useEffect(() => {
    if (isOpen && isInitializedRef.current) {
      validation.setValues(prev => ({
        ...prev,
        items: items,
        basicAmount: calculatedTotals.basicAmount,
        taxAmount: calculatedTotals.totalTax,
        totalDiscount: calculatedTotals.totalDiscount,
        roundOff: calculatedTotals.roundOff,
        netReceivable: calculatedTotals.netReceivable
      }), false);

      // Auto-populate invoice number if it's empty
      if (!validation.values.invoiceNumber && suggestedInvoiceNumber && !isEditMode) {
        validation.setFieldValue('invoiceNumber', suggestedInvoiceNumber);
      }
    }
  }, [calculatedTotals.basicAmount, calculatedTotals.totalTax, calculatedTotals.totalDiscount, calculatedTotals.roundOff, calculatedTotals.netReceivable, items, isOpen, suggestedInvoiceNumber, isEditMode]); // Removed validation from dependencies



  const fetchProducts = useCallback(async (page = 1, search = '', reset = false) => {
    console.log(`fetchProducts called: page=${page}, search="${search}", reset=${reset}, fetchInProgress=${fetchProductsRef.current}`);
    
    // Prevent multiple simultaneous calls
    if (fetchProductsRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    // Check if we're requesting the same data
    if (page === lastPageRef.current && search === lastSearchTermRef.current && !reset) {
      console.log('Same data requested, skipping...');
      return;
    }

    console.log('Starting product fetch...');
    fetchProductsRef.current = true;

    if (page === 1 || reset) {
      setLoadingProducts(true);
    } else {
      setIsFetchingMore(true);
    }

    try {
      console.log(`Making API call: page=${page}, search="${search}", reset=${reset}`);
      
      const response = await listProducts({
        page,
        limit: 10,
        search,
        includeSerialNumbers: true
      });

      console.log(`API response received: ${response.products?.length || 0} products`);

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
      // Reset loading states on error
      setLoadingProducts(false);
      setIsFetchingMore(false);
    } finally {
      console.log('Product fetch completed');
      setLoadingProducts(false);
      setIsFetchingMore(false);
      fetchProductsRef.current = false;
    }
  }, []);

  // Cleanup effect when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset initialization flag when modal closes
      isInitializedRef.current = false;
      
      // Clear any pending timeouts
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      
      // Reset fetch flags
      fetchProductsRef.current = false;
    }
  }, [isOpen]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      // Clear any pending timeouts on unmount
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Add useEffect for product fetching when ItemModal opens
  useEffect(() => {
    if (addItemModal && products.length === 0) {
      // Only fetch products if the modal is open and no products are loaded
      const timeoutId = setTimeout(() => {
        fetchProducts(1, '', true);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [addItemModal]); // Simplified dependencies

  // Handle search term changes with debouncing
  useEffect(() => {
    if (addItemModal && searchTerm !== lastSearchTermRef.current) {
      // Clear any existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        setProducts([]);
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
        fetchProducts(1, searchTerm, true);
      }, 500); // Increased debounce time to 500ms

      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }
  }, [searchTerm]); // Only depend on searchTerm

  // Add scroll handler for product pagination
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

  // Add scroll event listener for product list
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    validation.setFieldValue('date', date.toISOString());
  };

  const openAddItemModal = (item = null) => {
    console.log('Opening ItemModal:', { item, productsLength: products.length });
    
    setCurrentItem(item || {
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
      currentStock: 0
    });
    setModalKey(prev => prev + 1);
    setAddItemModal(true);
    
    // Only reset search and products if we don't have any products loaded
    if (products.length === 0) {
      console.log('No products loaded, resetting search state');
      setSearchTerm('');
      setProducts([]);
      setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
      fetchProductsRef.current = false;
      lastSearchTermRef.current = '';
      lastPageRef.current = 1;
    } else {
      console.log('Products already loaded, skipping reset');
    }
  };

  const closeAddItemModal = () => {
    setAddItemModal(false);
    setCurrentItem(null);
  };

  const addItem = (item) => {
    const calculatedItem = calculateItemTotal(item);
    setItems(prev => [...prev, calculatedItem]);
    closeAddItemModal();
  };

  const updateItem = (item) => {
    const calculatedItem = calculateItemTotal(item);
    setItems(prev => prev.map(i => i.id === item.id ? calculatedItem : i));
    closeAddItemModal();
  };

  const removeItem = (itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleItemSave = (item) => {
    if (currentItem) {
      updateItem({ ...item, id: currentItem.id });
    } else {
      addItem(item);
    }
  };



  const isProcessing = isSubmitting || isLoading;

  return (
    <>
      <Modal
        isOpen={isOpen}
        toggle={toggle}
        size="xl"
        className="sales-invoice-modal"
        backdrop="static"
      >
        <ModalHeader toggle={toggle}>
          {isEditMode ? 'Edit Sales Invoice' : 'Create Sales Invoice'}
        </ModalHeader>
        <ModalBody>
          <Form onSubmit={validation.handleSubmit}>
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
                  <Label>Bill To</Label>
                  <BankAccountContactDropdown
                    value={validation.values.billTo}
                    onChange={handleBillToChange}
                    onBlur={validation.handleBlur}
                    disabled={isProcessing}
                    placeholder="Select Customer"
                    error={validation.errors.billTo}
                    touched={validation.touched.billTo}
                  />
                  <FormFeedback>{validation.errors.billTo}</FormFeedback>
                </FormGroup>
              </Col>
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
            </Row>

            {shouldShowBankAccountDropdown && (
              <Row className="mb-4">
                <Col md={6}>
                  <FormGroup>
                    <Label>Payment Bank Account <span className="text-danger">*</span></Label>
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
                    <th className="text-end">Discount (%)</th>
                    <th className="text-end">Discount Amount</th>
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
                      <td className="text-end">₹{parseFloat(item.rate || 0).toFixed(2)}</td>
                      <td className="text-end">{item.taxRate}%</td>
                      <td className="text-end">₹{parseFloat(item.taxAmount || 0).toFixed(2)}</td>
                      <td className="text-end">{item.discountRate}%</td>
                      <td className="text-end">₹{parseFloat(item.discount || 0).toFixed(2)}</td>
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
                  {calculatedTotals.totalDiscount > 0 && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Total Discount:</span>
                      <span className="text-danger">- ₹ {calculatedTotals.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {calculatedTotals.totalTax > 0 && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Total Tax:</span>
                      <span className="text-success">+ ₹ {calculatedTotals.totalTax.toFixed(2)}</span>
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
                    <span className="fw-bold">Net Receivable:</span>
                    <span className="fw-bold">₹ {calculatedTotals.netReceivable.toFixed(2)}</span>
                  </div>
                </div>
              </Col>
            </Row>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            color="secondary"
            onClick={toggle}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            color="primary"
            onClick={validation.handleSubmit}
            disabled={isProcessing || !validation.isValid || validation.values.items.length === 0}
          >
            {isProcessing ? (
              <>
                <RiLoader4Line className="spinner-border spinner-border-sm me-2" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditMode ? 'Update Invoice' : 'Create Invoice'
            )}
          </Button>
        </ModalFooter>
      </Modal>

      <ItemModal
        key={modalKey}
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
        updateCurrentItem={(field, value) => {
          setCurrentItem(prev => {
            if (!prev) return null;
            return { ...prev, [field]: value };
          });
        }}
        saveItem={handleItemSave}
      />
    </>
  );
};

export default SalesInvoiceForm; 
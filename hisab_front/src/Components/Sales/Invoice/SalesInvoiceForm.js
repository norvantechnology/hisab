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
  RiCloseLine,
  RiAddLine,
  RiLoader4Line,
  RiEditLine,
} from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { listProducts } from '../../../services/products';
import { getNextInvoiceNumber } from '../../../services/salesInvoice';
import ItemModal from './ItemModal';
import { STATUS_OPTIONS, DISCOUNT_TYPES, DISCOUNT_VALUE_TYPES, TAX_TYPES, TAX_TYPES_SIMPLE, ITEM_RATE_TYPES } from './contant'
import BankAccountContactDropdown from '../../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../../Common/BankAccountDropdown';
import { calculateItemTotalForDisplay, calculateItemTaxAmount, calculateItemTaxAndTotal } from '../../../utils/taxCalculations';

const SalesInvoiceForm = ({
  isOpen,
  toggle,
  isEditMode,
  selectedInvoice,
  onSubmit,
  isLoading = false,
  apiError = null
}) => {
  const getInitialItems = useCallback(() => {
    return selectedInvoice?.items?.map(item => {
      // Calculate the correct values for the item using common utility function
      const quantity = item.isSerialized ? (item.serialNumbers || []).length : item.quantity;
      const rate = parseFloat(item.rate || 0);
      const taxRate = parseFloat(item.taxRate || 0);
      const discountRate = parseFloat(item.discountRate || 0);
      const rateType = item.rateType || 'without_tax';
      
      // Use common utility function for consistent tax calculations
      const result = calculateItemTaxAndTotal({
        rate,
        quantity,
        taxRate,
        discountRate: (item.discountType === 'percentage') ? discountRate : 0,
        rateType,
        discountValueType: item.discountType || 'rupees',
        discountValue: (item.discountType === 'rupees') ? discountRate : 0
      });
      
      // For edit mode: Add the original quantity back to current stock for validation
      // This allows the user to edit the quantity within the available stock + the quantity they already have
      const originalQuantity = parseFloat(item.quantity || 0);
      const availableStock = parseFloat(item.currentStock || 0);
      const adjustedStock = isEditMode ? availableStock + originalQuantity : availableStock;
      
      return {
        id: item.id,
        productId: item.productId,
        name: item.productName || item.name,
        code: item.productCode || item.code,
        quantity: originalQuantity,
        rate: rate,
        rateType: rateType,
        taxRate: taxRate,
        taxAmount: result.taxAmount,
        discount: result.discount,
        discountRate: discountRate,
        discountType: item.discountType || 'percentage',
        total: result.total,
        isSerialized: item.isSerialized,
        serialNumbers: item.serialNumbers || [],
        currentStock: adjustedStock,
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
          rateType: 'without_tax',
          taxRate: 0,
          taxAmount: 0,
          discount: 0,
          discountRate: 0,
          discountType: 'percentage',
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
  const [modalKey, setModalKey] = useState(0);
  const [suggestedInvoiceNumber, setSuggestedInvoiceNumber] = useState('');
  const [isEditingRoundOff, setIsEditingRoundOff] = useState(false);
  const [tempRoundOff, setTempRoundOff] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);

  // Initialize selected contact for edit mode
  useEffect(() => {
    if (isEditMode && selectedInvoice?.contact) {
      setSelectedContact(selectedInvoice.contact);
    } else if (!isEditMode) {
      setSelectedContact(null);
    }
  }, [isEditMode, selectedInvoice?.contact]);

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

  const validationSchema = useMemo(() => Yup.object({
    invoiceNumber: Yup.string().required('Invoice number is required'),
    date: Yup.date().required('Date is required'),
    billTo: Yup.string().required('Bill to is required'),
    status: Yup.string(), // Made optional - will default to 'pending'
    billToBank: Yup.string().when(['status', 'billTo'], {
      is: (status, billTo) => status === 'paid' && billTo && billTo.startsWith('contact_'),
      then: (schema) => schema.required('Bank account is required when status is paid and customer is a contact'),
      otherwise: (schema) => schema
    }),
    taxType: Yup.string().required('Tax type is required'),
    rateType: Yup.string(), // Made optional - system can work without explicit rate type selection

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
    transportationCharge: Yup.number().nullable().min(0, 'Transportation charge cannot be negative'),
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
      date: isEditMode && selectedInvoice ? selectedInvoice.date?.split('T')[0] : new Date().toISOString().split('T')[0],
      billTo: billToValue,
      billToBank: billToBankValue,
      status: isEditMode && selectedInvoice ? selectedInvoice.status : 'pending',
      taxType: isEditMode && selectedInvoice ? selectedInvoice.taxType : 'no_tax',
      rateType: isEditMode && selectedInvoice ? 
        (TAX_TYPES.find(tax => tax.value === selectedInvoice.taxType)?.rate === 0 ? '' : selectedInvoice.rateType) : 
        '',
      discountType: 'per_item', // Fixed to per_item only since we removed invoice-level discounts
      discountValueType: 'rupees', // Default to rupees, but can be changed per item
      discountValue: 0, // No invoice-level discount
      items: isEditMode && selectedInvoice ? selectedInvoice.items : [
        {
          id: Date.now(),
          name: '',
          code: '',
          quantity: 1,
          rate: 0,
          rateType: 'without_tax',
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
      transportationCharge: isEditMode && selectedInvoice ? selectedInvoice.transportationCharge || '' : '',
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
          rateType: '',
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
    
    // When a contact is selected, automatically set status to 'pending'
    if (selectedOption?.value?.startsWith('contact_')) {
      validation.setFieldValue('status', 'pending');
      // Store the selected contact information for billing address display
      setSelectedContact(selectedOption?.contact || null);
    } else {
      // For non-contacts, set status to 'pending' as well (they can change it if needed)
      validation.setFieldValue('status', 'pending');
      validation.setFieldValue('billToBank', '');
      setSelectedContact(null);
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

  // Custom handler for tax type changes
  const handleTaxTypeChange = (e) => {
    validation.setFieldValue('taxType', e.target.value);
    
    // Clear rateType if tax type has rate 0 (no tax)
    if (TAX_TYPES.find(tax => tax.value === e.target.value)?.rate === 0) {
      validation.setFieldValue('rateType', '');
    }
    
    // Set default rateType if none is selected and tax type has a rate > 0
    if (!validation.values.rateType && TAX_TYPES.find(tax => tax.value === e.target.value)?.rate > 0) {
      validation.setFieldValue('rateType', 'without_tax');
    }
  };

  // Custom handler for rate type changes
  const handleRateTypeChange = useCallback((e) => {
    const newRateType = e.target.value;
    validation.setFieldValue('rateType', newRateType);
    
    // Live update all items based on the new rate type
    if (items.length > 0) {
      const updatedItems = items.map(item => {
        // Recalculate item based on new rate type
        const quantity = item.isSerialized ? (item.serialNumbers || []).length : item.quantity;
        const rate = parseFloat(item.rate) || 0;
        const taxRate = parseFloat(item.taxRate) || 0;
        const discountRate = parseFloat(item.discountRate) || 0;
        
        // Calculate subtotal
        let subtotal;
        if (newRateType === 'with_tax') {
          // Rate is inclusive of tax, extract base rate
          if (taxRate > 0) {
            subtotal = quantity * (rate / (1 + (taxRate / 100)));
          } else {
            subtotal = quantity * rate;
          }
        } else {
          // Rate is without tax
          subtotal = quantity * rate;
        }
        
        // Calculate discount based on discount type
        let discount = 0;
        const itemDiscountType = item.discountType || 'percentage';
        if (itemDiscountType === 'percentage') {
          discount = (subtotal * discountRate) / 100;
        } else if (itemDiscountType === 'rupees') {
          discount = discountRate;
        }
        const afterDiscount = subtotal - discount;
        
        // Calculate tax amount based on new rate type
        let taxAmount = 0;
        const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
        const shouldCalculateTax = selectedTax && selectedTax.rate > 0;
        
        if (shouldCalculateTax) {
          // Use common utility function for tax calculations
          const result = calculateItemTaxAndTotal({
            rate: rate,
            quantity,
            taxRate,
            discountRate: (item.discountType === 'percentage') ? discountRate : 0,
            rateType: newRateType,
            discountValueType: item.discountType || 'rupees',
            discountValue: (item.discountType === 'rupees') ? discountRate : 0
          });
          
          taxAmount = result.taxAmount;
        }
        
        // Calculate total
        const total = afterDiscount + taxAmount;
        
        return {
          ...item,
          rateType: newRateType, // Update item's rate type to match invoice
          taxAmount: taxAmount,
          total: total
        };
      });
      
      // Update items state with recalculated values
      setItems(updatedItems);
    }
  }, [items, validation.values.taxType]);

  // Custom handler for round-off changes
  const handleRoundOffChange = useCallback((e) => {
    const value = parseFloat(e.target.value) || 0;
    validation.setFieldValue('roundOff', value);
  }, []);

  // Function to calculate item totals (moved here to avoid validation dependency issues)
  const calculateItemTotal = useCallback((item, rateType = 'without_tax') => {
    const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
    const rate = parseFloat(item.rate || 0);
    const taxRate = parseFloat(item.taxRate) || 0;
    const discountRate = parseFloat(item.discountRate) || 0;
    
    // Use common utility function for consistent tax calculations
    const result = calculateItemTaxAndTotal({
      rate,
      quantity,
      taxRate,
      discountRate: (item.discountType === 'percentage') ? discountRate : 0,
      rateType,
      discountValueType: item.discountType || 'rupees', // Use item-level discount type
      discountValue: (item.discountType === 'rupees') ? discountRate : 0
    });
    
    return { 
      ...item, 
      quantity, 
      rateType, // Set the rateType from the parameter
      subtotal: result.subtotal,
      taxAmount: result.taxAmount, 
      discount: result.discount, 
      total: result.total 
    };
  }, []);

  // Function to calculate the correct total for display in the table
  // Now using the same logic as purchase form for consistency
  const calculateItemTotalForDisplay = useCallback((item, taxType) => {
    const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
    let subtotal;
    
    if (item.rateType === 'with_tax') {
      // Rate is inclusive of tax, so we need to extract the base rate
      const taxRate = parseFloat(item.taxRate) || 0;
      const rateWithoutTax = item.rate / (1 + (taxRate / 100));
      subtotal = quantity * rateWithoutTax;
    } else {
      // Rate is without tax
      subtotal = quantity * item.rate;
    }
    
    // Calculate discount first
    const discountRate = parseFloat(item.discountRate) || 0;
    let discount = 0;
    const itemDiscountType = item.discountType || 'percentage'; // Use item-level discount type
    if (itemDiscountType === 'percentage') {
      discount = (subtotal * discountRate) / 100;
    } else if (itemDiscountType === 'rupees') {
      discount = discountRate;
    }
    const afterDiscount = subtotal - discount;
    
    // Calculate tax based on rate type and tax type
    let taxAmount = 0;
    const selectedTax = TAX_TYPES.find(tax => tax.value === taxType);
    const shouldCalculateTax = selectedTax && selectedTax.rate > 0;
    
    if (item.rateType === 'with_tax' && shouldCalculateTax) {
      // For "With Tax" items, calculate the tax amount included in the rate
      const taxRate = parseFloat(item.taxRate) || 0;
      taxAmount = (afterDiscount * taxRate) / 100;
    } else if (item.rateType === 'without_tax' && shouldCalculateTax) {
      // For "Without Tax" items, add tax to the rate
      const taxRate = parseFloat(item.taxRate) || 0;
      taxAmount = (afterDiscount * taxRate) / 100;
    }
    
    const total = afterDiscount + taxAmount;
    return total;
  }, []);

  // Check if status dropdown should be shown
  const shouldShowStatusDropdown = useMemo(() => {
    // Show status dropdown only when a contact is selected
    return validation.values.billTo && 
           validation.values.billTo.startsWith('contact_');
  }, [validation.values.billTo]);

  // Check if bank account dropdown should be shown
  const shouldShowBankAccountDropdown = useMemo(() => {
    // Show dropdown only when status is 'paid' and a contact is selected
    return validation.values.status === 'paid' && 
           validation.values.billTo && 
           validation.values.billTo.startsWith('contact_');
  }, [validation.values.status, validation.values.billTo]);

  // Handle add contact action
  const handleAddContact = () => {
    console.log('Add contact clicked');
    // Future enhancement: Open contact creation modal
  };

  const calculateInvoiceTotals = useCallback((values, itemsData) => {
    // Basic Amount = Sum of all items' (Rate Without Tax × Quantity) - before any discounts
    const basicAmount = itemsData.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const rate = parseFloat(item.rate || 0);
      const taxRate = parseFloat(item.taxRate || 0);
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
    
    // Calculate total tax from all items
    const totalTax = itemsData.reduce((sum, item) => {
      return sum + calculateItemTaxAmount(item, values.taxType, TAX_TYPES);
    }, 0);

    // Total Discount = Sum of all individual item discounts (per_item only)
    const totalDiscount = itemsData.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const rate = parseFloat(item.rate || 0);
      const subtotal = quantity * rate;
      const discountRate = parseFloat(item.discountRate) || 0;
      
      let discount = 0;
      const itemDiscountType = item.discountType || 'percentage'; // Use item-level discount type
      if (itemDiscountType === 'percentage') {
        discount = (subtotal * discountRate) / 100;
      } else if (itemDiscountType === 'rupees') {
        discount = discountRate;
      }
      return sum + discount;
    }, 0);

    const netBeforeRound = basicAmount - totalDiscount + totalTax;
    // Add transportation charges to the calculation
    const transportationCharge = parseFloat(values.transportationCharge || 0);
    // Use user-input round-off value instead of auto-calculating
    const userRoundOff = parseFloat(values.roundOff || 0);
    const netReceivable = netBeforeRound + transportationCharge + userRoundOff;

    const billToParts = values.billTo.split('_');
    const billToType = billToParts[0];
    const billToId = billToParts[1];

    const payload = {
      // Explicitly include only non-discount fields from values
      invoiceNumber: values.invoiceNumber,
      taxType: values.taxType,
      rateType: values.rateType,
      internalNotes: values.internalNotes,
      billTo: values.billTo,
      status: values.status,
      date: new Date(values.date).toISOString(),
      items: itemsData.map(item => {
        const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
        const subtotal = quantity * parseFloat(item.rate || 0);
        
        // Calculate discount first using correct discount value type
        const discountRate = parseFloat(item.discountRate) || 0;
        let discount = 0;
        const itemDiscountType = item.discountType || 'percentage'; // Use item-level discount type
        if (itemDiscountType === 'percentage') {
          discount = (subtotal * discountRate) / 100;
        } else if (itemDiscountType === 'rupees') {
          discount = discountRate;
        }
        const afterDiscount = subtotal - discount;
        
        // Use common utility function for tax calculations to ensure consistency
        const result = calculateItemTaxAndTotal({
          rate: parseFloat(item.rate || 0),
          quantity,
          taxRate: parseFloat(item.taxRate || 0),
          discountRate,
          rateType: item.rateType || 'without_tax',
          discountValueType: itemDiscountType,
          discountValue: discountRate
        });
        
        return {
          id: item.id,
          productId: item.productId,
          name: item.name,
          code: item.code,
          quantity: item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0),
          rate: parseFloat(item.rate || 0),
          rateType: item.rateType,
          taxRate: parseFloat(item.taxRate || 0),
          taxAmount: result.taxAmount,
          discount: discount,
          discountRate: parseFloat(item.discountRate || 0),
          discountType: itemDiscountType, // Include the item-level discount type
          total: result.total,
          isSerialized: item.isSerialized,
          serialNumbers: item.isSerialized ? item.serialNumbers : undefined,
          currentStock: parseFloat(item.currentStock || 0)
        };
      }),
      basicAmount,
      taxAmount: totalTax,
      totalDiscount,
      roundOff: userRoundOff,
      transportationCharge: parseFloat(values.transportationCharge || 0),
      netReceivable,

    };

    // Handle both billToBank and billToContact - they can both be present
    if (billToType === 'bank') {
      payload.billToBank = billToId;
      payload.billToContact = null;
      payload.status = 'paid'; // Bank transactions are always paid
    } else if (billToType === 'contact') {
      payload.billToContact = billToId;
      // Set default status if none selected
      if (!values.status) {
        payload.status = 'pending';
      } else {
        payload.status = values.status;
      }
      // Only include bank account if status is 'paid'
      if (payload.status === 'paid' && values.billToBank) {
        payload.billToBank = values.billToBank;
      } else {
        payload.billToBank = null; // Clear bank account for pending status
      }
    }

    return payload;
  }, [calculateItemTaxAmount]);

  // Function to calculate totals for display (moved here to avoid dependency issues)
  const calculatedTotals = useMemo(() => {
    // Basic Amount = Sum of all items' (Rate × Quantity) - before any discounts
    const basicAmount = items.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const rate = parseFloat(item.rate || 0);
      return sum + (quantity * rate);
    }, 0);
      
    // Calculate total tax from all items
    const totalTax = items.reduce((sum, item) => {
      return sum + calculateItemTaxAmount(item, validation.values.taxType, TAX_TYPES);
    }, 0);

    // Total Discount = Sum of all individual item discounts (per_item only)
    const totalDiscount = items.reduce((sum, item) => {
      const quantity = item.isSerialized ? item.serialNumbers.length : parseFloat(item.quantity || 0);
      const rate = parseFloat(item.rate || 0);
      const subtotal = quantity * rate;
      const discountRate = parseFloat(item.discountRate) || 0;
      
      let discount = 0;
      const itemDiscountType = item.discountType || 'percentage'; // Use item-level discount type
      if (itemDiscountType === 'percentage') {
        discount = (subtotal * discountRate) / 100;
      } else if (itemDiscountType === 'rupees') {
        discount = discountRate;
      }
      return sum + discount;
    }, 0);

    const netBeforeRound = basicAmount - totalDiscount + totalTax;
    // Add transportation charges to the calculation
    const transportationCharge = parseFloat(validation.values.transportationCharge || 0);
    // Use user-input round-off value instead of auto-calculating
    const userRoundOff = parseFloat(validation.values.roundOff || 0);
    const netReceivable = netBeforeRound + transportationCharge + userRoundOff;

    return {
      basicAmount,
      totalDiscount,
      taxAmount: totalTax,
      transportationCharge,
      roundOff: userRoundOff,
      netReceivable
    };
  }, [items, validation.values.taxType, validation.values.roundOff, validation.values.transportationCharge]);

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
      // For sales invoices, preserve user-set roundOff values (don't override manual changes)
              const shouldUpdateRoundOff = Math.abs(parseFloat(validation.values.roundOff || 0)) < 0.001; // Only update if roundOff is essentially 0
      
      validation.setValues(prev => ({
        ...prev,
        items: items,
        basicAmount: calculatedTotals.basicAmount,
        taxAmount: calculatedTotals.totalTax,
        totalDiscount: calculatedTotals.totalDiscount,
        roundOff: shouldUpdateRoundOff ? calculatedTotals.roundOff : prev.roundOff, // Preserve user-set values
                  transportationCharge: calculatedTotals.transportationCharge,
        netReceivable: calculatedTotals.netReceivable
      }), false);

      // Don't auto-populate invoice number - let user choose to use suggested number via button
      // This matches the purchase form behavior where suggested number appears as a button
    }
  }, [calculatedTotals.basicAmount, calculatedTotals.totalTax, calculatedTotals.totalDiscount, calculatedTotals.roundOff, calculatedTotals.transportationCharge, calculatedTotals.netReceivable, items, isOpen, suggestedInvoiceNumber, isEditMode]); // Removed validation from dependencies

  // Reset form when switching from edit mode to new invoice mode
  useEffect(() => {
    if (!isEditMode && isOpen) {
      // Reset form to initial state for new invoice
      validation.resetForm();
      
      // Reset items to initial empty state
      setItems([{
        id: Date.now(),
        productId: null,
        name: '',
        code: '',
        quantity: 1,
        rate: 0,
        rateType: 'without_tax',
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        discountRate: 0,
        total: 0,
        isSerialized: false,
        serialNumbers: [],
        currentStock: 0
      }]);
      
      // Clear search and product states
      setProducts([]);
      setSearchTerm('');
      setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
      
      // Reset round off editing states
      setIsEditingRoundOff(false);
      setTempRoundOff('0');
      
      // Reset selected date to today
      setSelectedDate(new Date());
    }
  }, [isEditMode, isOpen]); // Removed validation dependency to prevent infinite loop

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

  // Note: Removed useEffect for discount type changes since each item now manages its own discount type

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
    const calculatedItem = calculateItemTotal(item, validation.values.rateType);
    setItems(prev => [...prev, calculatedItem]);
    closeAddItemModal();
  };

  const updateItem = (item) => {
    const calculatedItem = calculateItemTotal(item, validation.values.rateType);
    setItems(prev => prev.map(i => i.id === item.id ? calculatedItem : i));
    closeAddItemModal();
  };

  const removeItem = (itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleItemSave = (item) => {
    // Check if this is an existing item (already in the items array) or a new one
    const existingItem = items.find(i => i.id === currentItem?.id);
    if (existingItem) {
      // This is editing an existing item
      updateItem({ ...item, id: currentItem.id });
    } else {
      // This is adding a new item
      addItem(item);
    }
  };



  const isProcessing = isSubmitting || isLoading;

  return (
    <>
      <style>
        {`
          .compact-form .form-group {
            margin-bottom: 0.5rem;
          }
          .compact-form .form-label {
            margin-bottom: 0.25rem;
            font-weight: 500;
          }
          .compact-form .table th,
          .compact-form .table td {
            padding: 0.5rem 0.75rem;
            vertical-align: middle;
          }
        `}
      </style>
      <style>
        {`
          .compact-invoice-form .form-group {
            margin-bottom: 0.5rem;
          }
          .compact-invoice-form .form-label {
            margin-bottom: 0.25rem;
            font-weight: 500;
            font-size: 0.875rem;
          }
          .compact-invoice-form .form-control {
            padding: 0.375rem 0.75rem;
            font-size: 0.875rem;
          }
          .compact-invoice-form .react-datepicker-wrapper {
            width: 100%;
          }
          .compact-invoice-form .react-datepicker__input-container input {
            padding: 0.375rem 0.75rem;
            font-size: 0.875rem;
          }
          .compact-invoice-form .table th,
          .compact-invoice-form .table td {
            padding: 0.5rem 0.75rem;
            vertical-align: middle;
            font-size: 0.875rem;
          }
          .compact-invoice-form .input-group .btn {
            font-size: 0.75rem;
            padding: 0.375rem 0.75rem;
          }
        `}
      </style>
      <Modal
        isOpen={isOpen}
        toggle={toggle}
        size="lg"
        className="compact-invoice-form sales-invoice-modal"
        backdrop="static"
      >
        <ModalHeader toggle={toggle}>
          {isEditMode ? 'Edit Sales Invoice' : 'Create Sales Invoice'}
        </ModalHeader>
        <ModalBody className="py-3">
          <Form onSubmit={validation.handleSubmit}>
            <div className="mb-3">
              <h5 className="mb-1">Sales Invoice</h5>
              <small className="text-muted">{new Date().toLocaleDateString('en-GB')}</small>
            </div>
            <Row className="mb-2">
              <Col md={5}>
                <FormGroup className="mb-2">
                  <Label className="form-label">Date</Label>
                  <DatePicker
                    selected={selectedDate}
                    onChange={handleDateChange}
                    className="form-control"
                    dateFormat="dd/MM/yyyy"
                  />
                </FormGroup>
              </Col>
              <Col md={7}>
                <FormGroup className="mb-2">
                  <Label className="form-label d-flex justify-content-between align-items-center">
                    Invoice Number
                    {!suggestedInvoiceNumber && !isEditMode && (
                      <button 
                        type="button" 
                        className="btn btn-link btn-sm p-0 text-decoration-none" 
                        onClick={fetchNextInvoiceNumber}
                        disabled={isProcessing}
                      >
                        <small>Generate</small>
                      </button>
                    )}
                  </Label>
                  <div className="input-group">
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
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => validation.setFieldValue('invoiceNumber', suggestedInvoiceNumber)}
                        disabled={isProcessing}
                        title={`Use suggested: ${suggestedInvoiceNumber}`}
                      >
                        Use {suggestedInvoiceNumber}
                      </button>
                    )}
                  </div>
                  <FormFeedback>{validation.errors.invoiceNumber}</FormFeedback>
                </FormGroup>
              </Col>
            </Row>

            <Row className="mb-2">
              <Col md={shouldShowStatusDropdown ? 6 : 8}>
                <FormGroup className="mb-2">
                  <Label className="form-label">Bill To</Label>
                  <div className="contact-dropdown-container">
                    <BankAccountContactDropdown
                      value={validation.values.billTo}
                      onChange={handleBillToChange}
                      onBlur={validation.handleBlur}
                      disabled={isProcessing}
                      placeholder="Select Customer"
                      error={validation.errors.billTo}
                      touched={validation.touched.billTo}
                      showBankAccounts={false}
                      showContacts={true}
                    />
                  </div>
                  <FormFeedback>{validation.errors.billTo}</FormFeedback>
                </FormGroup>
              </Col>
              {shouldShowStatusDropdown && (
                <Col md={6}>
                  <FormGroup className="mb-2">
                    <Label className="form-label">Status</Label>
                    <Input
                      type="select"
                      name="status"
                      value={validation.values.status}
                      onChange={handleStatusChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.status && !!validation.errors.status}
                      disabled={isProcessing}
                    >
                      <option value="">Select Status</option>
                      {STATUS_OPTIONS.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </Input>
                    <FormFeedback>{validation.errors.status}</FormFeedback>
                  </FormGroup>
                </Col>
              )}
            </Row>

            {/* Contact Billing Address Display */}
            {selectedContact && (
              selectedContact.billingAddress1 || 
              selectedContact.billingCity || 
              selectedContact.billingState
            ) && (
              <Row className="mb-1">
                <Col md={12}>
                  <div className="border rounded px-2 py-1 bg-light">
                    <small className="text-muted d-flex align-items-center">
                      <i className="ri-map-pin-line me-1"></i>
                      <strong>Address:</strong>
                      <span className="ms-1">
                        {[
                          selectedContact.billingAddress1,
                          selectedContact.billingAddress2,
                          [selectedContact.billingCity, selectedContact.billingState, selectedContact.billingPincode].filter(Boolean).join(', '),
                          selectedContact.billingCountry
                        ].filter(Boolean).join(', ')}
                      </span>
                    </small>
                  </div>
                </Col>
              </Row>
            )}

            {shouldShowBankAccountDropdown && (
            <Row className="mb-2">
              <Col md={8}>
                <FormGroup className="mb-2">
                  <Label className="form-label">Payment Bank Account <span className="text-danger">*</span></Label>
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

              <Row className="mb-2">
                <Col md={4}>
                  <FormGroup className="mb-2">
                    <Label className="form-label">Tax Type</Label>
                    <Input
                      type="select"
                      name="taxType"
                      value={validation.values.taxType}
                      onChange={handleTaxTypeChange}
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
                {validation.values.taxType && validation.values.taxType !== 'no_tax' && TAX_TYPES.find(tax => tax.value === validation.values.taxType)?.rate > 0 && (
                  <Col md={8}>
                    <FormGroup className="mb-2">
                      <Label className="form-label">Item Rate Type</Label>
                      <div className="d-flex gap-3">
                        {ITEM_RATE_TYPES.map(type => (
                          <div key={type.value} className="form-check">
                            <Input
                              type="radio"
                              name="rateType"
                              id={`rateType_${type.value}`}
                              value={type.value}
                              checked={validation.values.rateType === type.value}
                              onChange={handleRateTypeChange}
                              disabled={isProcessing}
                            />
                            <Label className="form-check-label" htmlFor={`rateType_${type.value}`}>
                              {type.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {validation.touched.rateType && validation.errors.rateType && (
                        <div className="text-danger small">{validation.errors.rateType}</div>
                      )}
                      <small className="form-text text-muted">
                        Rate type affects tax calculations.
                      </small>
                    </FormGroup>
                  </Col>
                )}
              </Row>

            <div className="mb-2">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Items</h6>
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
                    {validation?.values?.rateType === 'with_tax' && TAX_TYPES.find(tax => tax.value === validation?.values?.taxType)?.rate > 0 ? (
                      <th className="text-end">Rate (Without tax)</th>
                    ) : (
                      <th className="text-end">Rate</th>
                    )}
                    {TAX_TYPES.find(tax => tax.value === validation.values.taxType)?.rate > 0 && (
                      <>
                        <th className="text-end">Tax (%)</th>
                        <th className="text-end">Tax Amount</th>
                      </>
                    )}
                    {validation.values.discountType && validation.values.discountType !== 'none' && (
                      <>
                        <th className="text-end">Discount Amount</th>
                      </>
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
                      {validation?.values?.rateType === 'with_tax' && TAX_TYPES.find(tax => tax.value === validation?.values?.taxType)?.rate > 0 ? (
                        <td className="text-end">₹{parseFloat(item.rateWithoutTax || (item.rate || 0) / (1 + (parseFloat(item.taxRate || 0) / 100))).toFixed(2)}</td>
                      ) : (
                        <td className="text-end">₹{parseFloat(item.rate || 0).toFixed(2)}</td>
                      )}
                      {TAX_TYPES.find(tax => tax.value === validation.values.taxType)?.rate > 0 && (
                        <>
                          <td className="text-end">{item.taxRate}%</td>
                          <td className="text-end">₹{parseFloat(item.taxAmount || 0).toFixed(2)}</td>
                        </>
                      )}
                      {validation.values.discountType && validation.values.discountType !== 'none' && (
                        <>
                          <td className="text-end">
                            <div>₹{parseFloat(item.discount || 0).toFixed(2)}</div>
                            {item.discountType === 'percentage' && (
                              <div className="text-muted small">{item.discountRate}%</div>
                            )}
                          </td>
                        </>
                      )}
                      <td className="text-end fw-bold">₹{calculateItemTotalForDisplay(item, validation.values.taxType).toFixed(2)}</td>
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

            <Row className="mb-2">
              <Col md={5}>
                <Row>
                  
                  <Col md={6}>
                    <FormGroup>
                      <Label>Transportation Charge (₹)</Label>
                      <InputGroup>
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
                        />
                      </InputGroup>
                      <FormFeedback>{validation.errors.transportationCharge}</FormFeedback>
                    </FormGroup>
                  </Col>
                  
                </Row>
                
                <FormGroup className="mb-2 mt-3">
                  <Label className="form-label">Internal Notes</Label>
                  <Input
                    type="textarea"
                    name="internalNotes"
                    rows="2"
                    value={validation.values.internalNotes}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.internalNotes && !!validation.errors.internalNotes}
                    disabled={isProcessing}
                    placeholder="Add internal notes..."
                  />
                  <FormFeedback>{validation.errors.internalNotes}</FormFeedback>
                </FormGroup>
              </Col>
              <Col md={7}>
                <div className="border p-2 bg-light">
                  <h6 className="mb-2">Summary</h6>
                  <div className="d-flex justify-content-between mb-1">
                    <span>Basic Amount:</span>
                    <span>₹ {calculatedTotals.basicAmount.toFixed(2)}</span>
                  </div>
                  {calculatedTotals.totalDiscount > 0 && (
                    <div className="d-flex justify-content-between mb-1">
                      <span>Total Discount:</span>
                      <span className="text-danger">- ₹ {calculatedTotals.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {calculatedTotals.totalTax > 0 && (
                    <div className="d-flex justify-content-between mb-1">
                      <span>Total Tax:</span>
                      <span className="text-success">+ ₹ {calculatedTotals.totalTax.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {parseFloat(validation.values.transportationCharge || 0) > 0 && (
                    <div className="d-flex justify-content-between mb-1">
                      <span>Transportation:</span>
                      <span className="text-info">₹ {parseFloat(validation.values.transportationCharge || 0).toFixed(2)}</span>
                    </div>
                  )}
                  
                    <div className="d-flex justify-content-between mb-1">
                      <span>Round Off:</span>
                    <div className="d-flex align-items-center gap-2">
                      {isEditingRoundOff ? (
                        <div className="d-flex align-items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={tempRoundOff}
                            onChange={(e) => setTempRoundOff(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                validation.setFieldValue('roundOff', parseFloat(tempRoundOff) || 0);
                                setIsEditingRoundOff(false);
                              }
                            }}
                            onBlur={(e) => {
                              // Prevent onBlur when clicking on Auto button
                              const relatedTarget = e.relatedTarget;
                              const isAutoButton = relatedTarget && (
                                relatedTarget.textContent === 'Auto' || 
                                relatedTarget.title === 'Auto calculate round-off'
                              );
                              
                              if (!isAutoButton) {
                                validation.setFieldValue('roundOff', parseFloat(tempRoundOff) || 0);
                                setIsEditingRoundOff(false);
                              }
                            }}
                            style={{ width: '80px', fontSize: '0.875rem' }}
                            size="sm"
                            autoFocus
                            disabled={isProcessing}
                          />
                          <Button
                            color="outline-secondary"
                            size="sm"
                            onClick={() => {
                              try {
                                // Calculate fresh values without round off influence
                                const basicAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
                                
                                // Calculate invoice discount fresh
                                let totalDiscount = 0;
                                const discountType = validation.values.discountType || 'none';
                                const discountValueType = validation.values.discountValueType || 'rupees';
                                const discountValue = parseFloat(validation.values.discountValue) || 0;
                                
                                if (discountType === 'on_invoice' || discountType === 'per_item_and_invoice') {
                                  if (discountValueType === 'percentage') {
                                    totalDiscount = (basicAmount * discountValue) / 100;
                                  } else if (discountValueType === 'rupees') {
                                    totalDiscount = discountValue;
                                  }
                                }
                                
                                const netBeforeRound = basicAmount - totalDiscount;
                                const autoRoundOff = Math.round(netBeforeRound) - netBeforeRound;
                                const roundOffValue = parseFloat(autoRoundOff.toFixed(2));
                                
                                // Set the calculated values
                                setTempRoundOff(roundOffValue.toString());
                                validation.setFieldValue('roundOff', roundOffValue, true);
                                
                                // Use setTimeout to prevent React batching conflicts
                                setTimeout(() => {
                                  setIsEditingRoundOff(false);
                                }, 10);
                              } catch (error) {
                                console.error('Error in auto round off calculation:', error);
                              }
                            }}
                            disabled={isProcessing}
                            title="Auto calculate round-off"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            Auto
                          </Button>
                        </div>
                      ) : (
                        <div className="d-flex align-items-center gap-1">
                          <span className={parseFloat(validation.values.roundOff || 0) > 0 ? 'text-success' : parseFloat(validation.values.roundOff || 0) < 0 ? 'text-danger' : ''}>
                            {parseFloat(validation.values.roundOff || 0) > 0 ? '+' : ''} ₹ {parseFloat(validation.values.roundOff || 0).toFixed(2)}
                      </span>
                          <RiEditLine
                            className="text-muted cursor-pointer"
                            size={14}
                            onClick={() => {
                              setTempRoundOff(parseFloat(validation.values.roundOff || 0).toString());
                              setIsEditingRoundOff(true);
                            }}
                            title="Edit round off"
                            style={{ cursor: 'pointer' }}
                          />
                    </div>
                  )}
                    </div>
                  </div>
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
          {apiError && (
            <div className="w-100 mb-3">
              <Alert color="danger" className="mb-0">
                <strong>Error:</strong> {apiError}
              </Alert>
            </div>
          )}
          <div className="d-flex justify-content-between w-100">
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
          </div>
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
        rateType={validation.values.rateType}
      />
    </>
  );
};

export default SalesInvoiceForm; 
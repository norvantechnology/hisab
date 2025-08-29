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
  RiEditLine,
} from 'react-icons/ri';
import * as Yup from "yup";
import { useFormik } from "formik";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { listProducts } from '../../../services/products';
import { getNextInvoiceNumber } from '../../../services/purchaseInvoice';
import ItemModal from './ItemModal';
import { DISCOUNT_TYPES, DISCOUNT_VALUE_TYPES, TAX_TYPES, TAX_TYPES_SIMPLE, STATUS_OPTIONS, ITEM_RATE_TYPES } from './contant'
import BankAccountContactDropdown from '../../Common/BankAccountContactDropdown';
import BankAccountDropdown from '../../Common/BankAccountDropdown';
import { calculateItemTaxAmount, calculateItemTaxAndTotal } from '../../../utils/taxCalculations';

const PurchaseInvoiceForm = ({
  isOpen,
  toggle,
  isEditMode,
  selectedInvoice,
  onSubmit,
  isLoading = false
}) => {
  const getInitialItems = useCallback(() => {
    // Debug: Log the selectedInvoice data when editing
    if (isEditMode && selectedInvoice) {
      console.log('=== EDIT MODE DEBUG ===');
      console.log('Selected Invoice:', selectedInvoice);
      console.log('Invoice Items:', selectedInvoice.items);
      
      // Debug each item individually
      if (selectedInvoice.items && selectedInvoice.items.length > 0) {
        console.log('=== INDIVIDUAL ITEMS DEBUG ===');
        selectedInvoice.items.forEach((item, index) => {
          console.log(`Item ${index + 1}:`, {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            rate: item.rate,
            rateType: item.rateType,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            discount: item.discount,
            discountRate: item.discountRate,
            total: item.total,
            rawItem: item
          });
          
          // Debug discount calculations
          if (item.discountRate > 0 || item.discount > 0) {
            console.log(`Item ${index + 1} Discount Details:`, {
              discountRate: item.discountRate,
              discount: item.discount,
              expectedDiscount: (parseFloat(item.quantity || 0) * parseFloat(item.rate || 0) * parseFloat(item.discountRate || 0)) / 100
            });
          }
        });
        console.log('=== END INDIVIDUAL ITEMS DEBUG ===');
      }
      
      console.log('=== END EDIT DEBUG ===');
    }
    
    return selectedInvoice?.items?.map(item => {
      // Use the already calculated values from the API response instead of recalculating
      const quantity = item.isSerialized ? (item.serialNumbers || []).length : item.quantity;
      const rate = parseFloat(item.rate) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const discountRate = parseFloat(item.discountRate) || 0;
      const rateType = item.rateType || selectedInvoice?.rateType || 'without_tax';
      
      // Use the values from the API response if they exist, otherwise calculate them
      let taxAmount = parseFloat(item.taxAmount) || 0;
      let discount = parseFloat(item.discount) || 0;
      let total = parseFloat(item.total) || 0;
      
      // Only calculate if the values are missing from the API response
      if (!item.taxAmount || !item.discount || !item.total) {
        // Use common utility function for tax calculations
        const result = calculateItemTaxAndTotal({
          rate,
          quantity,
          taxRate,
          discountRate,
          rateType,
          discountValueType: 'percentage',
          discountValue: discountRate
        });
        
        taxAmount = result.taxAmount;
        discount = result.discount;
        total = result.total;
      }
      
      // For edit mode: Subtract the original quantity from current stock for validation
      // This represents the stock that was there before this purchase was made
      const originalQuantity = parseFloat(item.quantity || 0);
      const currentStockWithPurchase = parseFloat(item.currentStock || 0);
      const stockBeforePurchase = isEditMode ? Math.max(0, currentStockWithPurchase - originalQuantity) : currentStockWithPurchase;
      
      return {
        id: item.id,
        productId: item.productId,
        name: item.name,
        code: item.code,
        quantity: item.quantity,
        rate: rate,
        rateType: rateType,
        taxRate: taxRate,
        taxAmount: taxAmount,
        discount: discount,
        discountRate: discountRate,
        total: total,
        isSerialized: item.isSerialized,
        serialNumbers: item.serialNumbers || [],
        currentStock: stockBeforePurchase,
        originalQuantity: originalQuantity
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
  const [isEditingRoundOff, setIsEditingRoundOff] = useState(false);
  const [tempRoundOff, setTempRoundOff] = useState('');

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

    // Calculate totals from items for edit mode to ensure accuracy
    let calculatedBasicAmount = 0;
    let calculatedTotalDiscount = 0;
    let calculatedTaxAmount = 0;
    let calculatedRoundOff = 0;
    let calculatedNetPayable = 0;

    if (isEditMode && selectedInvoice?.items) {
      // Calculate basic amount from items' total values
      calculatedBasicAmount = selectedInvoice.items.reduce((sum, item) => 
        sum + (parseFloat(item.total) || 0), 0
      );
      
      // Calculate total tax amount from items
      calculatedTaxAmount = selectedInvoice.items.reduce((sum, item) => 
        sum + (parseFloat(item.taxAmount) || 0), 0
      );
      
      // For edit mode, use the stored values but validate them
      calculatedTotalDiscount = parseFloat(selectedInvoice.totalDiscount || 0);
      calculatedRoundOff = parseFloat(selectedInvoice.roundOff || 0);
      calculatedNetPayable = parseFloat(selectedInvoice.netPayable || 0);
      
      // Validate that the stored netPayable matches our calculation
      const expectedNetPayable = calculatedBasicAmount + calculatedRoundOff;
      if (Math.abs(calculatedNetPayable - expectedNetPayable) > 0.01) {
        // If there's a mismatch, recalculate
        calculatedNetPayable = expectedNetPayable;
        calculatedRoundOff = 0; // Reset round off
      }
    }

    return {
      id: isEditMode && selectedInvoice ? selectedInvoice.id : '',
      invoiceNumber: isEditMode && selectedInvoice ? selectedInvoice.invoiceNumber : '',
      date: isEditMode && selectedInvoice ? selectedInvoice.date?.split('T')[0] : new Date().toISOString().split('T')[0],
      billFrom: billFromValue,
      billFromBank: billFromBankValue,
      taxType: isEditMode && selectedInvoice ? selectedInvoice.taxType : 'no_tax',
      rateType: isEditMode && selectedInvoice ? 
        (selectedInvoice.rateType || (TAX_TYPES.find(tax => tax.value === selectedInvoice.taxType)?.rate === 0 ? 'without_tax' : 'with_tax')) : 
        'without_tax',
      discountType: isEditMode && selectedInvoice ? selectedInvoice.discountType : 'none',
      discountValueType: isEditMode && selectedInvoice ? selectedInvoice.discountValueType : 'percentage',
      discountValue: isEditMode && selectedInvoice ? selectedInvoice.discountValue : 0,
      status: isEditMode && selectedInvoice ? selectedInvoice.status : '',
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
      basicAmount: isEditMode ? calculatedBasicAmount : 0,
      totalDiscount: isEditMode ? calculatedTotalDiscount : 0,
      taxAmount: isEditMode ? calculatedTaxAmount : 0,
      roundOff: isEditMode ? calculatedRoundOff : 0,
      netPayable: isEditMode ? calculatedNetPayable : 0
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
        
        // Debug: Log the API payload being sent
        console.log('=== API PAYLOAD DEBUG ===');
        console.log('Form values:', values);
        console.log('Items state:', items);
        console.log('Calculated values:', calculatedValues);
        console.log('Items in payload:', calculatedValues.items);
        console.log('=== END DEBUG ===');
        
        await onSubmit(calculatedValues);
      } catch (error) {
        console.error('Error submitting form:', error);
      } finally {
        setIsSubmitting(false);
        setSubmitting(false);
      }
    }
  });

  // Function to calculate item totals (moved here to avoid dependency issues)
  const calculateItemTotal = useCallback((item, taxType = 'with_tax') => {
    const quantity = item.isSerialized ? item.serialNumbers.length : item.quantity;
    let subtotal, rateWithoutTax, rateWithTax;
    
    // Use the form's rateType instead of the item's rateType for consistent calculations
    const currentRateType = validation.values.rateType;
    
    if (currentRateType === 'with_tax') {
      // Rate is inclusive of tax, so we need to extract the base rate
      const taxRate = parseFloat(item.taxRate) || 0;
      rateWithoutTax = item.rate / (1 + (taxRate / 100));
      rateWithTax = item.rate;
      subtotal = quantity * rateWithoutTax;
    } else {
      // Rate is without tax - no tax calculation
      rateWithoutTax = item.rate;
      rateWithTax = item.rate; // No tax added
      subtotal = quantity * item.rate;
    }
    
    // Calculate discount first
    const discountRate = parseFloat(item.discountRate) || 0;
    const discount = (subtotal * discountRate) / 100;
    const afterDiscount = subtotal - discount;
    
    // Calculate tax based on rate type and tax type
    let taxAmount = 0;
    const selectedTax = TAX_TYPES.find(tax => tax.value === taxType);
    const shouldCalculateTax = selectedTax && selectedTax.rate > 0;
    
    if (shouldCalculateTax) {
      taxAmount = calculateItemTaxAmount(item, taxType, TAX_TYPES);
    }
    
    const total = afterDiscount + taxAmount;
    
    return { 
      ...item, 
      quantity, 
      subtotal,
      rateWithoutTax,
      rateWithTax,
      taxAmount, 
      discount, 
      total 
    };
  }, [validation.values.rateType]);

  // Function to calculate the correct total for display in the table
  const calculateItemTotalForDisplay = useCallback((item, taxType = 'with_tax') => {
    const quantity = item.isSerialized ? item.serialNumbers.length : item.quantity;
    let subtotal;
    
    // Use the form's rateType instead of the item's rateType for consistent calculations
    const currentRateType = validation.values.rateType;
    
    if (currentRateType === 'with_tax') {
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
    const discount = (subtotal * discountRate) / 100;
    const afterDiscount = subtotal - discount;
    
    // Calculate tax based on rate type and tax type
    let taxAmount = 0;
    const selectedTax = TAX_TYPES.find(tax => tax.value === taxType);
    const shouldCalculateTax = selectedTax && selectedTax.rate > 0;
    
    if (shouldCalculateTax) {
      if (currentRateType === 'with_tax') {
        // For "With Tax" items, the rate input is the total (including tax)
        // So we calculate backwards: total = rate input, then calculate tax amount
        const total = afterDiscount;
        // Calculate tax amount: if total = base + tax, then tax = total - base
        // base = total / (1 + taxRate/100)
        const baseAmount = total / (1 + (parseFloat(item.taxRate) || 0) / 100);
        taxAmount = total - baseAmount;
      } else {
        // For "Without Tax" items, add tax to the rate
        const taxRate = parseFloat(item.taxRate) || 0;
        taxAmount = (afterDiscount * taxRate) / 100;
      }
    }
    
    const total = afterDiscount + taxAmount;
    
    return total;
  }, [validation.values.rateType]);

  // Custom handler for billFrom dropdown (ReactSelect)
  const handleBillFromChange = useCallback((selectedOption) => {
    validation.setFieldValue('billFrom', selectedOption?.value || '');
    // Only clear billFromBank if the selected option is not a contact
    if (!selectedOption?.value?.startsWith('contact_')) {
      validation.setFieldValue('billFromBank', '');
    }
  }, []);

  // Custom handler for billFromBank dropdown
  const handleBillFromBankChange = useCallback((selectedOption) => {
    validation.setFieldValue('billFromBank', selectedOption?.value || '');
  }, []);

  // Custom handler for status changes
  const handleStatusChange = useCallback((e) => {
    const newStatus = e.target.value;
    validation.setFieldValue('status', newStatus);
    
    // Clear bank account if status changes from 'paid' to 'pending'
    if (newStatus === 'pending' && validation.values.billFromBank) {
      validation.setFieldValue('billFromBank', '');
    }
  }, []);

  // Custom handler for round-off changes
  const handleRoundOffChange = useCallback((e) => {
    const value = parseFloat(e.target.value) || 0;
    validation.setFieldValue('roundOff', value);
  }, []);

  // Custom handler for tax type changes
  const handleTaxTypeChange = useCallback((e) => {
    const newTaxType = e.target.value;
    validation.setFieldValue('taxType', newTaxType);
    
    // Clear rateType if tax type has rate 0 (no tax)
    const selectedTax = TAX_TYPES.find(tax => tax.value === newTaxType);
    if (!selectedTax || selectedTax.rate === 0) {
      validation.setFieldValue('rateType', '');
    } else if (!validation.values.rateType) {
      // Set default rateType if none is selected and tax type has a rate > 0
      validation.setFieldValue('rateType', 'without_tax');
    }
  }, []);

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
        
        // Calculate discount
        const discount = (subtotal * discountRate) / 100;
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
            discountRate,
            rateType: newRateType,
            discountValueType: 'percentage',
            discountValue: discountRate
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
      
      // Debug: Log the live update
      console.log('=== RATE TYPE CHANGE LIVE UPDATE ===');
      console.log('New Rate Type:', newRateType);
      console.log('Updated Items:', updatedItems);
      console.log('=== END LIVE UPDATE ===');
    }
  }, [items, validation.values.taxType]);

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
    // Use the already calculated totals from the items instead of recalculating
    const basicAmount = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    
    // Calculate total tax from all items
    const totalTax = items.reduce((sum, item) => {
      return sum + calculateItemTaxAmount(item, validation.values.taxType, TAX_TYPES);
    }, 0);
    
    let totalDiscount = 0;

    if (validation.values.discountType === 'per_item') {
      // For per_item, no invoice discount
      totalDiscount = 0;
    } else if (validation.values.discountType === 'on_invoice') {
      if (validation.values.discountValueType === 'percentage') {
        totalDiscount = (basicAmount * validation.values.discountValue) / 100;
      } else if (validation.values.discountValueType === 'rupees') {
        totalDiscount = validation.values.discountValue;
      }
    } else if (validation.values.discountType === 'per_item_and_invoice') {
      // For per_item_and_invoice, invoice discount is applied on the basic amount
      if (validation.values.discountValueType === 'percentage') {
        totalDiscount = (basicAmount * validation.values.discountValue) / 100;
      } else if (validation.values.discountValueType === 'rupees') {
        totalDiscount = validation.values.discountValue;
      }
    }

    const netBeforeRound = basicAmount - totalDiscount;
    // Use user-input round-off value instead of auto-calculating
    const userRoundOff = parseFloat(validation.values.roundOff || 0);
    const netPayable = netBeforeRound + userRoundOff;

    const billFromParts = validation.values.billFrom.split('_');
    const billFromType = billFromParts[0];
    const billFromId = billFromParts[1];

    return {
      basicAmount,
      totalDiscount,
      roundOff: userRoundOff,
      netPayable,
      totalTax
    };
  }, [items, validation.values.discountType, validation.values.discountValueType, validation.values.discountValue, validation.values.taxType, validation.values.roundOff]);

  const calculateInvoiceTotals = useCallback((values, itemsData) => {
    // Basic Amount is the sum of all items' Total column (which includes item-level discounts and tax)
    // Use the already calculated totals from the items instead of recalculating
    const basicAmount = itemsData.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    
    // Calculate total tax from all items
    const totalTax = itemsData.reduce((sum, item) => {
      return sum + calculateItemTaxAmount(item, values.taxType, TAX_TYPES);
    }, 0);
    
    let totalDiscount = 0;
    let updatedItems = [...itemsData];

    if (values.discountType === 'per_item') {
      // For per_item, no invoice discount
      totalDiscount = 0;
    } else if (values.discountType === 'on_invoice') {
      if (values.discountValueType === 'percentage') {
        totalDiscount = (basicAmount * values.discountValue) / 100;
      } else if (values.discountValueType === 'rupees') {
        totalDiscount = values.discountValue;
      }
    } else if (values.discountType === 'per_item_and_invoice') {
      // For per_item_and_invoice, invoice discount is applied on the basic amount
      if (values.discountValueType === 'percentage') {
        totalDiscount = (basicAmount * values.discountValue) / 100;
      } else if (values.discountValueType === 'rupees') {
        totalDiscount = values.discountValue;
      }
    }

    const netBeforeRound = basicAmount - totalDiscount;
    // Use user-input round-off value instead of auto-calculating
    const userRoundOff = parseFloat(values.roundOff || 0);
    const netPayable = netBeforeRound + userRoundOff;

    const billFromParts = values.billFrom.split('_');
    const billFromType = billFromParts[0];
    const billFromId = billFromParts[1];

    const payload = {
      ...values,
      date: new Date(values.date).toISOString(),
      items: updatedItems.map(item => {
        // Use the already calculated values from the items state instead of recalculating
        const quantity = item.isSerialized ? (item.serialNumbers || []).length : item.quantity;
        
        return {
          id: item.id,
          productId: item.productId,
          name: item.name,
          code: item.code,
          quantity: quantity,
          rate: parseFloat(item.rate) || 0,
          rateType: item.rateType || 'without_tax',
          taxRate: parseFloat(item.taxRate) || 0,
          taxAmount: parseFloat(item.taxAmount) || 0,
          discount: parseFloat(item.discount) || 0,
          discountRate: parseFloat(item.discountRate) || 0,
          total: parseFloat(item.total) || 0,
          isSerialized: item.isSerialized || false,
          serialNumbers: item.isSerialized ? (item.serialNumbers || []) : undefined,
          currentStock: item.currentStock || 0
        };
      }),
      basicAmount,
      taxAmount: totalTax,
      totalDiscount,
      roundOff: userRoundOff,
      netPayable,
      discountType: values.discountType,
      discountValueType: values.discountValueType,
      discountValue: values.discountValue
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
      // In edit mode, preserve the original values from the API
      // Only update calculated values if they're significantly different
      if (isEditMode && selectedInvoice) {
        const originalBasicAmount = parseFloat(selectedInvoice.basicAmount || 0);
        const originalTotalDiscount = parseFloat(selectedInvoice.totalDiscount || 0);
        const originalTaxAmount = parseFloat(selectedInvoice.taxAmount || 0);
        const originalRoundOff = parseFloat(selectedInvoice.roundOff || 0);
        const originalNetPayable = parseFloat(selectedInvoice.netPayable || 0);
        
        // Only update if there's a significant difference (more than 0.01)
        const shouldUpdateBasicAmount = Math.abs(calculatedTotals.basicAmount - originalBasicAmount) > 0.01;
        const shouldUpdateTotalDiscount = Math.abs(calculatedTotals.totalDiscount - originalTotalDiscount) > 0.01;
        const shouldUpdateTaxAmount = Math.abs(calculatedTotals.taxAmount - originalTaxAmount) > 0.01;
        
        // For edit mode, also preserve user-set roundOff values
        const shouldUpdateRoundOff = Math.abs(validation.values.roundOff) < 0.001; // Only update if roundOff is essentially 0
        
        validation.setValues(prev => ({
          ...prev,
          // Don't override items array - let it be managed by the items state
          basicAmount: shouldUpdateBasicAmount ? calculatedTotals.basicAmount : originalBasicAmount,
          taxAmount: shouldUpdateTaxAmount ? calculatedTotals.taxAmount : originalTaxAmount,
          totalDiscount: shouldUpdateTotalDiscount ? calculatedTotals.totalDiscount : originalTotalDiscount,
          roundOff: shouldUpdateRoundOff ? originalRoundOff : prev.roundOff, // Preserve user-set values in edit mode too
          netPayable: originalNetPayable
        }), false);
      } else {
        // For new invoices, use calculated values
        // BUT preserve user-set roundOff values (don't override manual changes)
        const shouldUpdateRoundOff = Math.abs(validation.values.roundOff) < 0.001; // Only update if roundOff is essentially 0
        
        validation.setValues(prev => ({
          ...prev,
          // Don't override items array - let it be managed by the items state
          basicAmount: calculatedTotals.basicAmount,
          taxAmount: calculatedTotals.taxAmount,
          totalDiscount: calculatedTotals.totalDiscount,
          roundOff: shouldUpdateRoundOff ? calculatedTotals.roundOff : prev.roundOff, // Preserve user-set values
          netPayable: calculatedTotals.netPayable
        }), false);
      }
    }
  }, [calculatedTotals.basicAmount, calculatedTotals.taxAmount, calculatedTotals.totalDiscount, calculatedTotals.roundOff, calculatedTotals.netPayable, isOpen, isEditMode, selectedInvoice]);

  // Recalculate all items when discount type changes
  // useEffect(() => {
  //   if (isOpen && items.length > 0) {
  //     const updatedItems = items.map(item => calculateItemTotal(item, validation.values.taxType));
  //     setItems(updatedItems);
  //   }
  // }, [validation.values.discountType, isOpen, calculateItemTotal, validation.values.taxType]);

  useEffect(() => {
    fetchNextInvoiceNumber();
  }, [fetchNextInvoiceNumber]);

  // Auto-populate invoice number when suggestion is available
  useEffect(() => {
    if (suggestedInvoiceNumber && !validation.values.invoiceNumber && !isEditMode) {
      validation.setFieldValue('invoiceNumber', suggestedInvoiceNumber);
    }
  }, [suggestedInvoiceNumber, isEditMode]);

  // Set default status when contact is selected
  useEffect(() => {
    if (validation.values.billFrom && validation.values.billFrom.startsWith('contact_') && !validation.values.status) {
      validation.setFieldValue('status', 'pending');
    }
  }, [validation.values.billFrom, validation.values.status]);

  // Set default status when billFrom changes
  useEffect(() => {
    if (validation.values.billFrom && validation.values.billFrom.startsWith('contact_')) {
      validation.setFieldValue('status', 'pending');
    } else {
      validation.setFieldValue('status', '');
    }
  }, [validation.values.billFrom]);

  // Reset form when switching from edit mode to new invoice mode
  useEffect(() => {
    if (!isEditMode && isOpen) {
      // Reset form to initial state for new invoice
      validation.resetForm();
      
      // Reset items to initial empty state
      setItems([{
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
      }]);
      
      // Clear search and product states
      setProducts([]);
      setSearchTerm('');
      setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
    }
  }, [isEditMode, isOpen]); // Removed validation dependency to prevent infinite loop

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
    // Check if the selected tax type has a rate > 0
    const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
    if (selectedTax && selectedTax.rate > 0) {
      return selectedTax.rate; // Use the tax type's rate
    } else {
      return 0; // No tax for tax types with rate 0
    }
  }, [validation.values.taxType]);

  const handleDateChange = useCallback((date) => {
    setSelectedDate(date);
    validation.setFieldValue('date', date.toISOString());
  }, []);

  const openAddItemModal = useCallback((item = null) => {
    const defaultTaxRate = getDefaultTaxRate();
    
    if (item) {
      // Editing existing item - preserve all properties
      setCurrentItem(item);
    } else {
      // Creating new item - use defaults
      setCurrentItem({
        id: Date.now(),
        productId: null,
        name: '',
        code: '',
        quantity: 1,
        rate: 0,
        rateType: validation.values.rateType || 'without_tax', // Use form's rateType
        taxRate: defaultTaxRate,
        taxAmount: 0,
        discount: 0,
        discountRate: 0,
        total: 0,
        isSerialized: false,
        serialNumbers: [],
        currentStock: 0
      });
    }
    
    setAddItemModal(true);
    setSearchTerm('');
    setProducts([]);
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
    fetchProductsRef.current = false;
    lastSearchTermRef.current = '';
    lastPageRef.current = 1;
  }, [getDefaultTaxRate, validation.values.rateType]);

  const closeAddItemModal = useCallback(() => {
    setAddItemModal(false);
    setCurrentItem(null);
    setSearchTerm('');
  }, []);

  const saveItem = useCallback((item) => {
    // The ItemModal already calculates all the values correctly, so we need to preserve them
    const itemToSave = {
      ...item,
      quantity: item.isSerialized ? (item.serialNumbers || []).length : item.quantity,
      rate: parseFloat(item.rate) || 0,
      taxRate: parseFloat(item.taxRate) || 0,
      discountRate: parseFloat(item.discountRate) || 0,
      rateType: item.rateType || 'without_tax',
      // Preserve the calculated values from ItemModal
      taxAmount: parseFloat(item.taxAmount) || 0,
      discount: parseFloat(item.discount) || 0,
      total: parseFloat(item.total) || 0
    };
    
    setItems(prevItems => {
      const existingIndex = prevItems.findIndex(i => i.id === itemToSave.id);
      let updatedItems;
      if (existingIndex >= 0) {
        updatedItems = [...prevItems];
        updatedItems[existingIndex] = itemToSave;
      } else {
        updatedItems = [...prevItems, itemToSave];
      }
      
      // Force Formik to re-validate items
      validation.setFieldTouched('items', true, false);
      validation.setFieldValue('items', updatedItems, true);
      return updatedItems;
    });
    closeAddItemModal();
  }, [closeAddItemModal]);

  const removeItem = useCallback((id) => {
    if (items.length > 1) {
      const updatedItems = items.filter(item => item.id !== id);
      setItems(updatedItems);
      // Force Formik to re-validate items
      validation.setFieldTouched('items', true, false);
      validation.setFieldValue('items', updatedItems, true);
    }
  }, [items]);

  const updateCurrentItem = useCallback((field, value) => {
    setCurrentItem(prev => {
      if (!prev) return null;
  
      const updatedItem = { ...prev, [field]: value };
  
      // Only recalculate if the calculated values are not already set
      if (['rate', 'quantity', 'taxRate', 'discountRate'].includes(field) && 
          (!updatedItem.taxAmount && !updatedItem.discount && !updatedItem.total)) {
        const quantity = updatedItem.isSerialized ? updatedItem.serialNumbers.length : updatedItem.quantity;
        const rate = parseFloat(updatedItem.rate) || 0;
        const taxRate = parseFloat(updatedItem.taxRate) || 0;
        const discountRate = parseFloat(updatedItem.discountRate) || 0;
        
        // Calculate values based on rate type
        let subtotal, taxAmount, discount, total;
        
        // Use common utility function for tax calculations
        const result = calculateItemTaxAndTotal({
          rate,
          quantity,
          taxRate,
          discountRate,
          rateType: updatedItem.rateType,
          discountValueType: 'percentage',
          discountValue: discountRate
        });
        
        subtotal = result.subtotal;
        discount = result.discount;
        taxAmount = result.taxAmount;
        total = result.total;
      }
  
      return updatedItem;
    });
  }, []);

  const selectProduct = useCallback((product) => {
    const defaultTaxRate = getDefaultTaxRate();
    const productTaxRate = parseFloat(product.taxRate) || defaultTaxRate;
    const quantity = currentItem?.isSerialized ? currentItem.serialNumbers.length : currentItem?.quantity || 1;
    const rate = currentItem?.rate || 0;
    const discountRate = currentItem?.discountRate || 0;
    const rateType = currentItem?.rateType || 'without_tax'; // Preserve rateType
    
    // Only calculate new values if they don't already exist
    let taxAmount = currentItem?.taxAmount;
    let discount = currentItem?.discount;
    let total = currentItem?.total;
    
    if (!taxAmount || !discount || !total) {
      // Use common utility function for tax calculations
      const result = calculateItemTaxAndTotal({
        rate,
        quantity,
        taxRate: productTaxRate,
        discountRate,
        rateType,
        discountValueType: 'percentage',
        discountValue: discountRate
      });
      
      subtotal = result.subtotal;
      discount = result.discount;
      taxAmount = result.taxAmount;
      total = result.total;
    }

    const updatedItem = {
      ...currentItem,
      id: currentItem?.id || Date.now(),
      productId: product.id,
      name: product.name,
      code: product.itemCode,
      rateType: rateType, // Preserve rateType
      taxRate: productTaxRate,
      isSerialized: product.isSerialized,
      currentStock: product.currentStock,
      taxAmount: taxAmount,
      discount: discount,
      total: total
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
            </Row>



            <Row className="mb-4">
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
              {validation.values.discountType && validation.values.discountType !== 'none' && (
                <Col md={6}>
                  <FormGroup>
                    <Label>Discount Value Type</Label>
                    <Input
                      type="select"
                      name="discountValueType"
                      value={validation.values.discountValueType}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={validation.touched.discountValueType && !!validation.errors.discountValueType}
                      disabled={isProcessing}
                    >
                      <option value="">Select Discount Value Type</option>
                      {DISCOUNT_VALUE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </Input>
                    <FormFeedback>{validation.errors.discountValueType}</FormFeedback>
                  </FormGroup>
                </Col>
              )}
            </Row>

            {validation.values.discountType && validation.values.discountType !== 'none' && (validation.values.discountType === 'on_invoice' || validation.values.discountType === 'per_item_and_invoice') && (
              <Row className="mb-4">
                <Col md={6}>
                  <FormGroup>
                    <Label>Discount Value</Label>
                    <InputGroup>
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
                        placeholder={validation.values.discountValueType === 'percentage' ? 'Enter discount percentage' : 'Enter discount amount'}
                      />
                      <InputGroupText>
                        {validation.values.discountValueType === 'percentage' ? '%' : '₹'}
                      </InputGroupText>
                    </InputGroup>
                    <FormFeedback>{validation.errors.discountValue}</FormFeedback>
                  </FormGroup>
                </Col>
              </Row>
            )}

            {validation.values.taxType && validation.values.taxType !== 'no_tax' && TAX_TYPES.find(tax => tax.value === validation.values.taxType)?.rate > 0 && (
              <Row className="mb-4">
                <Col md={6}>
                  <FormGroup>
                    <Label>Item Rate Type</Label>
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
                    <div className="form-text text-muted">
                      Changing the rate type will automatically recalculate tax amounts and totals for all items.
                    </div>
                  </FormGroup>
                </Col>
              </Row>
            )}

            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="mb-0">Items</h5>                                                                                                                                                   
                </div>
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
                    {TAX_TYPES.find(tax => tax.value === validation.values.taxType)?.rate > 0 && (
                      <>
                        <th className="text-end">Tax (%)</th>
                        <th className="text-end">Tax Amount</th>
                      </>
                    )}
                    {(validation.values.discountType === 'per_item' || validation.values.discountType === 'per_item_and_invoice') && (
                      <th className="text-end">Discount</th>
                    )}
                    <th className="text-end">Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    // Use the saved calculated values from the ItemModal
                    const quantity = item.isSerialized ? (item.serialNumbers || []).length : item.quantity;
                    const rate = parseFloat(item.rate) || 0;
                    const taxRate = parseFloat(item.taxRate) || 0;
                    const discountRate = parseFloat(item.discountRate) || 0;
                    const rateType = item.rateType || 'without_tax';
                    
                    // Use the saved calculated values instead of recalculating
                    const taxAmount = parseFloat(item.taxAmount) || 0;
                    const discount = parseFloat(item.discount) || 0;
                    const total = parseFloat(item.total) || 0;
                    
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="fw-semibold">{item.name || 'Select item'}</div>
                          {item.code && <div className="text-muted small">{item.code}</div>}
                        </td>
                        <td>{item.code || '-'}</td>
                        <td className="text-end">{quantity}</td>
                        <td className="text-end">₹{rate.toFixed(2)}</td>
                        {TAX_TYPES.find(tax => tax.value === validation.values.taxType)?.rate > 0 && (
                          <>
                            <td className="text-end">{taxRate.toFixed(2)}%</td>
                            <td className="text-end">₹{taxAmount.toFixed(2)}</td>
                          </>
                        )}
                        {(validation.values.discountType === 'per_item' || validation.values.discountType === 'per_item_and_invoice') && (
                          <td className="text-end">₹{discount.toFixed(2)}</td>
                        )}
                        <td className="text-end fw-bold">₹{total.toFixed(2)}</td>
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
                    );
                  })}
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

            </Row>

            <Row className="mb-4">
              <Col md={6}>
                <div className="border p-3 bg-light">
                  <h5>Summary</h5>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Basic Amount:</span>
                    <span>₹ {calculatedTotals.basicAmount.toFixed(2)}</span>
                  </div>
                  {(validation.values.discountType === 'on_invoice' || validation.values.discountType === 'per_item_and_invoice') && calculatedTotals.totalDiscount > 0 && (
                    <div className="d-flex justify-content-between mb-2">
                      <span>Invoice Discount ({validation.values.discountValue}{validation.values.discountValueType === 'percentage' ? '%' : '₹'}):</span>
                      <span className="text-danger">- ₹ {calculatedTotals.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                    <div className="d-flex justify-content-between mb-2">
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
                                 const discountValueType = validation.values.discountValueType || 'percentage';
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
                          <span className={(validation.values.roundOff || 0) > 0 ? 'text-success' : (validation.values.roundOff || 0) < 0 ? 'text-danger' : ''}>
                        {(validation.values.roundOff || 0) > 0 ? '+' : ''} ₹ {(validation.values.roundOff || 0).toFixed(2)}
                      </span>
                          <RiEditLine
                            className="text-muted cursor-pointer"
                            size={14}
                            onClick={() => {
                              setTempRoundOff((validation.values.roundOff || 0).toString());
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
        rateType={validation.values.rateType}
      />
    </>
  );
};

export default PurchaseInvoiceForm;
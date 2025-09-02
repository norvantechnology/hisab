// In ItemModal.js
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormGroup,
  Label,
  Input,
  InputGroup,
  InputGroupText,
  Table,
  Button,
  Row,
  Col,
  Badge,
  Alert
} from 'reactstrap';
import { RiLoader4Line, RiSearchLine, RiCloseLine } from 'react-icons/ri';
import { calculateItemTaxAndTotal } from '../../../utils/taxCalculations';
import { TAX_TYPES } from './contant';

const ItemModal = ({
  isOpen,
  toggle,
  currentItem,
  validation,
  searchTerm,
  setSearchTerm,
  loadingProducts,
  isFetchingMore,
  filteredProducts,
  scrollContainerRef,
  updateCurrentItem,
  saveItem,
  rateType
}) => {
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [discountRateInput, setDiscountRateInput] = useState('');
  const [localRateType, setLocalRateType] = useState(rateType || 'without_tax'); // Local rate type state
  const [errors, setErrors] = useState({});
  const [localCurrentItem, setLocalCurrentItem] = useState(null);

  // Sync local rate type with prop changes
  useEffect(() => {
    if (rateType && rateType !== localRateType) {
      setLocalRateType(rateType);
    }
  }, [rateType, localRateType]);

  // Initialize local state when modal opens or currentItem changes
  useEffect(() => {
    if (isOpen && currentItem) {
      setLocalCurrentItem(currentItem);
      
      // Initialize serial numbers
      if (currentItem.serialNumbers && Array.isArray(currentItem.serialNumbers)) {
        setSerialNumbers(currentItem.serialNumbers);
      } else {
        setSerialNumbers([]);
      }
      
      // Initialize rate input
      if (currentItem.rate !== undefined && currentItem.rate !== null) {
        setRateInput(String(currentItem.rate));
      } else {
        setRateInput('');
      }
      
      // Initialize discount rate input
      if (currentItem.discountRate !== undefined && currentItem.discountRate !== null) {
        setDiscountRateInput(String(currentItem.discountRate));
      } else {
        setDiscountRateInput('');
      }
      
      // Clear errors when modal opens
      setErrors({});
    }
  }, [isOpen, currentItem]);

  // Update local state when currentItem changes (for editing)
  useEffect(() => {
    if (currentItem && currentItem.id) {
      setLocalCurrentItem(currentItem);
      
      // Update serial numbers if they exist
      if (currentItem.serialNumbers && Array.isArray(currentItem.serialNumbers)) {
        setSerialNumbers(currentItem.serialNumbers);
      }
      
      // Update rate input
      if (currentItem.rate !== undefined && currentItem.rate !== null) {
        setRateInput(String(currentItem.rate));
      }
      
      // Update discount rate input
      if (currentItem.discountRate !== undefined && currentItem.discountRate !== null) {
        setDiscountRateInput(String(currentItem.discountRate));
      }
    }
  }, [currentItem?.id, currentItem?.serialNumbers, currentItem?.rate, currentItem?.discountRate]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    // Product selection validation
    if (!localCurrentItem?.productId) {
      newErrors.product = 'Please select a product';
    }

    // Quantity validation
    if (!localCurrentItem?.isSerialized) {
      if (!localCurrentItem?.quantity || localCurrentItem.quantity <= 0) {
        newErrors.quantity = 'Quantity must be greater than 0';
      }
    } else {
      if (serialNumbers.length === 0) {
        newErrors.serialNumbers = 'Please add at least one serial number for this serialized product';
      }
      if (localCurrentItem.currentStock && serialNumbers.length > localCurrentItem.currentStock) {
        newErrors.serialNumbers = `Cannot add more than ${localCurrentItem.currentStock} serial numbers`;
      }
    }

    // Rate validation
    if (isNaN(Number(rateInput)) || rateInput === '' || Number(rateInput) < 0) {
      newErrors.rate = 'Rate must be 0 or greater';
    }

    // Tax rate validation
    if ((validation.values.rateType || 'without_tax') === 'without_tax') {
      // For "Without Tax" items, tax rate is required only if the selected tax type has a rate > 0
      const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
      if (selectedTax && selectedTax.rate > 0) {
        if (!localCurrentItem?.taxRate || localCurrentItem.taxRate <= 0) {
          newErrors.taxRate = 'Tax rate is required for "Without Tax" items';
        } else if (localCurrentItem.taxRate > 100) {
          newErrors.taxRate = 'Tax rate cannot exceed 100%';
        }
      }
    } else if (localCurrentItem?.taxRate && (localCurrentItem.taxRate < 0 || localCurrentItem.taxRate > 100)) {
      // For "With Tax" items, tax rate is optional but must be valid if provided
      newErrors.taxRate = 'Tax rate must be between 0 and 100';
    }

    // Discount rate validation
    if (discountRateInput !== '' && (isNaN(Number(discountRateInput)) || Number(discountRateInput) < 0 || Number(discountRateInput) > 100)) {
      newErrors.discountRate = 'Discount rate must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [localCurrentItem, serialNumbers, rateInput, discountRateInput, validation.values.rateType, validation.values.taxType]);

  const handleAddSerialNumber = useCallback(() => {
    const trimmedSerial = newSerialNumber.trim();

    if (!trimmedSerial) {
      setErrors(prev => ({ ...prev, newSerial: 'Serial number cannot be empty' }));
      return;
    }

    if (serialNumbers.includes(trimmedSerial)) {
      setErrors(prev => ({ ...prev, newSerial: 'This serial number already exists' }));
      return;
    }

    if (localCurrentItem?.currentStock && serialNumbers.length >= localCurrentItem.currentStock) {
      setErrors(prev => ({ ...prev, newSerial: `Cannot add more than ${localCurrentItem.currentStock} serial numbers` }));
      return;
    }

    const updatedSerialNumbers = [...serialNumbers, trimmedSerial];
    setSerialNumbers(updatedSerialNumbers);
    setNewSerialNumber('');
    setErrors(prev => ({ ...prev, newSerial: '', serialNumbers: '' }));
    
    // Update local current item with new serial numbers
    setLocalCurrentItem(prev => ({
      ...prev,
      serialNumbers: updatedSerialNumbers
    }));
  }, [newSerialNumber, serialNumbers, localCurrentItem?.currentStock]);

  const removeSerialNumber = useCallback((serial) => {
    const updatedSerialNumbers = serialNumbers.filter(s => s !== serial);
    setSerialNumbers(updatedSerialNumbers);

    // Update local current item with updated serial numbers
    setLocalCurrentItem(prev => ({
      ...prev,
      serialNumbers: updatedSerialNumbers
    }));

    if (updatedSerialNumbers.length === 0) {
      setErrors(prev => ({ ...prev, serialNumbers: 'Please add at least one serial number for this serialized product' }));
    } else {
      setErrors(prev => ({ ...prev, serialNumbers: '' }));
    }
  }, [serialNumbers]);

  // Handle clicking on available serial numbers
  const handleSelectSerialNumber = useCallback((serialNumber) => {
    console.log('Selecting serial number:', serialNumber);
    if (serialNumbers.includes(serialNumber)) {
      console.log('Serial number already selected:', serialNumber);
      return;
    }

    if (localCurrentItem?.currentStock && serialNumbers.length >= localCurrentItem.currentStock) {
      console.log('Cannot add more serial numbers, stock limit reached.');
      setErrors(prev => ({ ...prev, newSerial: `Cannot add more than ${localCurrentItem.currentStock} serial numbers` }));
      return;
    }

    const updatedSerialNumbers = [...serialNumbers, serialNumber];
    setSerialNumbers(updatedSerialNumbers);
    setNewSerialNumber(''); // Clear the input field
    setErrors(prev => ({ ...prev, newSerial: '' }));

    // Update local current item with new serial numbers
    setLocalCurrentItem(prev => ({
      ...prev,
      serialNumbers: updatedSerialNumbers
    }));
  }, [serialNumbers, localCurrentItem?.currentStock]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSerialNumber();
    }
  }, [handleAddSerialNumber]);

  // Enhanced product selection with better state management
  const selectProduct = useCallback((product) => {
    // Don't use product's default tax - let user manually select tax options
    const defaultTaxRate = 0;
    
    // Preserve existing values when selecting a new product
    const existingRate = parseFloat(rateInput) || localCurrentItem?.rate || 0;
    const existingQuantity = localCurrentItem?.isSerialized ? serialNumbers.length : (localCurrentItem?.quantity || 1);
    const existingDiscountRate = parseFloat(discountRateInput) || localCurrentItem?.discountRate || 0;
    
    const subtotal = existingRate * existingQuantity;
    const discount = (subtotal * existingDiscountRate) / 100;
    const afterDiscount = subtotal - discount;
    // No automatic tax calculation - user will select tax manually
    const taxAmount = 0;

    const updatedItem = {
      ...localCurrentItem,
      id: localCurrentItem?.id || Date.now(),
      productId: product.id,
      name: product.name,
      code: product.itemCode,
      itemCode: product.itemCode,
      taxRate: defaultTaxRate, // Set to 0 instead of product.taxRate
      isSerialized: product.isSerialized,
      currentStock: product.currentStock ? parseFloat(product.currentStock) : 0,
      rate: existingRate,
      quantity: existingQuantity,
      discountRate: existingDiscountRate,
      subtotal: subtotal,
      discount: discount,
      taxAmount: taxAmount,
      total: afterDiscount + taxAmount,
      // Preserve existing serial numbers if switching to a serialized product
      serialNumbers: product.isSerialized ? (localCurrentItem?.serialNumbers || serialNumbers) : []
    };

    setLocalCurrentItem(updatedItem);
    
    // Update serial numbers state if switching to serialized product
    if (product.isSerialized && localCurrentItem?.serialNumbers) {
      setSerialNumbers(localCurrentItem.serialNumbers);
    }
    
    // Don't call updateCurrentItem here - let the parent get the updated item only when save is called
    // This prevents the circular update issue that was causing the selection to reset
  }, [localCurrentItem, serialNumbers, rateInput, discountRateInput]);

  // Enhanced local state update function
  const updateLocalItem = useCallback((field, value) => {
    setLocalCurrentItem(prev => {
      const updatedItem = { ...prev, [field]: value };
      
      // Always preserve serial numbers for serialized products
      if (prev?.isSerialized) {
        updatedItem.serialNumbers = serialNumbers;
      }
      
      return updatedItem;
    });
    
    // Don't call updateCurrentItem here to avoid circular updates
    // The parent will get the updated item when save is called
  }, [serialNumbers]);

  const renderProductList = useMemo(() => {
    if (loadingProducts) {
      return (
        <div className="text-center p-3">
          <RiLoader4Line className="spin" />
          <div className="text-muted">Loading products...</div>
        </div>
      );
    }

    if (filteredProducts.length > 0) {
      return (
        <>
          <Table borderless hover className="mb-0">
            <tbody>
              {filteredProducts.map(product => (
                <tr
                  key={product.id}
                  className={`cursor-pointer ${localCurrentItem?.productId === product.id ? 'table-primary' : ''}`}
                  onClick={() => selectProduct(product)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="fw-semibold">{product.name}</div>
                    <div className="text-muted small">{product.itemCode}</div>
                    {product.isSerialized && (
                      <Badge color="info" pill className="mt-1">Serialized</Badge>
                    )}
                    {product.isSerialized && product.availableSerialNumbers && product.availableSerialNumbers.length > 0 && (
                      <div className="mt-2">
                        <small className="text-success d-block mb-1">
                          Available Serial Numbers ({product.availableSerialNumbers.length}):
                        </small>
                        <div className="d-flex flex-wrap gap-1">
                          {product.availableSerialNumbers.slice(0, 5).map((serial, index) => (
                            <Badge
                              key={index}
                              color="success"
                              className="cursor-pointer"
                              style={{ fontSize: '0.75rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSerialNumber(serial);
                              }}
                            >
                              {serial}
                            </Badge>
                          ))}
                          {product.availableSerialNumbers.length > 5 && (
                            <Badge color="secondary" style={{ fontSize: '0.75rem' }}>
                              +{product.availableSerialNumbers.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="small">Stock: {product.currentStock}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {isFetchingMore && (
            <div className="text-center p-2">
              <RiLoader4Line className="spin" />
            </div>
          )}
        </>
      );
    }

    return (
      <div className="text-center p-3 text-muted">
        {searchTerm ? 'No products found matching your search' : 'No products available'}
      </div>
    );
  }, [loadingProducts, filteredProducts, localCurrentItem, isFetchingMore, selectProduct, searchTerm]);

  const calculatedValues = useMemo(() => {
    const rate = parseFloat(rateInput);
    const validRate = !isNaN(rate) && rate >= 0 ? rate : 0;
    const quantity = localCurrentItem?.isSerialized ? serialNumbers.length : (localCurrentItem?.quantity || 0);
    const taxRate = typeof localCurrentItem?.taxRate === 'number' && localCurrentItem.taxRate > 0 ? localCurrentItem.taxRate : 0;
    const discountRate = parseFloat(discountRateInput);
    const validDiscountRate = !isNaN(discountRate) && discountRate > 0 ? discountRate : 0;

    // Use the common tax calculation function
    const result = calculateItemTaxAndTotal({
      rate: validRate,
      quantity,
      taxRate,
      discountRate: validDiscountRate,
              rateType: validation.values.rateType || 'without_tax', // Use main form's rateType
      discountValueType: 'percentage', // Purchase modals use percentage discount
      discountValue: validDiscountRate
    });

    return {
      subtotal: result.subtotal,
      discount: result.discount,
      taxAmount: result.taxAmount,
      total: result.total
    };
  }, [rateInput, discountRateInput, localCurrentItem?.quantity, localCurrentItem?.taxRate, localCurrentItem?.isSerialized, serialNumbers.length, validation.values.rateType]);

  const renderItemDetails = useMemo(() => (
    <div className="pt-2">
      {/* Compact Product Selection Status */}
      {localCurrentItem?.productId ? (
        <div className="bg-success bg-opacity-10 border border-success rounded px-3 py-2 mb-3">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <strong className="text-success">✓ Selected:</strong> {localCurrentItem.name}
              <span className="text-muted ms-2">({localCurrentItem.code || localCurrentItem.itemCode || 'N/A'})</span>
            </div>
          {localCurrentItem.isSerialized && (
              <Badge color="info" size="sm">Serialized</Badge>
          )}
          </div>
        </div>
      ) : (
        <div className="bg-warning bg-opacity-10 border border-warning rounded px-3 py-2 mb-3">
          <span className="text-warning fw-medium">⚠ Please select a product from the list above</span>
        </div>
      )}

      {/* Product Selection Error */}
      {errors.product && (
        <div className="bg-danger bg-opacity-10 border border-danger rounded px-3 py-2 mb-3 text-danger">
          {errors.product}
        </div>
      )}

      {/* Compact Form Layout - All essential fields in one row */}
      <Row className="g-3">
        {/* Quantity */}
        <Col md={2} sm={6}>
          <FormGroup className="mb-0">
            <Label className="form-label fw-medium small">Qty *</Label>
            <Input
              type="number"
              size="sm"
              min="0.01"
              step="0.01"
              value={localCurrentItem?.isSerialized ? serialNumbers.length : (localCurrentItem?.quantity || '')}
              onChange={(e) => {
                if (!localCurrentItem?.isSerialized) {
                  const value = parseFloat(e.target.value) || 0;
                  updateLocalItem('quantity', value);
                }
              }}
              placeholder="0"
              disabled={localCurrentItem?.isSerialized}
              invalid={!!errors.quantity}
            />
            {errors.quantity && <div className="text-danger small">{errors.quantity}</div>}
            {localCurrentItem?.isSerialized && (
              <div className="form-text small">Auto: {serialNumbers.length}</div>
            )}
          </FormGroup>
        </Col>

        {/* Rate */}
        <Col md={3} sm={6}>
          <FormGroup className="mb-0">
            <Label className="form-label fw-medium small">
              Rate * 
              <span className="text-muted ms-1">({validation.values.rateType === 'with_tax' ? 'Inc Tax' : 'Ex Tax'})</span>
            </Label>
            <InputGroup size="sm">
              <InputGroupText>₹</InputGroupText>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="0.00"
                invalid={!!errors.rate}
              />
            </InputGroup>
            {errors.rate && <div className="text-danger small">{errors.rate}</div>}
          </FormGroup>
        </Col>

        {/* Tax Rate - Only show if tax type has rate > 0 */}
        {(() => {
          const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
          return selectedTax && selectedTax.rate > 0;
        })() && (
          <Col md={2} sm={6}>
            <FormGroup className="mb-0">
              <Label className="form-label fw-medium small">Tax %</Label>
              <InputGroup size="sm">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={localCurrentItem?.taxRate || ''}
                  onChange={(e) => updateLocalItem('taxRate', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  invalid={!!errors.taxRate}
                />
                <InputGroupText>%</InputGroupText>
              </InputGroup>
              {errors.taxRate && <div className="text-danger small">{errors.taxRate}</div>}
            </FormGroup>
          </Col>
        )}

        {/* Discount */}
        <Col md={(() => {
          const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
          return selectedTax && selectedTax.rate > 0 ? 2 : 3; // Wider when no tax field
        })()} sm={6}>
          <FormGroup className="mb-0">
            <Label className="form-label fw-medium small">Discount</Label>
            <InputGroup size="sm">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discountRateInput}
                onChange={(e) => setDiscountRateInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="0"
                invalid={!!errors.discountRate}
              />
              <Button
                color={validation.values.discountValueType === 'percentage' ? 'primary' : 'outline-secondary'}
                size="sm"
                style={{ minWidth: '35px' }}
                onClick={() => validation.setFieldValue('discountValueType', 'percentage')}
                type="button"
              >
                %
              </Button>
              <Button
                color={validation.values.discountValueType === 'rupees' ? 'primary' : 'outline-secondary'}
                size="sm"
                style={{ minWidth: '35px' }}
                onClick={() => validation.setFieldValue('discountValueType', 'rupees')}
                type="button"
              >
                ₹
              </Button>
            </InputGroup>
            {errors.discountRate && <div className="text-danger small">{errors.discountRate}</div>}
            <div className="form-text small text-muted">
              {validation.values.discountValueType === 'percentage' ? 'Percentage discount' : 'Fixed amount discount'}
            </div>
          </FormGroup>
        </Col>

        {/* Total Display */}
        <Col md={3} sm={12}>
          <FormGroup className="mb-0">
            <Label className="form-label fw-medium small">Item Total</Label>
            <div className="bg-light border rounded px-3 py-2 text-center">
              <span className="fw-bold fs-6 text-primary">₹{calculatedValues.total.toFixed(2)}</span>
            </div>
          </FormGroup>
        </Col>
      </Row>

      {/* Serial Numbers Section - Only show if serialized */}
      {localCurrentItem?.isSerialized && (
        <div className="mt-3 pt-3 border-top">
        <Row>
            <Col md={8}>
              <FormGroup className="mb-2">
                <Label className="form-label fw-medium small">Add Serial Numbers *</Label>
                <InputGroup size="sm">
                <Input
                  type="text"
                  value={newSerialNumber}
                    onChange={(e) => setNewSerialNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                                                 handleAddSerialNumber();
                      }
                    }}
                    placeholder="Enter serial number and press Enter"
                    invalid={!!errors.serialNumbers}
                  />
                                                       <Button color="primary" size="sm" onClick={handleAddSerialNumber}>
                  Add
                </Button>
              </InputGroup>
                {errors.serialNumbers && <div className="text-danger small">{errors.serialNumbers}</div>}
              </FormGroup>
            </Col>
            <Col md={4}>
              <Label className="form-label fw-medium small">Count: {serialNumbers.length}</Label>
              <div className="small text-muted">Stock: {localCurrentItem?.currentStock || 0}</div>
            </Col>
          </Row>

          {/* Added Serial Numbers */}
              {serialNumbers.length > 0 && (
            <div className="mt-2">
              <div className="d-flex flex-wrap gap-1">
                    {serialNumbers.map((serial, index) => (
                      <Badge
                        key={index}
                        color="primary"
                    className="d-flex align-items-center gap-1 px-2 py-1"
                  >
                    {serial}
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      style={{ fontSize: '0.6em' }}
                                             onClick={() => removeSerialNumber(serial)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
        </div>
      )}

      {/* Quick Settings Row - Only show Rate Type when tax is applicable */}
      {(() => {
        const selectedTax = TAX_TYPES.find(tax => tax.value === validation.values.taxType);
        const showTaxRelatedFields = selectedTax && selectedTax.rate > 0;
        
        return (
          <Row className="mt-3 pt-3 border-top">
            {showTaxRelatedFields && (
          <Col md={6}>
                <FormGroup className="mb-0">
                  <Label className="form-label fw-medium small">Rate Type</Label>
                  <div className="bg-light border rounded px-3 py-2 text-center small">
                    <span className="text-primary fw-medium">
                      {validation.values.rateType === 'with_tax' ? 'Including Tax' : 'Excluding Tax'}
                    </span>
              </div>
                  <div className="form-text small text-muted">Synced with main form</div>
            </FormGroup>
          </Col>
            )}
            <Col md={showTaxRelatedFields ? 6 : 12}>
              <FormGroup className="mb-0">
                <Label className="form-label fw-medium small">Stock Available</Label>
                <div className="bg-light border rounded px-3 py-1 text-center small">
                  <span className={localCurrentItem?.currentStock > 0 ? 'text-success' : 'text-danger'}>
                    {localCurrentItem?.currentStock || 0} units
                  </span>
              </div>
            </FormGroup>
          </Col>
        </Row>
        );
      })()}

      {/* Calculation Breakdown - Compact */}
      <div className="mt-3 pt-3 border-top">
        <div className="bg-light rounded p-3">
          <Row className="small">
            <Col md={3}>
              <div className="text-center">
                <div className="text-muted">Subtotal</div>
                <div className="fw-medium">₹{calculatedValues.subtotal.toFixed(2)}</div>
              </div>
          </Col>
            {calculatedValues.discount > 0 && (
              <Col md={3}>
                <div className="text-center">
                  <div className="text-muted">Discount</div>
                  <div className="fw-medium text-danger">-₹{calculatedValues.discount.toFixed(2)}</div>
                </div>
              </Col>
            )}
            {calculatedValues.taxAmount > 0 && (
              <Col md={3}>
                <div className="text-center">
                  <div className="text-muted">Tax</div>
                  <div className="fw-medium text-success">+₹{calculatedValues.taxAmount.toFixed(2)}</div>
                </div>
              </Col>
            )}
            <Col md={3}>
              <div className="text-center">
                <div className="text-muted">Total</div>
                <div className="fw-bold text-primary fs-6">₹{calculatedValues.total.toFixed(2)}</div>
              </div>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  ), [
    localCurrentItem, 
    serialNumbers, 
    errors, 
    rateInput, 
    discountRateInput, 
        validation.values.discountValueType,
    calculatedValues, 
    newSerialNumber, 
    handleAddSerialNumber, 
    removeSerialNumber, 
    updateLocalItem, 
    setRateInput, 
    setDiscountRateInput, 
    handleKeyPress,
    validation.setFieldValue,
    validation.values.taxType,
    validation.values.rateType
  ]);

  const handleSave = useCallback(() => {
    console.log('=== handleSave called ===');
    console.log('localCurrentItem:', localCurrentItem);
    console.log('rateInput:', rateInput);
    console.log('discountRateInput:', discountRateInput);
    console.log('calculatedValues:', calculatedValues);
    
    if (!validateForm()) {
      console.log('Validation failed, errors:', errors);
      return;
    }
    
    console.log('Validation passed, calling saveItem');

    const itemToSave = {
      ...localCurrentItem,
      name: localCurrentItem?.name,
      code: localCurrentItem?.code,
      serialNumbers: localCurrentItem?.isSerialized ? serialNumbers : undefined,
      quantity: localCurrentItem?.isSerialized ? serialNumbers.length : localCurrentItem?.quantity,
      rate: parseFloat(rateInput) || 0,
      rateType: localCurrentItem?.rateType || 'without_tax', // Preserve rateType
      taxRate: localCurrentItem?.taxRate || 0, // Preserve taxRate
      discountRate: parseFloat(discountRateInput) || 0,
      subtotal: calculatedValues.subtotal,
      discount: calculatedValues.discount,
      taxAmount: calculatedValues.taxAmount,
      total: calculatedValues.total
    };

    console.log('Item to save:', itemToSave);
    saveItem(itemToSave);
  }, [localCurrentItem, serialNumbers, saveItem, validateForm, calculatedValues, rateInput, discountRateInput, errors]);

  const isFormValid = useMemo(() => {
    return localCurrentItem?.productId &&
      Number(rateInput) >= 0 &&
      (localCurrentItem?.isSerialized ? serialNumbers.length > 0 : localCurrentItem?.quantity > 0) &&
      (discountRateInput === '' || (!isNaN(Number(discountRateInput)) && Number(discountRateInput) >= 0 && (validation.values.discountValueType === 'percentage' ? Number(discountRateInput) <= 100 : true)));
  }, [localCurrentItem, serialNumbers, rateInput, discountRateInput, validation.values.discountValueType]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <ModalHeader toggle={toggle}>
        {localCurrentItem?.id ? 'Edit Item' : 'Add New Item'}
      </ModalHeader>
      <ModalBody>
        {/* Product Selection Section */}
        <div className="mb-4">
          <h5 className="mb-3">Product Selection</h5>
          <InputGroup className="mb-3">
            <InputGroupText>
              <RiSearchLine />
            </InputGroupText>
            <Input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          <div
            className="border rounded"
            style={{ maxHeight: '250px', overflowY: 'auto' }}
            ref={scrollContainerRef}
          >
            {renderProductList}
          </div>
        </div>

        {renderItemDetails}
      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={toggle}>
          Cancel
        </Button>
        <Button
          color="primary"
          onClick={handleSave}
          disabled={!isFormValid}
        >
          {localCurrentItem?.id ? 'Update Item' : 'Add Item'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ItemModal;
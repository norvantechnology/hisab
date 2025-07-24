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
import { RiLoader2Line, RiSearchLine, RiCloseLine } from 'react-icons/ri';

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
  saveItem
}) => {
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [discountRateInput, setDiscountRateInput] = useState('');
  const [errors, setErrors] = useState({});
  const [localCurrentItem, setLocalCurrentItem] = useState(null); // Initialize as null instead of currentItem

  // Initialize local state when modal opens for new items only
  useEffect(() => {
    if (isOpen && (!currentItem || !currentItem.id)) {
      console.log('Initializing new item modal');
      setLocalCurrentItem({
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
      setSerialNumbers([]);
      setNewSerialNumber('');
      setRateInput('');
      setDiscountRateInput('');
      setErrors({});
    }
  }, [isOpen, currentItem?.id]);

  // Update local state when currentItem changes (for editing existing items only)
  useEffect(() => {
    // Only update local state if we have an existing item with an ID (editing mode)
    // Don't update for new items (currentItem without id) to prevent resetting product selection
    if (currentItem && currentItem.id && isOpen && currentItem.id !== localCurrentItem?.id) {
      console.log('Loading existing item data for editing:', currentItem);
      console.log('Available fields:', {
        name: currentItem.name,
        code: currentItem.code,
        itemCode: currentItem.itemCode,
        productCode: currentItem.productCode,
        productName: currentItem.productName
      });
      
      // Update local state with the existing item data
      setLocalCurrentItem(currentItem);
      
      // Update serial numbers if they exist
      if (currentItem.serialNumbers && Array.isArray(currentItem.serialNumbers)) {
        console.log('Setting serial numbers:', currentItem.serialNumbers);
        setSerialNumbers(currentItem.serialNumbers);
      } else {
        setSerialNumbers([]);
      }
      
      // Update rate input
      if (currentItem.rate !== undefined && currentItem.rate !== null) {
        console.log('Setting rate:', currentItem.rate);
        setRateInput(String(currentItem.rate));
      } else {
        setRateInput('');
      }
      
      // Update discount rate input
      if (currentItem.discountRate !== undefined && currentItem.discountRate !== null) {
        console.log('Setting discount rate:', currentItem.discountRate);
        setDiscountRateInput(String(currentItem.discountRate));
      } else {
        setDiscountRateInput('');
      }
    }
  }, [currentItem?.id, isOpen]); // Only depend on currentItem.id and isOpen, not the entire currentItem object

  // Cleanup effect when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when modal closes
      setLocalCurrentItem(null);
      setSerialNumbers([]);
      setNewSerialNumber('');
      setRateInput('');
      setDiscountRateInput('');
      setErrors({});
    }
  }, [isOpen]);

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
    if (localCurrentItem?.taxRate && (localCurrentItem.taxRate < 0 || localCurrentItem.taxRate > 100)) {
      newErrors.taxRate = 'Tax rate must be between 0 and 100';
    }

    // Discount rate validation
    if (discountRateInput !== '' && (isNaN(Number(discountRateInput)) || Number(discountRateInput) < 0 || Number(discountRateInput) > 100)) {
      newErrors.discountRate = 'Discount rate must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [localCurrentItem, serialNumbers, rateInput, discountRateInput]);

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

  const handleRemoveSerialNumber = useCallback((index) => {
    const updatedSerialNumbers = serialNumbers.filter((_, i) => i !== index);
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

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSerialNumber();
    }
  }, [handleAddSerialNumber]);

  // Enhanced local state update function that preserves serial numbers
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

  // Enhanced product selection with better state management
  const selectProduct = useCallback((product) => {
    console.log('Selecting product:', product);
    console.log('Current local item:', localCurrentItem);
    
    const defaultTaxRate = 0;
    const productTaxRate = product.taxRate ? parseFloat(product.taxRate) : defaultTaxRate;
    const existingRate = parseFloat(rateInput) || 0;
    const existingQuantity = localCurrentItem?.isSerialized ? serialNumbers.length : (localCurrentItem?.quantity || 1);
    const existingDiscountRate = parseFloat(discountRateInput) || 0;
    const subtotal = existingRate * existingQuantity;
    const discount = (subtotal * existingDiscountRate) / 100;
    const afterDiscount = subtotal - discount;
    const taxAmount = (afterDiscount * productTaxRate) / 100;
    
    const updatedItem = {
      ...localCurrentItem,
      id: localCurrentItem?.id || Date.now(),
      productId: product.id,
      name: product.name,
      code: product.itemCode,
      itemCode: product.itemCode,
      taxRate: productTaxRate,
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
    
    console.log('Updated item:', updatedItem);
    setLocalCurrentItem(updatedItem);
    
    // Update serial numbers state if switching to serialized product
    if (product.isSerialized && localCurrentItem?.serialNumbers) {
      setSerialNumbers(localCurrentItem.serialNumbers);
    }
    
    // Don't call updateCurrentItem here - let the parent get the updated item only when save is called
    // This prevents the circular update issue that was causing the selection to reset
  }, [localCurrentItem, rateInput, discountRateInput, serialNumbers]); // Removed updateCurrentItem from dependencies

  const renderProductList = useMemo(() => {
    if (loadingProducts) {
      return (
        <div className="text-center p-3">
          <RiLoader2Line className="spin" />
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
                  </td>
                  <td className="text-end">
                    <div className="small">Stock: {product.currentStock}</div>
                    <div className="small">Tax: {product.taxRate || 0}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {isFetchingMore && (
            <div className="text-center p-2">
              <RiLoader2Line className="spin" />
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
  }, [loadingProducts, filteredProducts, localCurrentItem?.productId, isFetchingMore, selectProduct, searchTerm]);

  const calculatedValues = useMemo(() => {
    const rate = parseFloat(rateInput);
    const validRate = !isNaN(rate) && rate >= 0 ? rate : 0;
    const quantity = localCurrentItem?.isSerialized ? serialNumbers.length : (localCurrentItem?.quantity || 0);
    const subtotal = quantity * validRate;

    // Calculate discount
    const discountRate = parseFloat(discountRateInput);
    const validDiscountRate = !isNaN(discountRate) && discountRate > 0 ? discountRate : 0;
    const discount = (subtotal * validDiscountRate) / 100;
    const afterDiscount = subtotal - discount;

    // Calculate tax
    const taxRate = typeof localCurrentItem?.taxRate === 'number' && localCurrentItem.taxRate > 0 ? localCurrentItem.taxRate : 0;
    const taxAmount = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + taxAmount;

    return {
      subtotal,
      discount,
      taxAmount,
      total
    };
  }, [rateInput, discountRateInput, localCurrentItem?.quantity, localCurrentItem?.taxRate, localCurrentItem?.isSerialized, serialNumbers.length]);

  const renderItemDetails = useMemo(() => (
    <div className="border-top pt-3">
      <h5 className="mb-3">Item Details</h5>

      {/* Product Selection Status */}
      {localCurrentItem?.productId ? (
        <div className="alert alert-success py-2 mb-3">
          <strong>Selected:</strong> {localCurrentItem.name} ({localCurrentItem.code || localCurrentItem.itemCode || localCurrentItem.productCode || 'N/A'})
          {localCurrentItem.isSerialized && (
            <Badge color="info" pill className="ms-2">Serialized</Badge>
          )}
        </div>
      ) : (
        <div className="alert alert-warning py-2 mb-3">
          Please select a product from the list above
        </div>
      )}

      {/* Product Selection Error */}
      {errors.product && (
        <Alert color="danger" className="py-2 mb-3">{errors.product}</Alert>
      )}

      <Row>
        <Col md={6}>
          <FormGroup>
            <Label>Quantity <span className="text-danger">*</span></Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={localCurrentItem?.isSerialized ? serialNumbers.length : (localCurrentItem?.quantity || '')}
              onChange={(e) => {
                if (!localCurrentItem?.isSerialized) {
                  const value = parseFloat(e.target.value) || 0;
                  updateLocalItem('quantity', value);
                }
              }}
              placeholder="Enter quantity"
              disabled={localCurrentItem?.isSerialized}
              invalid={!!errors.quantity}
            />
            {errors.quantity && <div className="text-danger small mt-1">{errors.quantity}</div>}
            {localCurrentItem?.isSerialized && (
              <div className="form-text">Quantity is determined by serial numbers ({serialNumbers.length})</div>
            )}
          </FormGroup>
        </Col>
        <Col md={6}>
          <FormGroup>
            <Label>Rate (Without Tax) <span className="text-danger">*</span></Label>
            <InputGroup>
              <InputGroupText>₹</InputGroupText>
              <Input
                type="text"
                inputMode="decimal"
                value={rateInput}
                onChange={e => {
                  setRateInput(e.target.value);
                  if (errors.rate) setErrors(prev => ({ ...prev, rate: '' }));
                }}
                onBlur={e => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value) && value >= 0) {
                    updateLocalItem('rate', value);
                  }
                }}
                placeholder="0.00"
                invalid={!!errors.rate}
              />
            </InputGroup>
            {errors.rate && <div className="text-danger small mt-1">{errors.rate}</div>}
          </FormGroup>
        </Col>
      </Row>

      {/* Serial Numbers Section */}
      {localCurrentItem?.isSerialized && (
        <Row>
          <Col md={12}>
            <FormGroup>
              <Label>Serial Numbers <span className="text-danger">*</span></Label>
              <InputGroup>
                <Input
                  type="text"
                  value={newSerialNumber}
                  onChange={(e) => {
                    setNewSerialNumber(e.target.value);
                    if (errors.newSerial) {
                      setErrors(prev => ({ ...prev, newSerial: '' }));
                    }
                  }}
                  placeholder="Enter serial number"
                  onKeyPress={handleKeyPress}
                  disabled={localCurrentItem.currentStock && serialNumbers.length >= localCurrentItem.currentStock}
                  invalid={!!errors.newSerial}
                />
                <Button
                  color="primary"
                  onClick={handleAddSerialNumber}
                  disabled={localCurrentItem.currentStock && serialNumbers.length >= localCurrentItem.currentStock}
                >
                  Add
                </Button>
              </InputGroup>

              {/* Serial Number Input Error */}
              {errors.newSerial && (
                <Alert color="danger" className="mt-2 py-2 mb-2">{errors.newSerial}</Alert>
              )}

              {/* Serial Numbers List Error */}
              {errors.serialNumbers && (
                <Alert color="danger" className="mt-2 py-2 mb-2">{errors.serialNumbers}</Alert>
              )}

              {/* Serial Numbers Display */}
              {serialNumbers.length > 0 && (
                <div className="mt-3 p-3 bg-light rounded">
                  <div className="mb-2 fw-semibold">Added Serial Numbers:</div>
                  <div className="d-flex flex-wrap gap-2">
                    {serialNumbers.map((serial, index) => (
                      <Badge
                        key={index}
                        color="primary"
                        className="d-inline-flex align-items-center py-2 px-3"
                        style={{ fontSize: '0.875rem' }}
                      >
                        <span className="me-2">{serial}</span>
                        <RiCloseLine
                          className="cursor-pointer"
                          onClick={() => handleRemoveSerialNumber(index)}
                          style={{ fontSize: '1rem' }}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {serialNumbers.length === 0 && (
                <div className="text-muted small mt-2">No serial numbers added yet</div>
              )}
            </FormGroup>
          </Col>
        </Row>
      )}

      <Row>
        <Col md={6}>
          <FormGroup>
            <Label>Tax Rate</Label>
            <InputGroup>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={localCurrentItem?.taxRate || ''}
                onChange={(e) => updateLocalItem('taxRate', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                invalid={!!errors.taxRate}
              />
              <InputGroupText>%</InputGroupText>
            </InputGroup>
            {errors.taxRate && <div className="text-danger small mt-1">{errors.taxRate}</div>}
            <div className="form-text">
              {localCurrentItem?.productId ? 'Product tax rate (editable)' : 'Manual tax rate'}
            </div>
          </FormGroup>
        </Col>
        <Col md={6}>
          <FormGroup>
            <Label>Discount Rate</Label>
            <InputGroup>
              <Input
                type="text"
                inputMode="decimal"
                value={discountRateInput}
                onChange={e => {
                  setDiscountRateInput(e.target.value);
                  if (errors.discountRate) setErrors(prev => ({ ...prev, discountRate: '' }));
                }}
                onBlur={e => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value) && value >= 0 && value <= 100) {
                    updateLocalItem('discountRate', value);
                  }
                }}
                placeholder="0.00"
                invalid={!!errors.discountRate}
              />
              <InputGroupText>%</InputGroupText>
            </InputGroup>
            {errors.discountRate && <div className="text-danger small mt-1">{errors.discountRate}</div>}
          </FormGroup>
        </Col>
      </Row>

      {/* Calculation Summary */}
      {localCurrentItem?.rate && (localCurrentItem?.quantity > 0 || serialNumbers.length > 0) && (
        <div className="border-top mt-3 pt-3">
          <h6 className="mb-3">Calculation Summary</h6>
          <Row>
            <Col md={6}>
              <div className="d-flex justify-content-between mb-2">
                <span>Subtotal:</span>
                <span>₹{calculatedValues.subtotal.toFixed(2)}</span>
              </div>
              {calculatedValues.discount > 0 && (
                <div className="d-flex justify-content-between mb-2">
                  <span>Item Discount ({localCurrentItem?.discountRate || 0}%):</span>
                  <span className="text-danger">- ₹{calculatedValues.discount.toFixed(2)}</span>
                </div>
              )}
              {calculatedValues.taxAmount > 0 && (
                <div className="d-flex justify-content-between mb-2">
                  <span>Tax ({localCurrentItem?.taxRate || 0}%):</span>
                  <span className="text-success">+ ₹{calculatedValues.taxAmount.toFixed(2)}</span>
                </div>
              )}
            </Col>
            <Col md={6}>
              <div className="bg-light p-3 rounded">
                <div className="d-flex justify-content-between fw-bold">
                  <span>Item Total:</span>
                  <span>₹{calculatedValues.total.toFixed(2)}</span>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      )}
    </div>
  ), [localCurrentItem?.productId, localCurrentItem?.isSerialized, localCurrentItem?.quantity, localCurrentItem?.taxRate, localCurrentItem?.rate, localCurrentItem?.discountRate, localCurrentItem?.currentStock, localCurrentItem?.name, localCurrentItem?.code, serialNumbers, newSerialNumber, errors, calculatedValues, rateInput, discountRateInput]);

  const handleSave = useCallback(() => {
    if (!validateForm()) {
      return;
    }

    const itemToSave = {
      ...localCurrentItem,
      name: localCurrentItem?.name,
      code: localCurrentItem?.code,
      serialNumbers: localCurrentItem?.isSerialized ? serialNumbers : undefined,
      quantity: localCurrentItem?.isSerialized ? serialNumbers.length : localCurrentItem?.quantity,
      rate: parseFloat(rateInput) || 0,
      discountRate: parseFloat(discountRateInput) || 0,
      subtotal: calculatedValues.subtotal,
      discount: calculatedValues.discount,
      taxAmount: calculatedValues.taxAmount,
      total: calculatedValues.total
    };

    saveItem(itemToSave);
  }, [localCurrentItem?.id, localCurrentItem?.isSerialized, localCurrentItem?.name, localCurrentItem?.code, localCurrentItem?.quantity, serialNumbers, rateInput, discountRateInput, calculatedValues, saveItem]);

  const isFormValid = useMemo(() => {
    return localCurrentItem?.productId &&
      Number(rateInput) >= 0 &&
      (localCurrentItem?.isSerialized ? serialNumbers.length > 0 : localCurrentItem?.quantity > 0) &&
      (discountRateInput === '' || (!isNaN(Number(discountRateInput)) && Number(discountRateInput) >= 0 && Number(discountRateInput) <= 100));
  }, [localCurrentItem?.productId, localCurrentItem?.isSerialized, localCurrentItem?.quantity, serialNumbers.length, rateInput, discountRateInput]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg" key={`item-modal-${isOpen ? 'open' : 'closed'}-${currentItem?.id || 'new'}`}>
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
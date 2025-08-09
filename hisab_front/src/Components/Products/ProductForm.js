import React, { useEffect, useState } from 'react';
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
    Alert
} from 'reactstrap';
import { RiLoader4Line } from 'react-icons/ri';
import ReactSelect from 'react-select';
import { useFormik } from "formik";
import * as Yup from "yup";

const ProductForm = ({
    isOpen,
    toggle,
    isEditMode,
    selectedProduct,
    onSubmit,
    isLoading = false,
    stockCategories = [],
    taxCategories = [],
    unitsOfMeasurement = [],
    categoriesLoading = false,
    taxCategoriesLoading = false,
    onAddStockCategory // Add this new prop for handling stock category addition
}) => {
    // Initialize with proper fallbacks
    const getInitialValues = () => ({
        name: selectedProduct?.name || '',
        productType: selectedProduct?.productType || 'product',
        itemCode: selectedProduct?.itemCode || '',
        hsnCode: selectedProduct?.hsnCode || '',
        description: selectedProduct?.description || '',
        defaultInvoiceDescription: selectedProduct?.defaultInvoiceDescription || '',
        isInventoryTracked: selectedProduct?.isInventoryTracked || false,
        isSerialized: selectedProduct?.isSerialized || false,
        unitOfMeasurementId: selectedProduct?.unitOfMeasurementId || selectedProduct?.unitOfMeasurement?.id || '',
        stockCategoryId: selectedProduct?.stockCategoryId || '',
        rate: selectedProduct ? parseFloat(selectedProduct.rate || 0) : 0,
        isTaxInclusive: selectedProduct?.isTaxInclusive || false,
        discount: selectedProduct ? parseFloat(selectedProduct.discount || 0) : 0,
        taxCategoryId: selectedProduct?.taxCategoryId || '',
        openingStockQty: selectedProduct ? parseFloat(selectedProduct.openingStockQty || 0) : 0,
        openingStockCostPerQty: selectedProduct ? parseFloat(selectedProduct.openingStockCostPerQty || 0) : 0,
        currentStock: isEditMode && selectedProduct ? parseFloat(selectedProduct.currentStock || 0) : 0,
        serialNumbers: Array.isArray(selectedProduct?.serialNumbers)
            ? selectedProduct.serialNumbers.map(sn => sn?.serialNumber || '')
            : [''],
    });

    const [serialInputMethod, setSerialInputMethod] = useState('single');
    const [bulkSerialNumbers, setBulkSerialNumbers] = useState('');
    const [patternPrefix, setPatternPrefix] = useState('');
    const [patternStart, setPatternStart] = useState(1);
    const [patternDigits, setPatternDigits] = useState('');
    const [showPatternSuccess, setShowPatternSuccess] = useState(false);
    const [showAllSerials, setShowAllSerials] = useState(false);
    const [showSubmitError, setShowSubmitError] = useState(false);
    const [stockReductionWarning, setStockReductionWarning] = useState('');

    const validation = useFormik({
        enableReinitialize: true,
        initialValues: getInitialValues(),
        validationSchema: Yup.object().shape({
            name: Yup.string().required("Product name is required"),
            productType: Yup.string().required("Product type is required"),
            itemCode: Yup.string().required("Item code is required"),
            hsnCode: Yup.string().when('productType', {
                is: (val) => val === 'product',
                then: (schema) => schema.required("HSN code is required"),
                otherwise: (schema) => schema
            }),
            rate: Yup.number()
                .min(0, "Rate must be 0 or greater")
                .required("Rate is required"),
            openingStockQty: Yup.number()
                .min(0, "Quantity must be 0 or greater")
                .when(['isInventoryTracked', 'productType', 'isEditMode'], {
                    is: (isInventoryTracked, productType, isEditMode) =>
                        isInventoryTracked && productType === 'product' && !isEditMode,
                    then: (schema) => schema.required("Opening stock quantity is required"),
                    otherwise: (schema) => schema
                }),
            openingStockCostPerQty: Yup.number()
                .min(0, "Cost must be 0 or greater")
                .when(['isInventoryTracked', 'productType'], {
                    is: (isInventoryTracked, productType) => isInventoryTracked && productType === 'product',
                    then: (schema) => schema.required("Opening stock cost per quantity is required"),
                    otherwise: (schema) => schema
                }),
            currentStock: Yup.number()
                .min(0, "Current stock must be 0 or greater")
                .when(['isEditMode', 'isInventoryTracked', 'productType'], {
                    is: (isEditMode, isInventoryTracked, productType) => isEditMode && isInventoryTracked && productType === 'product',
                    then: (schema) => schema.required("Current stock is required"),
                    otherwise: (schema) => schema
                }),
            serialNumbers: Yup.array()
                .when(['isSerialized', 'productType', 'isEditMode'], {
                    is: (isSerialized, productType, isEditMode) => isSerialized && productType === 'product',
                    then: (schema) => schema
                        .of(Yup.string().required("Serial number is required"))
                        .min(1, "At least one serial number is required")
                        .test(
                            'unique-serial-numbers',
                            'Serial numbers must be unique',
                            function (values) {
                                if (!values || values.length === 0) return true;
                                const nonEmptyValues = values.filter(v => v && v.trim() !== '');
                                const uniqueValues = new Set(nonEmptyValues);
                                return uniqueValues.size === nonEmptyValues.length;
                            }
                        )
                        .test(
                            'serial-count-matches-stock',
                            function (values) {
                                const { currentStock, openingStockQty } = this.parent;
                                const expectedCount = isEditMode ? currentStock : openingStockQty;
                                const actualCount = values ? values.length : 0;

                                if (actualCount !== expectedCount) {
                                    return this.createError({
                                        message: `Number of serial numbers (${actualCount}) must match ${isEditMode ? 'current stock' : 'opening stock'} quantity (${expectedCount})`
                                    });
                                }
                                return true;
                            }
                        )
                        .test(
                            'all-serials-filled',
                            'All serial numbers must be filled',
                            function (values) {
                                if (!values || values.length === 0) return true;
                                const emptySerials = values.filter(v => !v || v.trim() === '');
                                if (emptySerials.length > 0) {
                                    return this.createError({
                                        message: `${emptySerials.length} serial number(s) are empty. Please fill all serial numbers.`
                                    });
                                }
                                return true;
                            }
                        ),
                    otherwise: (schema) => schema.notRequired()
                }),
            discount: Yup.number()
                .min(0, "Discount cannot be negative")
                .max(100, "Discount cannot exceed 100%"),
            unitOfMeasurementId: Yup.string()
                .when(['isInventoryTracked', 'productType'], {
                    is: (isInventoryTracked, productType) => isInventoryTracked && productType === 'product',
                    then: (schema) => schema.required("Unit of measurement is required for inventory tracked items"),
                    otherwise: (schema) => schema
                }),
            stockCategoryId: Yup.string()
                .when(['isInventoryTracked', 'productType'], {
                    is: (isInventoryTracked, productType) => isInventoryTracked && productType === 'product',
                    then: (schema) => schema.required("Stock category is required for inventory tracked items"),
                    otherwise: (schema) => schema
                })
        }),
        onSubmit: async (values) => {
            if (!validation.isValid) {
                setShowSubmitError(true);
                return;
            }
            setShowSubmitError(false);
            await onSubmit(values);
        }
    });

    const isProcessing = validation.isSubmitting || isLoading;

    // Reset form when modal is closed or opened
    useEffect(() => {
        if (isOpen) {
            // Reset all local state when modal opens
            setSerialInputMethod('single');
            setBulkSerialNumbers('');
            setPatternPrefix('');
            setPatternStart(1);
            setPatternDigits('');
            setShowPatternSuccess(false);
            setShowAllSerials(false);
            setShowSubmitError(false);
            setStockReductionWarning('');
            
            // Reset form values based on selectedProduct
            validation.resetForm({ values: getInitialValues() });
        }
    }, [isOpen, selectedProduct]);

    // Effect to adjust serial numbers based on current stock in edit mode
    useEffect(() => {
        if (isEditMode && validation.values.isSerialized && validation.values.productType === 'product') {
            const currentSerialCount = validation.values.serialNumbers?.length || 0;
            const targetCount = parseInt(validation.values.currentStock) || 0;

            if (currentSerialCount !== targetCount && targetCount >= 0) {
                const currentSerials = [...(validation.values.serialNumbers || [])];
                let newSerials = [...currentSerials];

                if (currentSerialCount < targetCount) {
                    // Add empty serial numbers
                    const itemsToAdd = targetCount - currentSerialCount;
                    for (let i = 0; i < itemsToAdd; i++) {
                        newSerials.push('');
                    }
                    setStockReductionWarning('');
                } else if (currentSerialCount > targetCount) {
                    // Only remove empty serial numbers from the end
                    let itemsToRemove = currentSerialCount - targetCount;
                    let emptyCountAtEnd = 0;

                    // Count empty serials at the end of the array
                    for (let i = newSerials.length - 1; i >= 0; i--) {
                        if (!newSerials[i] || newSerials[i].trim() === '') {
                            emptyCountAtEnd++;
                        } else {
                            break;
                        }
                    }

                    const canRemove = Math.min(itemsToRemove, emptyCountAtEnd);
                    if (canRemove > 0) {
                        newSerials = newSerials.slice(0, newSerials.length - canRemove);
                        itemsToRemove -= canRemove;
                    }

                    // If we still need to remove more, show warning
                    if (itemsToRemove > 0) {
                        setStockReductionWarning(
                            `Cannot reduce stock to ${targetCount} because there are ${currentSerialCount - emptyCountAtEnd} filled serial numbers. ` +
                            `Please manually clear ${itemsToRemove} serial numbers first, or increase the current stock quantity.`
                        );
                        return; // Don't update the state
                    } else {
                        setStockReductionWarning('');
                    }
                }

                // Only update if serial numbers actually changed
                if (JSON.stringify(newSerials) !== JSON.stringify(currentSerials)) {
                    validation.setFieldValue('serialNumbers', newSerials);
                }
            } else if (targetCount === 0) {
                validation.setFieldValue('serialNumbers', []);
                setStockReductionWarning('');
            }
        }
    }, [validation.values.currentStock, isEditMode, validation.values.isSerialized, validation.values.productType]);

    // Effect to adjust serial numbers when opening stock changes (create mode)
    useEffect(() => {
        if (!isEditMode && validation.values.isSerialized && validation.values.productType === 'product') {
            const currentSerialCount = validation.values.serialNumbers?.length || 0;
            const targetCount = parseInt(validation.values.openingStockQty) || 0;

            if (currentSerialCount !== targetCount && targetCount >= 0) {
                let newSerials = [...(validation.values.serialNumbers || [])];

                if (currentSerialCount < targetCount) {
                    const itemsToAdd = targetCount - currentSerialCount;
                    for (let i = 0; i < itemsToAdd; i++) {
                        if (serialInputMethod === 'pattern' && patternPrefix) {
                            const num = patternStart + currentSerialCount + i;
                            const serial = `${patternPrefix}${num.toString().padStart(patternDigits || 0, '0')}`;
                            newSerials.push(serial);
                        } else {
                            newSerials.push('');
                        }
                    }
                } else if (currentSerialCount > targetCount) {
                    // Only remove empty serial numbers from the end in create mode
                    let emptyCountAtEnd = 0;
                    for (let i = newSerials.length - 1; i >= 0; i--) {
                        if (!newSerials[i] || newSerials[i].trim() === '') {
                            emptyCountAtEnd++;
                        } else {
                            break;
                        }
                    }
                    
                    const itemsToRemove = currentSerialCount - targetCount;
                    const canRemove = Math.min(itemsToRemove, emptyCountAtEnd);
                    
                    if (canRemove > 0) {
                        newSerials = newSerials.slice(0, newSerials.length - canRemove);
                    }
                }

                validation.setFieldValue('serialNumbers', newSerials);
            } else if (targetCount === 0) {
                validation.setFieldValue('serialNumbers', []);
            }
        }
    }, [
        validation.values.openingStockQty,
        validation.values.isSerialized,
        validation.values.productType,
        serialInputMethod,
        patternPrefix,
        patternStart,
        patternDigits,
        isEditMode
    ]);

    // Effect to handle serialization toggle
    useEffect(() => {
        if (!validation.values.isSerialized) {
            validation.setFieldValue('serialNumbers', []);
            setStockReductionWarning('');
        } else if (validation.values.productType === 'product') {
            // Initialize serial numbers when serialization is enabled
            const targetCount = isEditMode
                ? parseInt(validation.values.currentStock) || 0
                : parseInt(validation.values.openingStockQty) || 0;

            if (targetCount > 0) {
                const newSerials = Array(targetCount).fill('');
                validation.setFieldValue('serialNumbers', newSerials);
            }
        }
    }, [validation.values.isSerialized, validation.values.productType]);

    const handleBulkSerialNumbersSubmit = () => {
        const numbers = bulkSerialNumbers
            .split('\n')
            .map(s => s.trim())
            .filter(s => s !== '');

        if (numbers.length > 0) {
            validation.setFieldValue('serialNumbers', numbers);
            if (isEditMode) {
                validation.setFieldValue('currentStock', numbers.length);
            } else {
                validation.setFieldValue('openingStockQty', numbers.length);
            }
            setBulkSerialNumbers('');
            setSerialInputMethod('single');
        }
    };

    const generatePatternSerials = () => {
        const targetCount = isEditMode
            ? parseInt(validation.values.currentStock) || 0
            : parseInt(validation.values.openingStockQty) || 0;

        if (targetCount > 0) {
            const serials = [];
            for (let i = 0; i < targetCount; i++) {
                const num = patternStart + i;
                const serial = `${patternPrefix}${num.toString().padStart(patternDigits || 0, '0')}`;
                serials.push(serial);
            }
            validation.setFieldValue('serialNumbers', serials);
            setShowPatternSuccess(true);
            setSerialInputMethod('single');
            setTimeout(() => setShowPatternSuccess(false), 3000);
        }
    };

    const getSafeSerialNumbers = () => {
        try {
            return Array.isArray(validation.values.serialNumbers)
                ? validation.values.serialNumbers
                : [];
        } catch {
            return [];
        }
    };

    const handleSerialNumberRemove = (indexToRemove) => {
        const newSerials = [...getSafeSerialNumbers()];
        newSerials.splice(indexToRemove, 1);
        validation.setFieldValue('serialNumbers', newSerials);

        // Update the corresponding stock quantity
        if (isEditMode) {
            validation.setFieldValue('currentStock', newSerials.length);
        } else {
            validation.setFieldValue('openingStockQty', newSerials.length);
        }
    };

    const handleNumberInputWheel = (e) => {
        e.target.blur();
    };

    const handlePatternDigitsChange = (e) => {
        const value = e.target.value;
        if (value === '' || (value >= 0 && value <= 10)) {
            setPatternDigits(value === '' ? '' : parseInt(value));
        }
    };

    const unitOptions = unitsOfMeasurement?.map(unit => ({
        value: unit.id,
        label: `${unit.name} (${unit.symbol})`
    })) || [];

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg" className="product-form-modal">
            <ModalHeader toggle={toggle}>{isEditMode ? 'Edit Product' : 'Create Product'}</ModalHeader>
            <ModalBody>
                <Form onSubmit={validation.handleSubmit}>
                    {showSubmitError && !validation.isValid && (
                        <Alert color="danger" className="mb-3">
                            Please fix all validation errors before submitting.
                        </Alert>
                    )}

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Product Name *</Label>
                                <Input
                                    type="text"
                                    name="name"
                                    {...validation.getFieldProps('name')}
                                    invalid={validation.touched.name && !!validation.errors.name}
                                    disabled={isProcessing}
                                />
                                <FormFeedback>{validation.errors.name}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Product Type *</Label>
                                <Input
                                    type="select"
                                    name="productType"
                                    {...validation.getFieldProps('productType')}
                                    invalid={validation.touched.productType && !!validation.errors.productType}
                                    disabled={isProcessing}
                                >
                                    <option value="product">Product</option>
                                    <option value="service">Service</option>
                                    <option value="charge">Charge</option>
                                </Input>
                                <FormFeedback>{validation.errors.productType}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Item Code *</Label>
                                <Input
                                    type="text"
                                    name="itemCode"
                                    {...validation.getFieldProps('itemCode')}
                                    invalid={validation.touched.itemCode && !!validation.errors.itemCode}
                                    disabled={isProcessing}
                                />
                                <FormFeedback>{validation.errors.itemCode}</FormFeedback>
                            </FormGroup>
                        </Col>
                        {validation.values.productType === 'product' && (
                            <Col md={6}>
                                <FormGroup>
                                    <Label>HSN Code *</Label>
                                    <Input
                                        type="text"
                                        name="hsnCode"
                                        {...validation.getFieldProps('hsnCode')}
                                        invalid={validation.touched.hsnCode && !!validation.errors.hsnCode}
                                        disabled={isProcessing}
                                    />
                                    <FormFeedback>{validation.errors.hsnCode}</FormFeedback>
                                </FormGroup>
                            </Col>
                        )}
                        <Col md={6}>
                            <FormGroup>
                                <Label>Default Invoice Description</Label>
                                <Input
                                    type="text"
                                    name="defaultInvoiceDescription"
                                    {...validation.getFieldProps('defaultInvoiceDescription')}
                                    disabled={isProcessing}
                                />
                            </FormGroup>
                        </Col>
                    </Row>

                    <FormGroup>
                        <Label>Description</Label>
                        <Input
                            type="textarea"
                            name="description"
                            rows="2"
                            {...validation.getFieldProps('description')}
                            disabled={isProcessing}
                        />
                    </FormGroup>

                    <Row className="mb-3">
                        {validation.values.productType === 'product' && (
                            <>
                                <Col md={4}>
                                    <FormGroup check>
                                        <Label check>
                                            <Input
                                                type="checkbox"
                                                name="isInventoryTracked"
                                                checked={validation.values.isInventoryTracked}
                                                onChange={validation.handleChange}
                                                disabled={isProcessing}
                                            /> Inventory Tracked
                                        </Label>
                                    </FormGroup>
                                </Col>
                                <Col md={4}>
                                    <FormGroup check>
                                        <Label check>
                                            <Input
                                                type="checkbox"
                                                name="isSerialized"
                                                checked={validation.values.isSerialized}
                                                onChange={validation.handleChange}
                                                disabled={isProcessing || !validation.values.isInventoryTracked}
                                            /> Serialized Product
                                        </Label>
                                    </FormGroup>
                                </Col>
                            </>
                        )}
                        <Col md={4}>
                            <FormGroup check>
                                <Label check>
                                    <Input
                                        type="checkbox"
                                        name="isTaxInclusive"
                                        checked={validation.values.isTaxInclusive}
                                        onChange={validation.handleChange}
                                        disabled={isProcessing}
                                    /> Price Includes Tax
                                </Label>
                            </FormGroup>
                        </Col>
                    </Row>

                    {validation.values.productType === 'product' && (
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label>Unit of Measurement {validation.values.isInventoryTracked && '*'}</Label>
                                    <ReactSelect
                                        options={unitOptions}
                                        value={unitOptions.find(opt => opt.value === validation.values.unitOfMeasurementId)}
                                        onChange={(selectedOption) => {
                                            validation.setFieldValue(
                                                'unitOfMeasurementId',
                                                selectedOption?.value || ''
                                            );
                                            validation.setFieldTouched('unitOfMeasurementId', true);
                                        }}
                                        onBlur={() => validation.setFieldTouched('unitOfMeasurementId', true)}
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                        placeholder="Select Unit"
                                        isClearable
                                        isDisabled={isProcessing}
                                        noOptionsMessage={() => "No units found"}
                                        menuPlacement="auto"
                                    />
                                    {validation.values.isInventoryTracked && validation.touched.unitOfMeasurementId && validation.errors.unitOfMeasurementId && (
                                        <div className="text-danger small mt-1">
                                            {validation.errors.unitOfMeasurementId}
                                        </div>
                                    )}
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label>Stock Category {validation.values.isInventoryTracked && '*'}</Label>
                                    <div className="d-flex gap-2">
                                        <Input
                                            type="select"
                                            name="stockCategoryId"
                                            {...validation.getFieldProps('stockCategoryId')}
                                            invalid={validation.touched.stockCategoryId && !!validation.errors.stockCategoryId}
                                            disabled={isProcessing || categoriesLoading}
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Select</option>
                                            {stockCategories.map(category => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </Input>
                                        <Button
                                            color="outline-primary"
                                            size="sm"
                                            onClick={onAddStockCategory}
                                            disabled={isProcessing || categoriesLoading}
                                            style={{ minWidth: '60px' }}
                                        >
                                            Add
                                        </Button>
                                    </div>
                                    {validation.values.isInventoryTracked && (
                                        <FormFeedback>{validation.errors.stockCategoryId}</FormFeedback>
                                    )}
                                </FormGroup>
                            </Col>
                        </Row>
                    )}

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Rate *</Label>
                                <Input
                                    type="number"
                                    name="rate"
                                    step="0.01"
                                    min="0"
                                    {...validation.getFieldProps('rate')}
                                    invalid={validation.touched.rate && !!validation.errors.rate}
                                    disabled={isProcessing}
                                    onWheel={handleNumberInputWheel}
                                />
                                <FormFeedback>{validation.errors.rate}</FormFeedback>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Discount (%)</Label>
                                <Input
                                    type="number"
                                    name="discount"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    {...validation.getFieldProps('discount')}
                                    invalid={validation.touched.discount && !!validation.errors.discount}
                                    disabled={isProcessing}
                                    onWheel={handleNumberInputWheel}
                                />
                                <FormFeedback>{validation.errors.discount}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                    {validation.values.isInventoryTracked && validation.values.productType === 'product' && (
                        <Row>
                            <Col md={isEditMode ? 4 : 6}>
                                <FormGroup>
                                    <Label>{isEditMode ? 'Opening Stock Qty' : 'Opening Stock Qty *'}</Label>
                                    <Input
                                        type="number"
                                        name="openingStockQty"
                                        step="1"
                                        min="0"
                                        {...validation.getFieldProps('openingStockQty')}
                                        invalid={validation.touched.openingStockQty && !!validation.errors.openingStockQty}
                                        disabled={isProcessing || isEditMode}
                                        onWheel={handleNumberInputWheel}
                                    />
                                    <FormFeedback>{validation.errors.openingStockQty}</FormFeedback>
                                </FormGroup>
                            </Col>
                            <Col md={isEditMode ? 4 : 6}>
                                <FormGroup>
                                    <Label>Opening Stock Cost/Qty *</Label>
                                    <Input
                                        type="number"
                                        name="openingStockCostPerQty"
                                        step="0.01"
                                        min="0"
                                        {...validation.getFieldProps('openingStockCostPerQty')}
                                        invalid={validation.touched.openingStockCostPerQty && !!validation.errors.openingStockCostPerQty}
                                        disabled={isProcessing}
                                        onWheel={handleNumberInputWheel}
                                    />
                                    <FormFeedback>{validation.errors.openingStockCostPerQty}</FormFeedback>
                                </FormGroup>
                            </Col>
                            {isEditMode && (
                                <Col md={4}>
                                    <FormGroup>
                                        <Label>Current Stock *</Label>
                                        <Input
                                            type="number"
                                            name="currentStock"
                                            step="1"
                                            min="0"
                                            {...validation.getFieldProps('currentStock')}
                                            invalid={validation.touched.currentStock && !!validation.errors.currentStock}
                                            disabled={isProcessing}
                                            onWheel={handleNumberInputWheel}
                                        />
                                        <FormFeedback>{validation.errors.currentStock}</FormFeedback>
                                    </FormGroup>
                                </Col>
                            )}
                        </Row>
                    )}

                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Tax Category</Label>
                                <Input
                                    type="select"
                                    name="taxCategoryId"
                                    {...validation.getFieldProps('taxCategoryId')}
                                    disabled={isProcessing || taxCategoriesLoading}
                                >
                                    <option value="">Select</option>
                                    {taxCategories.map(taxCategory => (
                                        <option key={taxCategory.id} value={taxCategory.id}>
                                            {taxCategory.name} ({taxCategory.rate}%)
                                        </option>
                                    ))}
                                </Input>
                            </FormGroup>
                        </Col>
                    </Row>

                    {validation.values.isSerialized && validation.values.productType === 'product' && (
                        <FormGroup className="serial-numbers-section">
                            <Label>Serial Numbers *</Label>
                            {stockReductionWarning && (
                                <Alert color="warning" className="mb-2">
                                    {stockReductionWarning}
                                </Alert>
                            )}
                            <div className="mb-2">
                                <small className="text-muted">
                                    {isEditMode
                                        ? `${validation.values.currentStock} serial numbers required (matches current stock)`
                                        : `${validation.values.openingStockQty} serial numbers required (matches opening stock)`}
                                </small>
                            </div>

                            {/* Display serial numbers validation error */}
                            {validation.touched.serialNumbers && validation.errors.serialNumbers && typeof validation.errors.serialNumbers === 'string' && (
                                <Alert color="danger" className="mb-2">
                                    {validation.errors.serialNumbers}
                                </Alert>
                            )}

                            <div className="serial-input-methods mb-3">
                                <div className="d-flex flex-wrap gap-3 mb-3">
                                    <Button
                                        color={serialInputMethod === 'single' ? 'primary' : 'secondary'}
                                        onClick={() => {
                                            setSerialInputMethod('single');
                                            setShowAllSerials(false);
                                        }}
                                        disabled={isProcessing}
                                        className="flex-grow-1"
                                    >
                                        Single Entry
                                    </Button>
                                    <Button
                                        color={serialInputMethod === 'bulk' ? 'primary' : 'secondary'}
                                        onClick={() => setSerialInputMethod('bulk')}
                                        disabled={isProcessing}
                                        className="flex-grow-1"
                                    >
                                        Bulk Entry
                                    </Button>
                                    <Button
                                        color={serialInputMethod === 'pattern' ? 'primary' : 'secondary'}
                                        onClick={() => setSerialInputMethod('pattern')}
                                        disabled={isProcessing}
                                        className="flex-grow-1"
                                    >
                                        Pattern
                                    </Button>
                                </div>

                                {serialInputMethod === 'bulk' && (
                                    <div className="bulk-entry-container mb-3 p-3 border rounded">
                                        <p className="small text-muted">Enter one serial number per line:</p>
                                        <Input
                                            type="textarea"
                                            rows="5"
                                            value={bulkSerialNumbers}
                                            onChange={(e) => setBulkSerialNumbers(e.target.value)}
                                            disabled={isProcessing}
                                            className="mb-2"
                                        />
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-muted">
                                                {bulkSerialNumbers.split('\n').filter(l => l.trim() !== '').length} serial numbers detected
                                            </small>
                                            <Button
                                                color="primary"
                                                onClick={handleBulkSerialNumbersSubmit}
                                                disabled={isProcessing || !bulkSerialNumbers.trim()}
                                                size="sm"
                                            >
                                                Apply Serial Numbers
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {serialInputMethod === 'pattern' && (
                                    <div className="pattern-generator-container mb-3 p-3 border rounded">
                                        <Row>
                                            <Col md={4}>
                                                <FormGroup>
                                                    <Label>Prefix</Label>
                                                    <Input
                                                        type="text"
                                                        value={patternPrefix}
                                                        onChange={(e) => setPatternPrefix(e.target.value)}
                                                        disabled={isProcessing}
                                                        placeholder="ABC"
                                                    />
                                                </FormGroup>
                                            </Col>
                                            <Col md={3}>
                                                <FormGroup>
                                                    <Label>Start Number</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={patternStart}
                                                        onChange={(e) => setPatternStart(parseInt(e.target.value) || 1)}
                                                        disabled={isProcessing}
                                                        onWheel={handleNumberInputWheel}
                                                    />
                                                </FormGroup>
                                            </Col>
                                            <Col md={3}>
                                                <FormGroup>
                                                    <Label>Digits</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="10"
                                                        value={patternDigits}
                                                        onChange={handlePatternDigitsChange}
                                                        disabled={isProcessing}
                                                        onWheel={handleNumberInputWheel}
                                                    />
                                                </FormGroup>
                                            </Col>
                                            <Col md={2} className="d-flex align-items-end">
                                                <Button
                                                    color="primary"
                                                    onClick={generatePatternSerials}
                                                    disabled={isProcessing || !patternPrefix}
                                                    className="w-100"
                                                >
                                                    Generate
                                                </Button>
                                            </Col>
                                        </Row>
                                        <div className="mt-2">
                                            <small className="text-muted d-block">
                                                Example: {patternPrefix || 'ABC'}{patternStart.toString().padStart(patternDigits || 0, '0')},
                                                {patternPrefix || 'ABC'}{(patternStart + 1).toString().padStart(patternDigits || 0, '0')},
                                                {patternPrefix || 'ABC'}{(patternStart + 2).toString().padStart(patternDigits || 0, '0')}, ...
                                            </small>
                                            {showPatternSuccess && (
                                                <Alert color="success" className="mt-2 p-2 small">
                                                    Successfully generated {isEditMode
                                                        ? validation.values.currentStock
                                                        : validation.values.openingStockQty} serial numbers
                                                </Alert>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(serialInputMethod === 'single' || showPatternSuccess) && (
                                <div className="serial-numbers-list">
                                    {showAllSerials || getSafeSerialNumbers().length <= 10 ? (
                                        getSafeSerialNumbers().map((serial, index) => (
                                            <div key={`serial-${index}`} className="serial-number-item d-flex mb-2 align-items-center">
                                                <div className="serial-number-index badge bg-light text-dark me-2">
                                                    {index + 1}
                                                </div>
                                                <Input
                                                    type="text"
                                                    value={serial || ''}
                                                    onChange={(e) => {
                                                        const newSerials = [...getSafeSerialNumbers()];
                                                        newSerials[index] = e.target.value;
                                                        validation.setFieldValue('serialNumbers', newSerials);
                                                    }}
                                                    onBlur={() => validation.setFieldTouched('serialNumbers', true)}
                                                    invalid={
                                                        validation.touched.serialNumbers &&
                                                        validation.errors.serialNumbers &&
                                                        Array.isArray(validation.errors.serialNumbers) &&
                                                        validation.errors.serialNumbers[index]
                                                    }
                                                    disabled={isProcessing}
                                                    className="flex-grow-1 me-2"
                                                />
                                                {getSafeSerialNumbers().length > 1 && (
                                                    <Button
                                                        color="danger"
                                                        onClick={() => handleSerialNumberRemove(index)}
                                                        disabled={isProcessing}
                                                        size="sm"
                                                        className="serial-number-remove"
                                                    >
                                                        ×
                                                    </Button>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            {getSafeSerialNumbers().slice(0, 3).map((serial, index) => (
                                                <div key={`serial-${index}`} className="serial-number-item d-flex mb-2 align-items-center">
                                                    <div className="serial-number-index badge bg-light text-dark me-2">
                                                        {index + 1}
                                                    </div>
                                                    <Input
                                                        type="text"
                                                        value={serial || ''}
                                                        onChange={(e) => {
                                                            const newSerials = [...getSafeSerialNumbers()];
                                                            newSerials[index] = e.target.value;
                                                            validation.setFieldValue('serialNumbers', newSerials);
                                                        }}
                                                        onBlur={() => validation.setFieldTouched('serialNumbers', true)}
                                                        invalid={
                                                            validation.touched.serialNumbers &&
                                                            validation.errors.serialNumbers &&
                                                            Array.isArray(validation.errors.serialNumbers) &&
                                                            validation.errors.serialNumbers[index]
                                                        }
                                                        disabled={isProcessing}
                                                        className="flex-grow-1 me-2"
                                                    />
                                                    <Button
                                                        color="danger"
                                                        onClick={() => handleSerialNumberRemove(index)}
                                                        disabled={isProcessing}
                                                        size="sm"
                                                        className="serial-number-remove"
                                                    >
                                                        ×
                                                    </Button>
                                                </div>
                                            ))}
                                            <div className="text-center my-2">
                                                <Button
                                                    color="link"
                                                    onClick={() => setShowAllSerials(true)}
                                                    size="sm"
                                                >
                                                    Show all {getSafeSerialNumbers().length} serial numbers
                                                </Button>
                                            </div>
                                            {getSafeSerialNumbers().slice(-3).map((serial, index) => {
                                                const realIndex = getSafeSerialNumbers().length - 3 + index;
                                                return (
                                                    <div key={`serial-${realIndex}`} className="serial-number-item d-flex mb-2 align-items-center">
                                                        <div className="serial-number-index badge bg-light text-dark me-2">
                                                            {realIndex + 1}
                                                        </div>
                                                        <Input
                                                            type="text"
                                                            value={serial || ''}
                                                            onChange={(e) => {
                                                                const newSerials = [...getSafeSerialNumbers()];
                                                                newSerials[realIndex] = e.target.value;
                                                                validation.setFieldValue('serialNumbers', newSerials);
                                                            }}
                                                            onBlur={() => validation.setFieldTouched('serialNumbers', true)}
                                                            invalid={
                                                                validation.touched.serialNumbers &&
                                                                validation.errors.serialNumbers &&
                                                                Array.isArray(validation.errors.serialNumbers) &&
                                                                validation.errors.serialNumbers[realIndex]
                                                            }
                                                            disabled={isProcessing}
                                                            className="flex-grow-1 me-2"
                                                        />
                                                        <Button
                                                            color="danger"
                                                            onClick={() => handleSerialNumberRemove(realIndex)}
                                                            disabled={isProcessing}
                                                            size="sm"
                                                            className="serial-number-remove"
                                                        >
                                                            ×
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            )}
                        </FormGroup>
                    )}

                    <ModalFooter>
                        <Button color="light" onClick={toggle} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            type="submit"
                            disabled={isProcessing || !validation.isValid}
                            onClick={() => {
                                if (!validation.isValid) {
                                    setShowSubmitError(true);
                                }
                            }}
                        >
                            {isProcessing ? (
                                <>
                                    <RiLoader4Line className="spin me-1" />
                                    {isEditMode ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                isEditMode ? 'Update Product' : 'Create Product'
                            )}
                        </Button>
                    </ModalFooter>
                </Form>
            </ModalBody>
        </Modal>
    );
};

export default ProductForm;
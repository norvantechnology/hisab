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
    Alert,
    Badge,
    Card,
    CardBody
} from 'reactstrap';
import { RiLoader4Line, RiProductHuntLine, RiAddLine, RiDeleteBinLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
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
    onAddStockCategory
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
                .when(['isInventoryTracked', 'productType'], {
                    is: (isInventoryTracked, productType) =>
                        isInventoryTracked && productType === 'product' && !isEditMode,
                    then: (schema) => schema.required("Opening stock quantity is required"),
                    otherwise: (schema) => schema
                }),
            openingStockCostPerQty: Yup.number()
                .min(0, "Cost must be 0 or greater")
                .when(['isInventoryTracked', 'productType'], {
                    is: (isInventoryTracked, productType) => isInventoryTracked && productType === 'product' && !isEditMode,
                    then: (schema) => schema.required("Opening stock cost per quantity is required"),
                    otherwise: (schema) => schema
                }),
            currentStock: Yup.number()
                .min(0, "Current stock must be 0 or greater")
                .when(['isInventoryTracked', 'productType'], {
                    is: (isInventoryTracked, productType) => isEditMode && isInventoryTracked && productType === 'product',
                    then: (schema) => schema.required("Current stock is required"),
                    otherwise: (schema) => schema
                }),
            serialNumbers: Yup.array()
                .when(['isSerialized', 'productType'], {
                    is: (isSerialized, productType) => isSerialized && productType === 'product',
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
                        ),
                    otherwise: (schema) => schema
                })
        }),
        onSubmit: async (values) => {
            setShowSubmitError(false);
            try {
            await onSubmit(values);
            } catch (error) {
                console.error('Form submission error:', error);
                setShowSubmitError(true);
            }
        }
    });

    // Helper functions for options formatting
    const unitOptions = unitsOfMeasurement.map(unit => ({
        value: unit.id,
        label: unit.name
    }));

    const taxOptions = taxCategories.map(tax => ({
        value: tax.id,
        label: `${tax.name} (${tax.rate}%)`
    }));

    const isProcessing = isLoading;

    // Serial number management functions
    const addSerialNumber = () => {
        const currentSerials = [...validation.values.serialNumbers];
        currentSerials.push('');
        validation.setFieldValue('serialNumbers', currentSerials);
    };

    const removeSerialNumber = (index) => {
        const currentSerials = [...validation.values.serialNumbers];
        currentSerials.splice(index, 1);
        validation.setFieldValue('serialNumbers', currentSerials);
    };

    const updateSerialNumber = (index, value) => {
        const currentSerials = [...validation.values.serialNumbers];
        currentSerials[index] = value;
        validation.setFieldValue('serialNumbers', currentSerials);
    };

    const generatePatternSerials = () => {
        if (!patternPrefix || !patternDigits) return;
        
        const count = isEditMode ? validation.values.currentStock : validation.values.openingStockQty;
        const newSerials = [];
        
        for (let i = 0; i < count; i++) {
            const number = (patternStart + i).toString().padStart(parseInt(patternDigits), '0');
            newSerials.push(`${patternPrefix}${number}`);
        }
        
                    validation.setFieldValue('serialNumbers', newSerials);
        setShowPatternSuccess(true);
        setTimeout(() => setShowPatternSuccess(false), 3000);
    };

    const processBulkSerials = () => {
        if (!bulkSerialNumbers.trim()) return;
        
        const serials = bulkSerialNumbers
            .split(/[\n,]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        validation.setFieldValue('serialNumbers', serials);
        setBulkSerialNumbers('');
    };

    // Effect to sync serial numbers with stock quantity
    useEffect(() => {
        if (validation.values.isSerialized && validation.values.productType === 'product') {
            const expectedCount = isEditMode ? validation.values.currentStock : validation.values.openingStockQty;
            const currentCount = validation.values.serialNumbers.length;
            
            if (expectedCount > 0 && currentCount !== expectedCount) {
                const newSerials = [...validation.values.serialNumbers];
                
                if (currentCount < expectedCount) {
                    // Add empty serials
                    for (let i = currentCount; i < expectedCount; i++) {
                            newSerials.push('');
                        }
                        } else {
                    // Remove excess serials
                    newSerials.splice(expectedCount);
                }

                validation.setFieldValue('serialNumbers', newSerials);
            }
        }
    }, [validation.values.currentStock, validation.values.openingStockQty, validation.values.isSerialized, isEditMode]);

    // Stock reduction warning effect
    useEffect(() => {
        if (isEditMode && selectedProduct && validation.values.currentStock < selectedProduct.currentStock) {
            const reduction = selectedProduct.currentStock - validation.values.currentStock;
            setStockReductionWarning(`Warning: Reducing stock by ${reduction} units. This will affect inventory calculations.`);
        } else {
            setStockReductionWarning('');
        }
    }, [validation.values.currentStock, selectedProduct, isEditMode]);

    return (
        <Modal isOpen={isOpen} toggle={toggle} size="lg" className="product-form-modal">
            <ModalHeader toggle={toggle} className="pb-2">
                <div className="d-flex align-items-center">
                    <div className="avatar-xs rounded bg-primary-subtle d-flex align-items-center justify-content-center me-2">
                        <RiProductHuntLine className="text-primary" size={16} />
                    </div>
                    <div>
                        <h5 className="modal-title mb-0">
                            {isEditMode ? 'Edit Product' : 'Add New Product'}
                        </h5>
                        <p className="text-muted mb-0 small">
                            {isEditMode ? 'Update product information' : 'Create a new product'}
                        </p>
                    </div>
                </div>
            </ModalHeader>

                <Form onSubmit={validation.handleSubmit}>
                <ModalBody className="py-3">
                    {showSubmitError && (
                        <Alert color="danger" className="mb-3 py-2">
                            <small>There was an error submitting the form. Please check all fields and try again.</small>
                        </Alert>
                    )}

                    {/* Basic Information Section */}
                    <div className="form-section mb-3">
                        <h6 className="section-title mb-3">Basic Information</h6>
                        
                        <Row className="g-2">
                            <Col md={8}>
                                <FormGroup className="mb-2">
                                    <Label className="form-label-sm">Product Name <span className="text-danger">*</span></Label>
                                <Input
                                    type="text"
                                    name="name"
                                        placeholder="Enter product name"
                                    {...validation.getFieldProps('name')}
                                    invalid={validation.touched.name && !!validation.errors.name}
                                    disabled={isProcessing}
                                        className="form-control-sm"
                                />
                                <FormFeedback>{validation.errors.name}</FormFeedback>
                            </FormGroup>
                        </Col>
                            <Col md={4}>
                                <FormGroup className="mb-2">
                                    <Label className="form-label-sm">Type <span className="text-danger">*</span></Label>
                                <Input
                                    type="select"
                                    name="productType"
                                    {...validation.getFieldProps('productType')}
                                    invalid={validation.touched.productType && !!validation.errors.productType}
                                    disabled={isProcessing}
                                        className="form-control-sm"
                                >
                                    <option value="product">Product</option>
                                    <option value="service">Service</option>
                                </Input>
                                <FormFeedback>{validation.errors.productType}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                        <Row className="g-2">
                            <Col md={4}>
                                <FormGroup className="mb-2">
                                    <Label className="form-label-sm">Item Code <span className="text-danger">*</span></Label>
                                <Input
                                    type="text"
                                    name="itemCode"
                                        placeholder="Enter item code"
                                    {...validation.getFieldProps('itemCode')}
                                    invalid={validation.touched.itemCode && !!validation.errors.itemCode}
                                    disabled={isProcessing}
                                        className="form-control-sm"
                                />
                                <FormFeedback>{validation.errors.itemCode}</FormFeedback>
                            </FormGroup>
                        </Col>
                        {validation.values.productType === 'product' && (
                                <Col md={4}>
                                    <FormGroup className="mb-2">
                                        <Label className="form-label-sm">HSN Code <span className="text-danger">*</span></Label>
                                    <Input
                                        type="text"
                                        name="hsnCode"
                                            placeholder="Enter HSN code"
                                        {...validation.getFieldProps('hsnCode')}
                                        invalid={validation.touched.hsnCode && !!validation.errors.hsnCode}
                                        disabled={isProcessing}
                                            className="form-control-sm"
                                    />
                                    <FormFeedback>{validation.errors.hsnCode}</FormFeedback>
                                </FormGroup>
                            </Col>
                        )}
                            <Col md={4}>
                                <FormGroup className="mb-2">
                                    <Label className="form-label-sm">Rate <span className="text-danger">*</span></Label>
                                <Input
                                        type="number"
                                        name="rate"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        {...validation.getFieldProps('rate')}
                                        invalid={validation.touched.rate && !!validation.errors.rate}
                                    disabled={isProcessing}
                                        className="form-control-sm"
                                />
                                    <FormFeedback>{validation.errors.rate}</FormFeedback>
                            </FormGroup>
                        </Col>
                    </Row>

                        {/* Options Row */}
                        <div className="options-row mb-2">
                            <div className="d-flex flex-wrap gap-3">
                        {validation.values.productType === 'product' && (
                            <>
                                        <FormGroup check className="form-check-inline">
                                            <Input
                                                type="checkbox"
                                                id="isInventoryTracked"
                                                name="isInventoryTracked"
                                                checked={validation.values.isInventoryTracked}
                                                onChange={validation.handleChange}
                                                disabled={isProcessing}
                                                className="form-check-input-sm"
                                            />
                                            <Label check for="isInventoryTracked" className="form-check-label-sm">
                                                Inventory Tracked
                                        </Label>
                                    </FormGroup>
                                        <FormGroup check className="form-check-inline">
                                            <Input
                                                type="checkbox"
                                                id="isSerialized"
                                                name="isSerialized"
                                                checked={validation.values.isSerialized}
                                                onChange={validation.handleChange}
                                                disabled={isProcessing || !validation.values.isInventoryTracked}
                                                className="form-check-input-sm"
                                            />
                                            <Label check for="isSerialized" className="form-check-label-sm">
                                                Serialized
                                        </Label>
                                    </FormGroup>
                            </>
                        )}
                                <FormGroup check className="form-check-inline">
                                    <Input
                                        type="checkbox"
                                        id="isTaxInclusive"
                                        name="isTaxInclusive"
                                        checked={validation.values.isTaxInclusive}
                                        onChange={validation.handleChange}
                                        disabled={isProcessing}
                                        className="form-check-input-sm"
                                    />
                                    <Label check for="isTaxInclusive" className="form-check-label-sm">
                                        Tax Inclusive
                                </Label>
                            </FormGroup>
                            </div>
                        </div>
                    </div>

                    {/* Categories & Tax Section */}
                    {validation.values.productType === 'product' && (
                        <div className="form-section mb-3">
                            <h6 className="section-title mb-3">Categories & Tax</h6>
                            
                            <Row className="g-2">
                                <Col md={4}>
                                    <FormGroup className="mb-2">
                                        <Label className="form-label-sm">
                                            Unit of Measurement 
                                            {validation.values.isInventoryTracked && <span className="text-danger"> *</span>}
                                        </Label>
                                    <ReactSelect
                                        options={unitOptions}
                                        value={unitOptions.find(opt => opt.value === validation.values.unitOfMeasurementId)}
                                        onChange={(selectedOption) => {
                                                validation.setFieldValue('unitOfMeasurementId', selectedOption?.value || '');
                                            validation.setFieldTouched('unitOfMeasurementId', true);
                                        }}
                                            className="react-select-container-sm"
                                        classNamePrefix="react-select"
                                        placeholder="Select Unit"
                                        isClearable
                                        isDisabled={isProcessing}
                                            styles={{
                                                control: (provided) => ({
                                                    ...provided,
                                                    minHeight: '32px',
                                                    fontSize: '0.875rem'
                                                })
                                            }}
                                    />
                                    {validation.values.isInventoryTracked && validation.touched.unitOfMeasurementId && validation.errors.unitOfMeasurementId && (
                                            <div className="text-danger small mt-1">{validation.errors.unitOfMeasurementId}</div>
                                    )}
                                </FormGroup>
                            </Col>
                                <Col md={4}>
                                    <FormGroup className="mb-2">
                                        <Label className="form-label-sm">
                                            Stock Category 
                                            {validation.values.isInventoryTracked && <span className="text-danger"> *</span>}
                                        </Label>
                                        <div className="d-flex gap-1">
                                        <Input
                                            type="select"
                                            name="stockCategoryId"
                                            {...validation.getFieldProps('stockCategoryId')}
                                            invalid={validation.touched.stockCategoryId && !!validation.errors.stockCategoryId}
                                            disabled={isProcessing || categoriesLoading}
                                                className="form-control-sm"
                                            style={{ flex: 1 }}
                                        >
                                            <option value="">Select</option>
                                            {stockCategories.map(category => (
                                                <option key={category.id} value={category.id}>
                                                    {category.name}
                                                </option>
                                            ))}
                                        </Input>
                                            {onAddStockCategory && (
                                        <Button
                                                    type="button"
                                                    color="light"
                                            size="sm"
                                            onClick={onAddStockCategory}
                                                    disabled={isProcessing}
                                                    title="Add Stock Category"
                                                    className="btn-icon"
                                        >
                                                    <RiAddLine size={14} />
                                        </Button>
                                            )}
                                    </div>
                                        <FormFeedback>{validation.errors.stockCategoryId}</FormFeedback>
                                </FormGroup>
                            </Col>
                                <Col md={4}>
                                    <FormGroup className="mb-2">
                                        <Label className="form-label-sm">Tax Category</Label>
                                        <ReactSelect
                                            options={taxOptions}
                                            value={taxOptions.find(opt => opt.value === validation.values.taxCategoryId)}
                                            onChange={(selectedOption) => {
                                                validation.setFieldValue('taxCategoryId', selectedOption?.value || '');
                                                validation.setFieldTouched('taxCategoryId', true);
                                            }}
                                            className="react-select-container-sm"
                                            classNamePrefix="react-select"
                                            placeholder="Select Tax"
                                            isClearable
                                            isDisabled={isProcessing || taxCategoriesLoading}
                                            styles={{
                                                control: (provided) => ({
                                                    ...provided,
                                                    minHeight: '32px',
                                                    fontSize: '0.875rem'
                                                })
                                            }}
                                        />
                            </FormGroup>
                        </Col>
                    </Row>
                        </div>
                    )}

                    {/* Inventory Section */}
                    {validation.values.isInventoryTracked && validation.values.productType === 'product' && (
                        <div className="form-section mb-3">
                            <h6 className="section-title mb-3">Inventory Information</h6>
                            
                            {stockReductionWarning && (
                                <Alert color="warning" className="mb-2 py-2">
                                    <small>{stockReductionWarning}</small>
                                </Alert>
                            )}
                            
                            <Row className="g-2">
                                {!isEditMode ? (
                                    <>
                                        <Col md={6}>
                                            <FormGroup className="mb-2">
                                                <Label className="form-label-sm">Opening Stock Qty <span className="text-danger">*</span></Label>
                                    <Input
                                        type="number"
                                        name="openingStockQty"
                                                    placeholder="0"
                                        min="0"
                                                    step="1"
                                        {...validation.getFieldProps('openingStockQty')}
                                        invalid={validation.touched.openingStockQty && !!validation.errors.openingStockQty}
                                                    disabled={isProcessing}
                                                    className="form-control-sm"
                                    />
                                    <FormFeedback>{validation.errors.openingStockQty}</FormFeedback>
                                </FormGroup>
                            </Col>
                                        <Col md={6}>
                                            <FormGroup className="mb-2">
                                                <Label className="form-label-sm">Opening Cost Per Unit <span className="text-danger">*</span></Label>
                                    <Input
                                        type="number"
                                        name="openingStockCostPerQty"
                                                    placeholder="0.00"
                                        min="0"
                                                    step="0.01"
                                        {...validation.getFieldProps('openingStockCostPerQty')}
                                        invalid={validation.touched.openingStockCostPerQty && !!validation.errors.openingStockCostPerQty}
                                        disabled={isProcessing}
                                                    className="form-control-sm"
                                    />
                                    <FormFeedback>{validation.errors.openingStockCostPerQty}</FormFeedback>
                                </FormGroup>
                            </Col>
                                    </>
                                ) : (
                                    <Col md={6}>
                                        <FormGroup className="mb-2">
                                            <Label className="form-label-sm">Current Stock <span className="text-danger">*</span></Label>
                                        <Input
                                            type="number"
                                            name="currentStock"
                                                placeholder="0"
                                            min="0"
                                                step="1"
                                            {...validation.getFieldProps('currentStock')}
                                            invalid={validation.touched.currentStock && !!validation.errors.currentStock}
                                            disabled={isProcessing}
                                                className="form-control-sm"
                                        />
                                        <FormFeedback>{validation.errors.currentStock}</FormFeedback>
                                    </FormGroup>
                                </Col>
                            )}
                        </Row>
                            </div>
                    )}

                    {/* Serial Numbers Section */}
                    {validation.values.isSerialized && validation.values.productType === 'product' && (
                        <div className="form-section mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h6 className="section-title mb-0">Serial Numbers</h6>
                                <div className="d-flex gap-1">
                                    <Button
                                        type="button"
                                        color="light"
                                        size="sm"
                                        onClick={() => setSerialInputMethod(serialInputMethod === 'single' ? 'bulk' : 'single')}
                                        disabled={isProcessing}
                                        className="btn-sm-compact"
                                    >
                                        {serialInputMethod === 'single' ? 'Bulk' : 'Single'}
                                    </Button>
                                    <Button
                                        type="button"
                                        color="light"
                                        size="sm"
                                        onClick={() => setShowAllSerials(!showAllSerials)}
                                        disabled={isProcessing}
                                        className="btn-sm-compact"
                                    >
                                        {showAllSerials ? <RiEyeOffLine size={12} /> : <RiEyeLine size={12} />}
                                    </Button>
                                </div>
                                </div>

                                {serialInputMethod === 'bulk' && (
                                <Card className="mb-2">
                                    <CardBody className="p-2">
                                        <div className="mb-2">
                                            <Label className="form-label-sm">Bulk Serial Numbers</Label>
                                        <Input
                                            type="textarea"
                                                rows="2"
                                            value={bulkSerialNumbers}
                                            onChange={(e) => setBulkSerialNumbers(e.target.value)}
                                                placeholder="Enter serial numbers separated by new lines or commas"
                                            disabled={isProcessing}
                                                className="form-control-sm"
                                        />
                                            <Button
                                                type="button"
                                                color="primary"
                                                size="sm"
                                                onClick={processBulkSerials}
                                                disabled={isProcessing || !bulkSerialNumbers.trim()}
                                                className="mt-1 btn-sm-compact"
                                            >
                                                Process
                                            </Button>
                                        </div>

                                        <div className="border-top pt-2">
                                            <Label className="form-label-sm">Pattern Generator</Label>
                                            <Row className="g-1">
                                                <Col md={3}>
                                                    <Input
                                                        type="text"
                                                        placeholder="Prefix"
                                                        value={patternPrefix}
                                                        onChange={(e) => setPatternPrefix(e.target.value)}
                                                        disabled={isProcessing}
                                                        className="form-control-sm"
                                                    />
                                            </Col>
                                            <Col md={3}>
                                                    <Input
                                                        type="number"
                                                        placeholder="Start"
                                                        value={patternStart}
                                                        onChange={(e) => setPatternStart(parseInt(e.target.value) || 1)}
                                                        disabled={isProcessing}
                                                        className="form-control-sm"
                                                    />
                                            </Col>
                                            <Col md={3}>
                                                    <Input
                                                        type="number"
                                                        placeholder="Digits"
                                                        value={patternDigits}
                                                        onChange={(e) => setPatternDigits(e.target.value)}
                                                        disabled={isProcessing}
                                                        className="form-control-sm"
                                                    />
                                            </Col>
                                                <Col md={3}>
                                                <Button
                                                        type="button"
                                                        color="success"
                                                        size="sm"
                                                    onClick={generatePatternSerials}
                                                        disabled={isProcessing || !patternPrefix || !patternDigits}
                                                        className="w-100 btn-sm-compact"
                                                >
                                                    Generate
                                                </Button>
                                            </Col>
                                        </Row>
                                            {showPatternSuccess && (
                                                <div className="text-success small mt-1">Generated successfully!</div>
                                            )}
                                        </div>
                                    </CardBody>
                                </Card>
                                )}

                            {/* Serial Numbers List */}
                            <div className="serial-numbers-container">
                                {validation.values.serialNumbers.length > 0 && (
                                <div className="serial-numbers-list">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <small className="text-muted">
                                                Serial Numbers ({validation.values.serialNumbers.length})
                                            </small>
                                            {validation.values.serialNumbers.length > 1 && (
                                                <Badge color="light" className="badge-simple">
                                                    {showAllSerials ? 'All' : `First ${Math.min(5, validation.values.serialNumbers.length)}`}
                                                </Badge>
                                                )}
                                            </div>
                                        
                                        <div className="serial-inputs" style={{ maxHeight: showAllSerials ? '200px' : '120px', overflowY: 'auto' }}>
                                            {validation.values.serialNumbers
                                                .slice(0, showAllSerials ? undefined : 5)
                                                .map((serial, index) => (
                                                <div key={index} className="d-flex gap-1 mb-1">
                                                    <div className="serial-number-badge">
                                                        {index + 1}
                                                    </div>
                                                    <Input
                                                        type="text"
                                                        placeholder={`Serial ${index + 1}`}
                                                        value={serial}
                                                        onChange={(e) => updateSerialNumber(index, e.target.value)}
                                                        disabled={isProcessing}
                                                        className="form-control-sm"
                                                        style={{ flex: 1 }}
                                                    />
                                                    {validation.values.serialNumbers.length > 1 && (
                                                    <Button
                                                            type="button"
                                                            color="light"
                                                        size="sm"
                                                            onClick={() => removeSerialNumber(index)}
                                                            disabled={isProcessing}
                                                            className="btn-icon-sm"
                                                    >
                                                            <RiDeleteBinLine size={12} />
                                                    </Button>
                                                    )}
                                                </div>
                                            ))}
                                            </div>

                                        {!showAllSerials && validation.values.serialNumbers.length > 5 && (
                                            <div className="text-center mt-1">
                                                <small className="text-muted">
                                                    +{validation.values.serialNumbers.length - 5} more
                                                </small>
                                                        </div>
                                        )}

                                        <div className="mt-2">
                                                        <Button
                                                type="button"
                                                color="light"
                                                            size="sm"
                                                onClick={addSerialNumber}
                                                disabled={isProcessing}
                                                className="btn-sm-compact"
                                                        >
                                                <RiAddLine size={12} className="me-1" />
                                                Add Serial
                                                        </Button>
                                                    </div>
                                    </div>
                                    )}
                            </div>

                            {validation.touched.serialNumbers && validation.errors.serialNumbers && (
                                <div className="text-danger small mt-2">
                                    {validation.errors.serialNumbers}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Description Section */}
                    <div className="form-section">
                        <h6 className="section-title mb-3">Additional Information</h6>
                        
                        <Row className="g-2">
                            <Col md={6}>
                                <FormGroup className="mb-2">
                                    <Label className="form-label-sm">Description</Label>
                                    <Input
                                        type="textarea"
                                        name="description"
                                        rows="2"
                                        placeholder="Product description"
                                        {...validation.getFieldProps('description')}
                                        disabled={isProcessing}
                                        className="form-control-sm"
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup className="mb-2">
                                    <Label className="form-label-sm">Invoice Description</Label>
                                    <Input
                                        type="textarea"
                                        name="defaultInvoiceDescription"
                                        rows="2"
                                        placeholder="Default description for invoices"
                                        {...validation.getFieldProps('defaultInvoiceDescription')}
                                        disabled={isProcessing}
                                        className="form-control-sm"
                                    />
                                </FormGroup>
                            </Col>
                        </Row>
                    </div>
                </ModalBody>

                <ModalFooter className="py-2">
                    <Button 
                        color="light" 
                        onClick={toggle} 
                        disabled={isProcessing}
                        className="px-3"
                    >
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            type="submit"
                            disabled={isProcessing || !validation.isValid}
                        className="px-3"
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

            <style jsx>{`
                .product-form-modal .modal-content {
                    border-radius: 8px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                }

                .avatar-xs {
                    width: 1.75rem;
                    height: 1.75rem;
                }

                .bg-primary-subtle {
                    background-color: rgba(13, 110, 253, 0.1) !important;
                }

                .form-section {
                                    background: var(--vz-body-bg);
                border: 1px solid var(--vz-border-color);
                    border-radius: 6px;
                    padding: 0.75rem;
                }

                .section-title {
                    color: var(--vz-secondary-color);
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0;
                }

                .form-control-sm {
                    font-size: 0.875rem;
                    padding: 0.375rem 0.75rem;
                    height: 32px;
                }

                .form-label-sm {
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: var(--vz-secondary-color);
                    margin-bottom: 0.25rem;
                }

                .form-check-input-sm {
                    transform: scale(0.9);
                }

                .form-check-label-sm {
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .options-row {
                    background: var(--vz-light-bg-subtle);
                    border-radius: 6px;
                    padding: 0.5rem;
                    border: 1px solid var(--vz-border-color);
                }

                .react-select-container-sm .react-select__control {
                    min-height: 32px;
                    font-size: 0.875rem;
                }

                .btn-icon {
                    width: 32px;
                    height: 32px;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-icon-sm {
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-sm-compact {
                    font-size: 0.75rem;
                    padding: 0.25rem 0.5rem;
                    line-height: 1.2;
                }

                .serial-numbers-container {
                    background: var(--vz-light-bg-subtle);
                    border-radius: 6px;
                    padding: 0.5rem;
                    border: 1px solid var(--vz-border-color);
                }

                .serial-number-badge {
                    background: var(--vz-secondary-color);
                    color: white;
                    font-size: 0.7rem;
                    font-weight: 500;
                    width: 20px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    flex-shrink: 0;
                }

                .badge-simple {
                    background-color: var(--vz-light-bg-subtle);
                    color: var(--vz-secondary-color);
                    border: 1px solid var(--vz-border-color);
                    font-weight: 500;
                    font-size: 0.75rem;
                }

                .serial-inputs::-webkit-scrollbar {
                    width: 4px;
                }

                .serial-inputs::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 2px;
                }

                .serial-inputs::-webkit-scrollbar-thumb {
                    background: #c1c1c1;
                    border-radius: 2px;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Modal>
    );
};

export default ProductForm;
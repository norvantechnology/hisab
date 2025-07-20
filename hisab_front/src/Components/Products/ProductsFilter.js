import React from 'react';
import { Card, CardBody, Row, Col, FormGroup, Label, Input, Button } from 'reactstrap';
import { RiRefreshLine } from 'react-icons/ri';
import ReactSelect from 'react-select';

const ProductsFilter = ({
    categories,
    taxCategories,
    unitsOfMeasurement = [], // Default to empty array
    filters,
    onFilterChange
}) => {
    const getSelectedOption = (options, selectedId) => {
        if (!selectedId || !options?.length) return null;
        const option = options.find(o => String(o.id) === String(selectedId));
        if (!option) return null;

        return {
            value: option.id,
            label: option.name || option.label
        };
    };

    const itemTypeOptions = [
        { value: 'product', label: 'Product' },
        { value: 'service', label: 'Service' },
        { value: 'bundle', label: 'Bundle' }
    ];

    const handleFilterChange = (field, value) => {
        onFilterChange({
            ...filters,
            [field]: value
        });
    };

    const handleReset = () => {
        onFilterChange({
            stockCategoryId: '',
            itemType: '',
            taxCategoryId: '',
            unitOfMeasurement: '',
            itemCode: '',
            hsnCode: '',
            search: ''
        });
    };

    return (
        <Card className="mb-3">
            <CardBody className="p-3">
                {/* Mobile Layout */}
                <div className="d-block d-lg-none">
                    <Row className="g-3">
                        {/* Category Filter */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Stock Category</Label>
                                <ReactSelect
                                    options={categories?.map(category => ({
                                        value: category.id,
                                        label: category.name
                                    })) || []}
                                    value={getSelectedOption(categories, filters.stockCategoryId)}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('stockCategoryId', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Category"
                                    isClearable
                                    noOptionsMessage={() => "No categories found"}
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Item Type Filter */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Item Type</Label>
                                <ReactSelect
                                    options={itemTypeOptions}
                                    value={itemTypeOptions.find(opt => opt.value === filters.itemType)}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('itemType', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Type"
                                    isClearable
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Tax Category Filter */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Tax Category</Label>
                                <ReactSelect
                                    options={taxCategories?.map(tax => ({
                                        value: tax.id,
                                        label: tax.name
                                    })) || []}
                                    value={getSelectedOption(taxCategories, filters.taxCategoryId)}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('taxCategoryId', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Tax Category"
                                    isClearable
                                    noOptionsMessage={() => "No tax categories found"}
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Unit of Measurement Filter - Updated to ReactSelect */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Unit of Measurement</Label>
                                <ReactSelect
                                    options={unitsOfMeasurement?.map(unit => ({
                                        value: unit.id,  // Use id as value
                                        label: `${unit.name} (${unit.symbol})`  // Combine name and symbol for display
                                    })) || []}
                                    value={unitsOfMeasurement?.find(unit => unit.id === filters.unitOfMeasurement) ? {
                                        value: filters.unitOfMeasurement,
                                        label: `${unitsOfMeasurement.find(unit => unit.id === filters.unitOfMeasurement)?.name} (${unitsOfMeasurement.find(unit => unit.id === filters.unitOfMeasurement)?.symbol})`
                                    } : null}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('unitOfMeasurement', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Unit"
                                    isClearable
                                    noOptionsMessage={() => "No units found"}
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Item Code Filter */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Item Code</Label>
                                <Input
                                    type="text"
                                    placeholder="Search by item code"
                                    value={filters.itemCode}
                                    onChange={(e) => handleFilterChange('itemCode', e.target.value)}
                                />
                            </FormGroup>
                        </Col>

                        {/* HSN Code Filter */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">HSN Code</Label>
                                <Input
                                    type="text"
                                    placeholder="Search by HSN code"
                                    value={filters.hsnCode}
                                    onChange={(e) => handleFilterChange('hsnCode', e.target.value)}
                                />
                            </FormGroup>
                        </Col>

                        {/* Search Filter */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Search</Label>
                                <Input
                                    type="text"
                                    placeholder="Search by name"
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                />
                            </FormGroup>
                        </Col>

                        {/* Reset Button */}
                        <Col xs={12}>
                            <Button
                                color="light"
                                onClick={handleReset}
                                className="w-100"
                            >
                                <RiRefreshLine className="align-middle me-1" />
                                Reset Filters
                            </Button>
                        </Col>
                    </Row>
                </div>

                {/* Desktop Layout */}
                <div className="d-none d-lg-block">
                    <Row className="g-3 align-items-end">
                        {/* Category Filter */}
                        <Col lg={2}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Stock Category</Label>
                                <ReactSelect
                                    options={categories?.map(category => ({
                                        value: category.id,
                                        label: category.name
                                    })) || []}
                                    value={getSelectedOption(categories, filters.stockCategoryId)}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('stockCategoryId', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Category"
                                    isClearable
                                    noOptionsMessage={() => "No categories found"}
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Item Type Filter */}
                        <Col lg={2}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Item Type</Label>
                                <ReactSelect
                                    options={itemTypeOptions}
                                    value={itemTypeOptions.find(opt => opt.value === filters.itemType)}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('itemType', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Type"
                                    isClearable
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Tax Category Filter */}
                        <Col lg={2}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Tax Category</Label>
                                <ReactSelect
                                    options={taxCategories?.map(tax => ({
                                        value: tax.id,
                                        label: tax.name
                                    })) || []}
                                    value={getSelectedOption(taxCategories, filters.taxCategoryId)}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('taxCategoryId', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Tax"
                                    isClearable
                                    noOptionsMessage={() => "No tax categories found"}
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Unit of Measurement Filter - Updated to ReactSelect */}
                        <Col lg={2}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Unit of Measurement</Label>
                                <ReactSelect
                                    options={unitsOfMeasurement?.map(unit => ({
                                        value: unit.id,  // Use id as value
                                        label: `${unit.name} (${unit.symbol})`  // Combine name and symbol for display
                                    })) || []}
                                    value={unitsOfMeasurement?.find(unit => unit.id === filters.unitOfMeasurement) ? {
                                        value: filters.unitOfMeasurement,
                                        label: `${unitsOfMeasurement.find(unit => unit.id === filters.unitOfMeasurement)?.name} (${unitsOfMeasurement.find(unit => unit.id === filters.unitOfMeasurement)?.symbol})`
                                    } : null}
                                    onChange={(selectedOption) => {
                                        handleFilterChange('unitOfMeasurement', selectedOption?.value || '');
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Unit"
                                    isClearable
                                    noOptionsMessage={() => "No units found"}
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Item Code Filter */}
                        <Col lg={2}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Item Code</Label>
                                <Input
                                    type="text"
                                    placeholder="Item code"
                                    value={filters.itemCode}
                                    onChange={(e) => handleFilterChange('itemCode', e.target.value)}
                                />
                            </FormGroup>
                        </Col>

                        {/* HSN Code Filter */}
                        <Col lg={2}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">HSN Code</Label>
                                <Input
                                    type="text"
                                    placeholder="HSN code"
                                    value={filters.hsnCode}
                                    onChange={(e) => handleFilterChange('hsnCode', e.target.value)}
                                />
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row className="mt-2">
                        {/* Search Filter */}
                        <Col lg={10}>
                            <FormGroup className="mb-0">
                                <Input
                                    type="text"
                                    placeholder="Search products by name"
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                />
                            </FormGroup>
                        </Col>

                        {/* Reset Button */}
                        <Col lg={2}>
                            <Button
                                color="light"
                                onClick={handleReset}
                                className="w-100"
                            >
                                <RiRefreshLine className="align-middle me-1" />
                                Reset
                            </Button>
                        </Col>
                    </Row>
                </div>
            </CardBody>
        </Card>
    );
};

export default ProductsFilter;
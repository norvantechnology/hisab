import React from 'react';
import { Card, CardBody, Row, Col, FormGroup, Label, Input, Button } from 'reactstrap';
import { RiCalendarLine, RiAddLine, RiRefreshLine } from 'react-icons/ri';
import ReactSelect from 'react-select';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const ExpenseFilters = ({ categories, filters, onFilterChange, currentMonthRange, onAddCategory }) => {
    const getSelectedCategory = () => {
        if (!filters.categoryId || !categories.length) return null;
        const category = categories.find(c => String(c.id) === String(filters.categoryId));
        return category ? { value: category.id, label: category.name } : null;
    };

    const getSelectedStatus = () => {
        if (!filters.status) return null;
        const statusOptions = [
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' }
        ];
        const status = statusOptions.find(s => s.value === filters.status);
        return status || null;
    };

    const dateFilterOptions = [
        {
            label: 'This Month',
            value: 'current-month',
            action: () => {
                onFilterChange({
                    ...filters,
                    startDate: currentMonthRange.startDate,
                    endDate: currentMonthRange.endDate
                });
            }
        },
        {
            label: 'Last Month',
            value: 'last-month',
            action: () => {
                const date = new Date();
                date.setMonth(date.getMonth() - 1);
                const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
                const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

                onFilterChange({
                    ...filters,
                    startDate: firstDay.toISOString().split('T')[0],
                    endDate: lastDay.toISOString().split('T')[0]
                });
            }
        },
        {
            label: 'This Year',
            value: 'current-year',
            action: () => {
                const date = new Date();
                onFilterChange({
                    ...filters,
                    startDate: `${date.getFullYear()}-01-01`,
                    endDate: `${date.getFullYear()}-12-31`
                });
            }
        },
        {
            label: 'All Time',
            value: 'all-time',
            action: () => {
                onFilterChange({
                    ...filters,
                    startDate: '',
                    endDate: ''
                });
            }
        }
    ];

    return (
        <Card className="shadow-sm mb-4">
            <CardBody className="p-3">
                <Row className="g-3">
                    {/* Large screens - horizontal layout */}
                    <Col xs={12} className="d-none d-lg-block">
                        <Row className="align-items-end g-3">
                            {/* Category Filter */}
                            <Col lg={3}>
                                <FormGroup className="mb-0">
                                    <Label className="mb-2 fw-semibold">Category</Label>
                                    <ReactSelect
                                        options={[
                                            ...categories.map(category => ({
                                                value: category.id,
                                                label: category.name
                                            })),
                                            {
                                                value: 'add-new',
                                                label: 'Add New Category',
                                                isAddOption: true
                                            }
                                        ]}
                                        value={getSelectedCategory()}
                                        onChange={(selectedOption) => {
                                            if (selectedOption?.isAddOption) {
                                                onAddCategory();
                                            } else {
                                                onFilterChange({
                                                    ...filters,
                                                    categoryId: selectedOption?.value || ''
                                                });
                                            }
                                        }}
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                        placeholder="Select Category"
                                        isClearable
                                        noOptionsMessage={() => "No categories found"}
                                        formatOptionLabel={(option) => (
                                            option.isAddOption ? (
                                                <div className="text-primary">
                                                    <RiAddLine className="align-middle me-1" />
                                                    {option.label}
                                                </div>
                                            ) : option.label
                                        )}
                                        menuPlacement="auto"
                                    />
                                </FormGroup>
                            </Col>

                            {/* Status Filter */}
                            <Col lg={2}>
                                <FormGroup className="mb-0">
                                    <Label className="mb-2 fw-semibold">Status</Label>
                                    <ReactSelect
                                        options={[
                                            { value: 'pending', label: 'Pending' },
                                            { value: 'paid', label: 'Paid' }
                                        ]}
                                        value={getSelectedStatus()}
                                        onChange={(selectedOption) => {
                                            onFilterChange({
                                                ...filters,
                                                status: selectedOption?.value || ''
                                            });
                                        }}
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                        placeholder="All Status"
                                        isClearable
                                        menuPlacement="auto"
                                    />
                                </FormGroup>
                            </Col>

                            {/* Start Date */}
                            <Col lg={2}>
                                <FormGroup className="mb-0">
                                    <Label className="mb-2 fw-semibold">From Date</Label>
                                    <Input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => onFilterChange({
                                            ...filters,
                                            startDate: e.target.value
                                        })}
                                    />
                                </FormGroup>
                            </Col>

                            {/* End Date */}
                            <Col lg={2}>
                                <FormGroup className="mb-0">
                                    <Label className="mb-2 fw-semibold">To Date</Label>
                                    <Input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={(e) => onFilterChange({
                                            ...filters,
                                            endDate: e.target.value
                                        })}
                                    />
                                </FormGroup>
                            </Col>

                            {/* Quick Date Filters */}
                            <Col lg={2}>
                                <FormGroup className="mb-0">
                                    <Label className="mb-2 fw-semibold d-block">&nbsp;</Label>
                                    <UncontrolledDropdown>
                                        <DropdownToggle 
                                            caret 
                                            color="light" 
                                            className="w-100 d-flex align-items-center justify-content-between"
                                        >
                                            <div className="d-flex align-items-center">
                                                <RiCalendarLine className="align-middle me-2" />
                                                <span>Quick Filters</span>
                                            </div>
                                        </DropdownToggle>
                                        <DropdownMenu>
                                            {dateFilterOptions.map(option => (
                                                <DropdownItem
                                                    key={option.value}
                                                    onClick={option.action}
                                                    active={
                                                        (option.value === 'current-month' &&
                                                            filters.startDate === currentMonthRange.startDate &&
                                                            filters.endDate === currentMonthRange.endDate) ||
                                                        (option.value === 'all-time' &&
                                                            filters.startDate === '' && filters.endDate === '')
                                                    }
                                                >
                                                    {option.label}
                                                </DropdownItem>
                                            ))}
                                        </DropdownMenu>
                                    </UncontrolledDropdown>
                                </FormGroup>
                            </Col>

                            {/* Reset Button */}
                            <Col lg={1}>
                                <FormGroup className="mb-0">
                                    <Label className="mb-2 fw-semibold d-block">&nbsp;</Label>
                                    <Button
                                        color="light"
                                        onClick={() => onFilterChange({
                                            categoryId: '',
                                            status: '',
                                            startDate: currentMonthRange.startDate,
                                            endDate: currentMonthRange.endDate
                                        })}
                                        className="w-100"
                                        title="Reset Filters"
                                    >
                                        <RiRefreshLine size={16} />
                                    </Button>
                                </FormGroup>
                            </Col>
                        </Row>
                    </Col>

                    {/* Mobile/Tablet Layout - Stacked */}
                    <Col xs={12} className="d-lg-none">
                        {/* Category Filter - Full width on mobile */}
                        <Col xs={12}>
                            <FormGroup className="mb-3">
                                <Label className="mb-2 fw-semibold">Category</Label>
                                <ReactSelect
                                    options={[
                                        ...categories.map(category => ({
                                            value: category.id,
                                            label: category.name
                                        })),
                                        {
                                            value: 'add-new',
                                            label: 'Add New Category',
                                            isAddOption: true
                                        }
                                    ]}
                                    value={getSelectedCategory()}
                                    onChange={(selectedOption) => {
                                        if (selectedOption?.isAddOption) {
                                            onAddCategory();
                                        } else {
                                            onFilterChange({
                                                ...filters,
                                                categoryId: selectedOption?.value || ''
                                            });
                                        }
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select Category"
                                    isClearable
                                    noOptionsMessage={() => "No categories found"}
                                    formatOptionLabel={(option) => (
                                        option.isAddOption ? (
                                            <div className="text-primary">
                                                <RiAddLine className="align-middle me-1" />
                                                {option.label}
                                            </div>
                                        ) : option.label
                                    )}
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>

                        {/* Status Filter - Full width on mobile */}
                        <Col xs={12}>
                            <FormGroup className="mb-3">
                                <Label className="mb-2 fw-semibold">Status</Label>
                                <ReactSelect
                                    options={[
                                        { value: 'pending', label: 'Pending' },
                                        { value: 'paid', label: 'Paid' }
                                    ]}
                                    value={getSelectedStatus()}
                                    onChange={(selectedOption) => {
                                        onFilterChange({
                                            ...filters,
                                            status: selectedOption?.value || ''
                                        });
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="All Status"
                                    isClearable
                                    menuPlacement="auto"
                                />
                            </FormGroup>
                        </Col>
                        
                        {/* Date Range - Full width on mobile */}
                        <Col xs={12}>
                            <FormGroup className="mb-0">
                                <Label className="mb-2 fw-semibold">Date Range</Label>
                                
                                {/* Quick Filters - Full width */}
                                <div className="mb-2">
                                    <UncontrolledDropdown className="w-100">
                                        <DropdownToggle 
                                            caret 
                                            color="light" 
                                            className="w-100 text-start d-flex align-items-center justify-content-between"
                                        >
                                            <div className="d-flex align-items-center">
                                                <RiCalendarLine className="align-middle me-2" />
                                                <span>Quick Filters</span>
                                            </div>
                                        </DropdownToggle>
                                        <DropdownMenu className="w-100">
                                            {dateFilterOptions.map(option => (
                                                <DropdownItem
                                                    key={option.value}
                                                    onClick={option.action}
                                                    active={
                                                        (option.value === 'current-month' &&
                                                            filters.startDate === currentMonthRange.startDate &&
                                                            filters.endDate === currentMonthRange.endDate) ||
                                                        (option.value === 'last-month' &&
                                                            filters.startDate && filters.endDate &&
                                                            !(filters.startDate === currentMonthRange.startDate &&
                                                                filters.endDate === currentMonthRange.endDate) &&
                                                            !(filters.startDate === '' && filters.endDate === ''))
                                                    }
                                                >
                                                    {option.label}
                                                </DropdownItem>
                                            ))}
                                        </DropdownMenu>
                                    </UncontrolledDropdown>
                                </div>
                                
                                {/* Date Inputs and Reset - Stack on mobile */}
                                <Row className="g-2">
                                    <Col xs={5}>
                                        <Input
                                            type="date"
                                            value={filters.startDate}
                                            onChange={(e) => onFilterChange({
                                                ...filters,
                                                startDate: e.target.value
                                            })}
                                            className="w-100"
                                        />
                                    </Col>
                                    <Col xs={5}>
                                        <Input
                                            type="date"
                                            value={filters.endDate}
                                            onChange={(e) => onFilterChange({
                                                ...filters,
                                                endDate: e.target.value
                                            })}
                                            className="w-100"
                                        />
                                    </Col>
                                    <Col xs={2} className="d-flex align-items-center">
                                        <Button
                                            color="light"
                                            onClick={() => onFilterChange({
                                                categoryId: '',
                                                status: '',
                                                startDate: currentMonthRange.startDate,
                                                endDate: currentMonthRange.endDate
                                            })}
                                            className="w-100 p-2"
                                            title="Reset Filters"
                                        >
                                            <RiRefreshLine size={16} />
                                        </Button>
                                    </Col>
                                </Row>
                            </FormGroup>
                        </Col>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    );
};

export default ExpenseFilters;
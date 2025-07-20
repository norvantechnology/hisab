import React from 'react';
import { Card, CardBody, Row, Col, FormGroup, Label, Input, Button } from 'reactstrap';
import { RiCalendarLine, RiRefreshLine } from 'react-icons/ri';
import ReactSelect from 'react-select';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

const INVOICE_STATUS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
];

const PurchaseInvoiceFilter = ({
  filters,
  onFilterChange,
  currentMonthRange
}) => {
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
    <Card className="mb-3">
      <CardBody className="p-3">
        {/* Mobile Layout */}
        <div className="d-block d-lg-none">
          <Row className="g-3">
            {/* Invoice Status */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Invoice Status</Label>
                <ReactSelect
                  options={INVOICE_STATUS}
                  value={INVOICE_STATUS.find(opt => opt.value === filters.status)}
                  onChange={(selectedOption) => {
                    onFilterChange({
                      ...filters,
                      status: selectedOption?.value || ''
                    });
                  }}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select Invoice Status"
                  isClearable
                />
              </FormGroup>
            </Col>

            {/* Search */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Search</Label>
                <Input
                  type="text"
                  placeholder="Search by vendor name..."
                  value={filters.search}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    search: e.target.value
                  })}
                />
              </FormGroup>
            </Col>

            {/* Invoice Number */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Invoice Number</Label>
                <Input
                  type="text"
                  placeholder="Enter invoice number"
                  value={filters.invoiceNumber}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    invoiceNumber: e.target.value
                  })}
                />
              </FormGroup>
            </Col>

            {/* Date Range */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Date Range</Label>
                
                {/* Quick Filters */}
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

                {/* Date Inputs */}
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
                        ...filters,
                        startDate: currentMonthRange.startDate,
                        endDate: currentMonthRange.endDate
                      })}
                      className="w-100 p-2"
                      title="Reset Date"
                    >
                      <RiRefreshLine size={16} />
                    </Button>
                  </Col>
                </Row>
              </FormGroup>
            </Col>
          </Row>
        </div>

        {/* Desktop Layout */}
        <div className="d-none d-lg-block">
          <Row className="g-3 align-items-end">
            {/* Invoice Status */}
            <Col lg={2}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Invoice Status</Label>
                <ReactSelect
                  options={INVOICE_STATUS}
                  value={INVOICE_STATUS.find(opt => opt.value === filters.status)}
                  onChange={(selectedOption) => {
                    onFilterChange({
                      ...filters,
                      status: selectedOption?.value || ''
                    });
                  }}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select Status"
                  isClearable
                />
              </FormGroup>
            </Col>

            {/* Search */}
            <Col lg={2}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Search</Label>
                <Input
                  type="text"
                  placeholder="Search by vendor name..."
                  value={filters.search}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    search: e.target.value
                  })}
                />
              </FormGroup>
            </Col>

            {/* Invoice Number */}
            <Col lg={2}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Invoice Number</Label>
                <Input
                  type="text"
                  placeholder="Enter invoice number"
                  value={filters.invoiceNumber}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    invoiceNumber: e.target.value
                  })}
                />
              </FormGroup>
            </Col>

            {/* Date Range */}
            <Col lg={4}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Date Range</Label>
                <div className="d-flex gap-2">
                  {/* Quick Filters Dropdown */}
                  <UncontrolledDropdown style={{ minWidth: '140px' }}>
                    <DropdownToggle
                      caret
                      color="light"
                      className="text-start d-flex align-items-center justify-content-between w-100"
                    >
                      <div className="d-flex align-items-center">
                        <RiCalendarLine className="align-middle me-1" />
                        <span className="text-truncate">Quick Filters</span>
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

                  {/* Date Inputs */}
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => onFilterChange({
                      ...filters,
                      startDate: e.target.value
                    })}
                    style={{ minWidth: '140px' }}
                  />
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => onFilterChange({
                      ...filters,
                      endDate: e.target.value
                    })}
                    style={{ minWidth: '140px' }}
                  />

                  {/* Reset Button */}
                  <Button
                    color="light"
                    onClick={() => onFilterChange({
                      ...filters,
                      startDate: currentMonthRange.startDate,
                      endDate: currentMonthRange.endDate
                    })}
                    className="px-3"
                    title="Reset Date"
                  >
                    <RiRefreshLine size={16} />
                  </Button>
                </div>
              </FormGroup>
            </Col>
          </Row>
        </div>
      </CardBody>
    </Card>
  );
};

export default PurchaseInvoiceFilter;
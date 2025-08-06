import React from 'react';
import { Card, CardBody, Row, Col, FormGroup, Label, Input, Button } from 'reactstrap';
import { RiRefreshLine } from 'react-icons/ri';
import ReactSelect from 'react-select';

const BALANCE_TYPES = [
  { value: 'receivable', label: 'Receivable' },
  { value: 'payable', label: 'Payable' },
  { value: 'none', label: 'None' }
];

const CONTACT_TYPES = [
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'both', label: 'Both' }
];

const ContactsFilter = ({
  filters,
  onFilterChange
}) => {
  return (
    <Card className="mb-3">
      <CardBody className="p-3">
        {/* Mobile Layout */}
        <div className="d-block d-lg-none">
          <Row className="g-3">
            {/* Contact Type */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Contact Type</Label>
                <ReactSelect
                  options={CONTACT_TYPES}
                  value={CONTACT_TYPES.find(opt => opt.value === filters.contactType)}
                  onChange={(selectedOption) => {
                    onFilterChange({
                      ...filters,
                      contactType: selectedOption?.value || ''
                    });
                  }}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select Contact Type"
                  isClearable
                />
              </FormGroup>
            </Col>

            {/* Balance Type */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Balance Type</Label>
                <ReactSelect
                  options={BALANCE_TYPES}
                  value={BALANCE_TYPES.find(opt => opt.value === filters.balanceType)}
                  onChange={(selectedOption) => {
                    onFilterChange({
                      ...filters,
                      balanceType: selectedOption?.value || ''
                    });
                  }}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select Balance Type"
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
                  placeholder="Name, GSTIN, Mobile..."
                  value={filters.search}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    search: e.target.value
                  })}
                />
              </FormGroup>
            </Col>

            {/* Reset Button */}
            <Col xs={12}>
              <Button
                color="light"
                onClick={() => onFilterChange({
                  contactType: '',
                  balanceType: '',
                  search: ''
                })}
                className="w-100"
                title="Reset Filters"
              >
                <RiRefreshLine size={16} className="me-2" />
                Reset Filters
              </Button>
            </Col>
          </Row>
        </div>

        {/* Desktop Layout */}
        <div className="d-none d-lg-block">
          <Row className="g-3 align-items-end">
            {/* Contact Type */}
            <Col lg={3}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Contact Type</Label>
                <ReactSelect
                  options={CONTACT_TYPES}
                  value={CONTACT_TYPES.find(opt => opt.value === filters.contactType)}
                  onChange={(selectedOption) => {
                    onFilterChange({
                      ...filters,
                      contactType: selectedOption?.value || ''
                    });
                  }}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select Type"
                  isClearable
                />
              </FormGroup>
            </Col>

            {/* Balance Type */}
            <Col lg={3}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Balance Type</Label>
                <ReactSelect
                  options={BALANCE_TYPES}
                  value={BALANCE_TYPES.find(opt => opt.value === filters.balanceType)}
                  onChange={(selectedOption) => {
                    onFilterChange({
                      ...filters,
                      balanceType: selectedOption?.value || ''
                    });
                  }}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  placeholder="Select Balance"
                  isClearable
                />
              </FormGroup>
            </Col>

            {/* Search */}
            <Col lg={4}>
              <FormGroup className="mb-0">
                <Label className="mb-2 fw-semibold">Search</Label>
                <Input
                  type="text"
                  placeholder="Name, GSTIN, Mobile..."
                  value={filters.search}
                  onChange={(e) => onFilterChange({
                    ...filters,
                    search: e.target.value
                  })}
                />
              </FormGroup>
            </Col>

            {/* Reset Button */}
            <Col lg={2}>
              <Button
                color="light"
                onClick={() => onFilterChange({
                  contactType: '',
                  balanceType: '',
                  search: ''
                })}
                className="w-100"
                title="Reset Filters"
              >
                <RiRefreshLine size={16} className="me-2" />
                Reset
              </Button>
            </Col>
          </Row>
        </div>
      </CardBody>
    </Card>
  );
};

export default ContactsFilter;
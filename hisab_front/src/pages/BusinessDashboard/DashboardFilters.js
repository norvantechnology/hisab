import React, { useState, useEffect } from 'react';
import { Row, Col, Card, CardBody, CardHeader, Button, Label, Input } from 'reactstrap';
import { RiFilterLine, RiCloseLine } from 'react-icons/ri';

const DashboardFilters = ({ onFiltersChange, currentFilters, onRefresh }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        startDate: currentFilters?.startDate || '',
        endDate: currentFilters?.endDate || '',
        status: currentFilters?.status || 'all'
    });

    // Sync local state with parent filters
    useEffect(() => {
        if (currentFilters) {
            setFilters({
                startDate: currentFilters.startDate || '',
                endDate: currentFilters.endDate || '',
                status: currentFilters.status || 'all'
            });
        }
    }, [currentFilters]);

    const handleFilterChange = (field, value) => {
        const updatedFilters = { ...filters, [field]: value };
        setFilters(updatedFilters);
    };

    const applyFilters = () => {
        // Remove empty filters
        const cleanFilters = Object.entries(filters).reduce((acc, [key, value]) => {
            if (value && value !== 'all' && value !== '') {
                acc[key] = value;
            }
            return acc;
        }, {});

        console.log('🔍 DashboardFilters: Applying filters:', cleanFilters);
        onFiltersChange(cleanFilters);
    };

    const clearFilters = () => {
        const emptyFilters = {
            startDate: '',
            endDate: '',
            status: 'all'
        };
        console.log('🔍 DashboardFilters: Clearing filters');
        setFilters(emptyFilters);
        onFiltersChange({});
    };

    const setQuickDateFilter = (days) => {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        const updatedFilters = { 
            ...filters, 
            startDate: startDateStr, 
            endDate: endDate 
        };
        
        console.log(`🔍 DashboardFilters: Setting quick date filter (${days} days):`, updatedFilters);
        setFilters(updatedFilters);
        
        // Auto-apply the quick date filter
        const cleanFilters = Object.entries(updatedFilters).reduce((acc, [key, value]) => {
            if (value && value !== 'all' && value !== '') {
                acc[key] = value;
            }
            return acc;
        }, {});
        
        onFiltersChange(cleanFilters);
    };

    return (
        <Card className="mb-3">
            <CardHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                        <RiFilterLine className="me-2 text-primary" />
                        <h6 className="mb-0">Dashboard Filters</h6>
                    </div>
                    <div className="d-flex gap-2">
                        <Button 
                            color="secondary" 
                            size="sm" 
                            outline 
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            {showFilters ? 'Hide' : 'Show'} Filters
                        </Button>
                        <Button color="primary" size="sm" onClick={onRefresh}>
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            
            {showFilters && (
                <CardBody>
                    {/* Quick Date Filters */}
                    <Row className="mb-3">
                        <Col xl={12}>
                            <Label className="form-label fw-semibold text-muted">Quick Date Filters</Label>
                            <div className="d-flex flex-wrap gap-2">
                                <Button color="info" size="sm" outline onClick={() => setQuickDateFilter(7)}>
                                    Last 7 Days
                                </Button>
                                <Button color="info" size="sm" outline onClick={() => setQuickDateFilter(30)}>
                                    Last 30 Days
                                </Button>
                                <Button color="info" size="sm" outline onClick={() => setQuickDateFilter(90)}>
                                    Last 3 Months
                                </Button>
                                <Button color="info" size="sm" outline onClick={() => setQuickDateFilter(365)}>
                                    This Year
                                </Button>
                            </div>
                        </Col>
                    </Row>

                    {/* Custom Date Range */}
                    <Row className="mb-3">
                        <Col md={4}>
                            <Label className="form-label">Start Date</Label>
                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            />
                        </Col>
                        <Col md={4}>
                            <Label className="form-label">End Date</Label>
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                min={filters.startDate}
                            />
                        </Col>
                        <Col md={4}>
                            <Label className="form-label">Status</Label>
                            <Input
                                type="select"
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                            </Input>
                        </Col>
                    </Row>

                    {/* Filter Actions */}
                    <Row>
                        <Col xl={12}>
                            <div className="d-flex gap-2">
                                <Button color="primary" onClick={applyFilters}>
                                    <RiFilterLine className="me-1" /> Apply Filters
                                </Button>
                                <Button color="secondary" outline onClick={clearFilters}>
                                    <RiCloseLine className="me-1" /> Clear All
                                </Button>
                            </div>
                        </Col>
                    </Row>

                    {/* Active Filters Display */}
                    {Object.entries(filters).some(([key, value]) => value && value !== 'all' && value !== '') && (
                        <Row className="mt-3">
                            <Col xl={12}>
                                <div className="d-flex align-items-center flex-wrap gap-2">
                                    <span className="text-muted fw-semibold me-2">Active Filters:</span>
                                    {Object.entries(filters).map(([key, value]) => {
                                        if (!value || value === 'all' || value === '') return null;
                                        
                                        let displayValue = value;
                                        if (key === 'startDate' || key === 'endDate') {
                                            displayValue = new Date(value).toLocaleDateString();
                                        }

                                        return (
                                            <span 
                                                key={key} 
                                                className="badge bg-primary-subtle text-primary border border-primary-subtle"
                                            >
                                                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}: {displayValue}
                                            </span>
                                        );
                                    })}
                                </div>
                            </Col>
                        </Row>
                    )}
                </CardBody>
            )}
        </Card>
    );
};

export default DashboardFilters;

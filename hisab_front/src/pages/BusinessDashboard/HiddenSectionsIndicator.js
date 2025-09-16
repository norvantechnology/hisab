import React from 'react';
import { Alert, Button, Badge } from 'reactstrap';

const HiddenSectionsIndicator = ({ 
    preferences, 
    onShowSection, 
    onShowAllSections,
    hasHiddenSections 
}) => {
    if (!hasHiddenSections) {
        return null;
    }

    const hiddenSections = [];
    
    // Check main sections
    if (!preferences.showFinancialSummary) hiddenSections.push({ key: 'showFinancialSummary', label: 'Financial Summary', icon: 'ri-money-dollar-circle-line' });
    if (!preferences.showCharts) hiddenSections.push({ key: 'showCharts', label: 'Analytics Charts', icon: 'ri-bar-chart-line' });
    if (!preferences.showInsights) hiddenSections.push({ key: 'showInsights', label: 'Business Insights', icon: 'ri-lightbulb-line' });
    if (!preferences.showActivities) hiddenSections.push({ key: 'showActivities', label: 'Recent Activities', icon: 'ri-time-line' });
    if (!preferences.showBusinessOverview) hiddenSections.push({ key: 'showBusinessOverview', label: 'Business Overview', icon: 'ri-dashboard-line' });
    if (!preferences.showOutstandingPayments) hiddenSections.push({ key: 'showOutstandingPayments', label: 'Outstanding Payments', icon: 'ri-alert-line' });

    // Check chart types
    const hiddenCharts = [];
    if (preferences.showCharts) {
        Object.entries(preferences.chartTypes).forEach(([key, visible]) => {
            if (!visible) {
                const chartLabels = {
                    revenueTrend: 'Revenue Trend',
                    cashFlow: 'Cash Flow',
                    paymentStatus: 'Payment Status',
                    topProducts: 'Top Products',
                    monthlySales: 'Monthly Sales',
                    businessGrowth: 'Business Growth'
                };
                hiddenCharts.push({ key, label: chartLabels[key], type: 'chart' });
            }
        });
    }

    const totalHidden = hiddenSections.length + hiddenCharts.length;

    if (totalHidden === 0) {
        return null;
    }

    return (
        <Alert color="info" className="mb-4">
            <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                    <i className="ri-eye-off-line me-2"></i>
                    <div>
                        <h6 className="alert-heading mb-1">
                            {totalHidden} Dashboard Section{totalHidden > 1 ? 's' : ''} Hidden
                        </h6>
                        <div className="d-flex flex-wrap gap-1">
                            {hiddenSections.map((section) => (
                                <Badge 
                                    key={section.key} 
                                    color="primary" 
                                    className="badge-soft cursor-pointer"
                                    onClick={() => onShowSection(section.key, true)}
                                    title={`Click to show ${section.label}`}
                                >
                                    <i className={`${section.icon} me-1`}></i>
                                    {section.label}
                                </Badge>
                            ))}
                            {hiddenCharts.map((chart) => (
                                <Badge 
                                    key={chart.key} 
                                    color="secondary" 
                                    className="badge-soft cursor-pointer"
                                    onClick={() => onShowSection(`chartTypes.${chart.key}`, true)}
                                    title={`Click to show ${chart.label} chart`}
                                >
                                    <i className="ri-bar-chart-line me-1"></i>
                                    {chart.label}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="d-flex gap-2">
                    <Button color="info" size="sm" onClick={onShowAllSections}>
                        <i className="ri-eye-line me-1"></i>
                        Show All
                    </Button>
                </div>
            </div>
        </Alert>
    );
};

export default HiddenSectionsIndicator; 
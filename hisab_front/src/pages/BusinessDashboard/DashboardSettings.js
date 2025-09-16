import React from 'react';
import { Row, Col, Button, Badge } from 'reactstrap';

const DashboardSettings = ({ 
    preferences, 
    onPreferenceChange, 
    onResetPreferences,
    hasHiddenSections 
}) => {

    const toggleSection = (section) => {
        onPreferenceChange(section, !preferences[section]);
    };

    const showAllSections = () => {
        onPreferenceChange('showFinancialSummary', true);
        onPreferenceChange('showCharts', true);
        onPreferenceChange('showInsights', true);
        onPreferenceChange('showActivities', true);
        onPreferenceChange('showBusinessOverview', true);
        onPreferenceChange('showOutstandingPayments', true);
    };

    const hideAllOptional = () => {
        onPreferenceChange('showCharts', false);
        onPreferenceChange('showInsights', false);
        onPreferenceChange('showActivities', false);
        onPreferenceChange('showBusinessOverview', false);
    };

    return (
        <div>
            <div className="mb-4">
                <h5 className="fw-semibold mb-3">
                    <i className="ri-layout-line me-2"></i>
                    Dashboard Sections
                </h5>
                
                <Row>
                    <Col md={6} className="mb-3">
                        <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                            <div className="d-flex align-items-center">
                                <i className="ri-money-dollar-circle-line me-3 text-primary fs-18"></i>
                                <span className="fw-medium">Financial Summary</span>
                            </div>
                            <Button 
                                color={preferences.showFinancialSummary ? "success" : "outline-secondary"}
                                size="sm"
                                onClick={() => toggleSection('showFinancialSummary')}
                            >
                                {preferences.showFinancialSummary ? 'Visible' : 'Hidden'}
                            </Button>
                        </div>
                    </Col>

                    <Col md={6} className="mb-3">
                        <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                            <div className="d-flex align-items-center">
                                <i className="ri-bar-chart-line me-3 text-info fs-18"></i>
                                <span className="fw-medium">Analytics Charts</span>
                            </div>
                            <Button 
                                color={preferences.showCharts ? "success" : "outline-secondary"}
                                size="sm"
                                onClick={() => toggleSection('showCharts')}
                            >
                                {preferences.showCharts ? 'Visible' : 'Hidden'}
                            </Button>
                        </div>
                    </Col>

                    <Col md={6} className="mb-3">
                        <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                            <div className="d-flex align-items-center">
                                <i className="ri-lightbulb-line me-3 text-warning fs-18"></i>
                                <span className="fw-medium">Business Insights</span>
                            </div>
                            <Button 
                                color={preferences.showInsights ? "success" : "outline-secondary"}
                                size="sm"
                                onClick={() => toggleSection('showInsights')}
                            >
                                {preferences.showInsights ? 'Visible' : 'Hidden'}
                            </Button>
                        </div>
                    </Col>

                    <Col md={6} className="mb-3">
                        <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                            <div className="d-flex align-items-center">
                                <i className="ri-time-line me-3 text-secondary fs-18"></i>
                                <span className="fw-medium">Recent Activities</span>
                            </div>
                            <Button 
                                color={preferences.showActivities ? "success" : "outline-secondary"}
                                size="sm"
                                onClick={() => toggleSection('showActivities')}
                            >
                                {preferences.showActivities ? 'Visible' : 'Hidden'}
                            </Button>
                        </div>
                    </Col>

                    <Col md={6} className="mb-3">
                        <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                            <div className="d-flex align-items-center">
                                <i className="ri-dashboard-line me-3 text-success fs-18"></i>
                                <span className="fw-medium">Business Overview</span>
                            </div>
                            <Button 
                                color={preferences.showBusinessOverview ? "success" : "outline-secondary"}
                                size="sm"
                                onClick={() => toggleSection('showBusinessOverview')}
                            >
                                {preferences.showBusinessOverview ? 'Visible' : 'Hidden'}
                            </Button>
                        </div>
                    </Col>

                    <Col md={6} className="mb-3">
                        <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                            <div className="d-flex align-items-center">
                                <i className="ri-alert-line me-3 text-danger fs-18"></i>
                                <span className="fw-medium">Outstanding Payments</span>
                            </div>
                            <Button 
                                color={preferences.showOutstandingPayments ? "success" : "outline-secondary"}
                                size="sm"
                                onClick={() => toggleSection('showOutstandingPayments')}
                            >
                                {preferences.showOutstandingPayments ? 'Visible' : 'Hidden'}
                            </Button>
                        </div>
                    </Col>
                </Row>
            </div>

            <div className="mb-4">
                <h5 className="fw-semibold mb-3">
                    <i className="ri-settings-line me-2"></i>
                    Quick Actions
                </h5>
                
                <div className="d-flex gap-2 flex-wrap">
                    <Button 
                        color="success" 
                        onClick={showAllSections}
                    >
                        <i className="ri-eye-line me-1"></i>
                        Show All Sections
                    </Button>
                    <Button 
                        color="secondary" 
                        onClick={hideAllOptional}
                    >
                        <i className="ri-eye-off-line me-1"></i>
                        Minimal View
                    </Button>
                    <Button 
                        color="info" 
                        onClick={() => {
                            onPreferenceChange('showFinancialSummary', true);
                            onPreferenceChange('showCharts', true);
                            onPreferenceChange('showInsights', false);
                            onPreferenceChange('showActivities', false);
                            onPreferenceChange('showBusinessOverview', false);
                            onPreferenceChange('showOutstandingPayments', true);
                        }}
                    >
                        <i className="ri-bar-chart-line me-1"></i>
                        Analytics Focus
                    </Button>
                    <Button 
                        color="warning" 
                        onClick={onResetPreferences}
                    >
                        <i className="ri-restart-line me-1"></i>
                        Reset to Default
                    </Button>
                </div>
            </div>

            {hasHiddenSections && (
                <div className="alert alert-info">
                    <div className="d-flex align-items-center">
                        <i className="ri-information-line me-2"></i>
                        <div>
                            <strong>Note:</strong> You have hidden some dashboard sections. 
                            Use the controls above to show them again or click "Show All Sections".
                        </div>
                    </div>
                </div>
            )}

            {preferences.lastUpdated && (
                <div className="text-center mt-4 pt-3 border-top">
                    <small className="text-muted">
                        <i className="ri-time-line me-1"></i>
                        Settings last updated: {new Date(preferences.lastUpdated).toLocaleString()}
                    </small>
                </div>
            )}
        </div>
    );
};

export default DashboardSettings; 
import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Card, CardBody, Badge, Table } from 'reactstrap';
import { toast } from 'react-toastify';
import { getContactSummary, getContactFinancialSummary, getContactProfile, getDashboardFinancialSummary } from '../../services/portal';
import Loader from '../../Components/Common/Loader';

const PortalDashboard = ({ contactData, tabKey }) => {
    const [state, setState] = useState({
        summary: null,
        financialSummary: null,
        dashboardSummary: null,
        profileData: null,
        loading: true
    });

    const { summary, financialSummary, dashboardSummary, profileData, loading } = state;

    const fetchDashboardData = async () => {
        if (!contactData?.id) return;

        setState(prev => ({ ...prev, loading: true }));
        try {
            const [financialData, summaryData, dashboardData, profileResponse] = await Promise.all([
                getContactFinancialSummary(contactData.id),
                getContactSummary(contactData.id),
                getDashboardFinancialSummary(contactData.id),
                getContactProfile(contactData.id)
            ]);
            
            console.log('Dashboard API Response:', dashboardData);
            console.log('Financial API Response:', financialData);
            
            setState(prev => ({
                ...prev,
                financialSummary: financialData.success ? financialData : null,
                summary: summaryData.success ? summaryData.summary : null,
                dashboardSummary: dashboardData.success ? dashboardData : null,
                profileData: profileResponse.success ? profileResponse : null,
                loading: false
            }));
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast.error('Failed to load dashboard data. Please try again.');
            setState(prev => ({ ...prev, loading: false }));
        }
    };

  useEffect(() => {
    if (contactData?.id) {
      fetchDashboardData();
    }
    }, [contactData?.id, tabKey]);

    const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    if (loading) {
        return <Loader />;
    }

    return (
        <React.Fragment>
            {/* Summary Cards */}
            <Row className="mb-4">
                {[
                    {
                        title: 'Total Received',
                        value: formatCurrency(dashboardSummary?.totalReceived || 0),
                        icon: 'ri-check-line',
                        color: 'success'
                    },
                    {
                        title: 'Pending Receivable',
                        value: formatCurrency(dashboardSummary?.pendingReceivable || 0),
                        icon: 'ri-time-line',
                        color: 'warning'
                    },
                    {
                        title: 'You Owe',
                        value: formatCurrency(dashboardSummary?.youOwe || 0),
                        icon: 'ri-bank-line',
                        color: 'danger'
                    },
                    {
                        title: 'Net Position',
                        value: formatCurrency(dashboardSummary?.netPosition || 0),
                        icon: 'ri-user-line',
                        color: 'info'
                    }
                ].map((card, index) => {
                    console.log(`Card ${index + 1} (${card.title}):`, card.value);
                    return (
                        <Col xl={3} md={6} key={index}>
                            <Card className="card-animate">
                                <CardBody>
                                    <div className="d-flex align-items-center">
                                        <div className="flex-shrink-0 me-3">
                                            <div className={`avatar-md bg-${card.color}-subtle text-${card.color} rounded-2 d-flex align-items-center justify-content-center`}>
                                                <i className={card.icon}></i>
                                            </div>
                                        </div>
                                        <div className="flex-grow-1">
                                            <h6 className="mb-1">{card.title}</h6>
                                            <h4 className="mb-0">{card.value}</h4>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </React.Fragment>
    );
};

export default PortalDashboard; 
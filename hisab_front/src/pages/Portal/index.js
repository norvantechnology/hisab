import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, CardBody, Button } from 'reactstrap';
import { toast, ToastContainer } from 'react-toastify';
import { RiDownload2Line, RiAddLine } from 'react-icons/ri';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import Loader from '../../Components/Common/Loader';
import PortalLogin from './PortalLogin';

// Lazy load components for better performance
const PortalDashboard = React.lazy(() => import('./PortalDashboard'));
const PortalTransactions = React.lazy(() => import('./PortalTransactions'));

const Portal = () => {
    const [state, setState] = useState({
        contactData: null,
        loading: true,
        isAuthenticated: false,
        activeTab: 'dashboard',
        loadedTabs: new Set(['dashboard']),
        tabKey: 0
    });

    const { contactData, loading, isAuthenticated, activeTab, loadedTabs, tabKey } = state;

    // Initialize contact data and check authentication
    useEffect(() => {
        const portalToken = localStorage.getItem('portalToken');
        
        if (!portalToken) {
            setState(prev => ({ 
                ...prev, 
                isAuthenticated: false, 
                loading: false 
            }));
            return;
        }

        try {
            const tokenData = JSON.parse(atob(portalToken.split('.')[1]));
            setState(prev => ({
                ...prev,
                contactData: {
                    id: tokenData.id,
                    name: tokenData.name || 'Customer',
                    email: tokenData.email || ''
                },
                isAuthenticated: true,
                loading: false
            }));
        } catch (error) {
            console.error('Error parsing portal token:', error);
            localStorage.removeItem('portalToken');
            localStorage.removeItem('portalContact');
            setState(prev => ({ 
                ...prev, 
                isAuthenticated: false, 
                loading: false 
            }));
        }
    }, []);

    const handleTabChange = (tab) => {
        setState(prev => ({
            ...prev,
            activeTab: tab,
            loadedTabs: new Set([...prev.loadedTabs, tab]),
            tabKey: prev.tabKey + 1
        }));
    };

    const handleLogout = () => {
        localStorage.removeItem('portalToken');
        localStorage.removeItem('portalContact');
        window.location.href = '/portal/login';
    };

    if (loading) {
        return <Loader />;
    }

    if (!isAuthenticated) {
        return <PortalLogin />;
    }

    return (
        <div className="page-content">
            <ToastContainer closeButton={false} position="top-right" />
            <Container fluid>
                <BreadCrumb title="Customer Portal" pageTitle="Portal" />

                {/* Header with user info */}
                <Row className="mb-3">
                    <Col sm={12}>
                        <Card className="shadow-sm">
                            <CardBody>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="d-flex align-items-center">
                                        <div className="avatar-sm me-3">
                                            <div className="avatar-title bg-primary text-white rounded-circle">
                                                <i className="ri-user-line"></i>
                                            </div>
                                        </div>
                                        <div>
                                            <h5 className="mb-1">Welcome, {contactData?.name || 'Customer'}!</h5>
                                            <p className="text-muted mb-0">Customer Portal Dashboard</p>
                                        </div>
                                    </div>
                                    
                                    <div className="d-flex align-items-center gap-2">
                                        <Button color="light" outline onClick={handleLogout}>
                                            <i className="ri-logout-box-r-line me-1"></i>
                                            Logout
                                        </Button>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>

                {/* Navigation Tabs */}
                <Row className="mb-3">
                    <Col sm={12}>
                        <div className="d-flex justify-content-center">
                            <div className="btn-group" role="group">
                                <Button 
                                    color={activeTab === 'dashboard' ? 'primary' : 'light'} 
                                    onClick={() => handleTabChange('dashboard')}
                                >
                                    <i className="ri-bar-chart-line me-1"></i>
                                    Dashboard
                                </Button>
                                <Button 
                                    color={activeTab === 'transactions' ? 'primary' : 'light'} 
                                    onClick={() => handleTabChange('transactions')}
                                >
                                    <i className="ri-file-list-line me-1"></i>
                                    Transactions
                                </Button>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* Tab Content */}
                <Row>
                    <Col xs={12}>
                        <React.Suspense fallback={<Loader />}>
                            {activeTab === 'dashboard' && loadedTabs.has('dashboard') && (
                                <PortalDashboard 
                                    key={`dashboard-${tabKey}`} 
                                    contactData={contactData} 
                                    tabKey={tabKey} 
                                />
                            )}
                            {activeTab === 'transactions' && loadedTabs.has('transactions') && (
                                <PortalTransactions 
                                    key={`transactions-${tabKey}`} 
                                    contactData={contactData} 
                                    type="all" 
                                    tabKey={tabKey} 
                                />
                            )}
                        </React.Suspense>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Portal; 
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAllCompanies } from '../../services/company';

const CompanyProtected = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [hasCompanies, setHasCompanies] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkCompanies = async () => {
        try {
            const response = await getAllCompanies();
            if (response?.success) {
                const hasCompaniesNow = response.companies && response.companies.length > 0;
                setHasCompanies(hasCompaniesNow);
                
                // If no companies exist and we're not already on welcome page, redirect to welcome page
                if (!hasCompaniesNow && location.pathname !== '/welcome') {
                    navigate('/welcome');
                    return;
                }
            } else {
                setHasCompanies(false);
                if (location.pathname !== '/welcome') {
                    navigate('/welcome');
                }
            }
        } catch (error) {
            console.error('Error checking companies:', error);
            setHasCompanies(false);
            if (location.pathname !== '/welcome') {
                navigate('/welcome');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkCompanies();
    }, [location.pathname]);

    // If we're on the welcome page, don't show loading
    if (location.pathname === '/welcome') {
        return children;
    }

    // Show loading while checking companies
    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    // If companies exist, show children
    if (hasCompanies) {
        return children;
    }

    // If no companies exist, show loading (will redirect to welcome page)
    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        </div>
    );
};

export default CompanyProtected; 
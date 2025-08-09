import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAllCompanies } from '../../services/company';

const CompanyProtected = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [hasCompanies, setHasCompanies] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const checkCompanies = async () => {
        setError(null); // Clear any previous errors
        try {
            const response = await getAllCompanies();
            if (response?.success) {
                const hasCompaniesNow = response.companies && response.companies.length > 0;
                setHasCompanies(hasCompaniesNow);
                
                // ONLY redirect to welcome if API succeeds but returns no companies
                if (!hasCompaniesNow && location.pathname !== '/welcome') {
                    navigate('/welcome');
                    return;
                }
            } else {
                // API call succeeded but returned error response - don't redirect, show error
                const errorMsg = response?.message || 'Failed to fetch companies';
                console.error('Failed to fetch companies:', errorMsg);
                setError(errorMsg);
                setHasCompanies(false);
                // Don't redirect on API errors - user might have network issues
            }
        } catch (err) {
            // Network error, server down, etc. - don't redirect, show error
            const errorMsg = err.message || 'Network error. Please check your connection.';
            console.error('Error checking companies:', err);
            setError(errorMsg);
            setHasCompanies(false);
            // Don't redirect on network/server errors - user should be able to retry
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

    // Show error message with retry option if API failed
    if (error) {
        return (
            <div className="d-flex justify-content-center align-items-center flex-column" style={{ height: '100vh' }}>
                <div className="text-center">
                    <h5 className="text-danger mb-3">Error Loading Companies</h5>
                    <p className="text-muted mb-4">{error}</p>
                    <button 
                        className="btn btn-primary"
                        onClick={() => {
                            setLoading(true);
                            checkCompanies();
                        }}
                    >
                        Try Again
                    </button>
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
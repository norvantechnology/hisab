import { apiCall } from '../utils/apiCall';

// Get comprehensive business analytics with filters
export const getBusinessAnalytics = (filters = {}) => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/analytics',
        params: filters
    });
};

// Get quick stats for the dashboard
export const getQuickStats = () => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/quick-stats'
    });
};

// Get cash flow analytics with optional period
export const getCashFlowAnalytics = (period = '6months') => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/cash-flow',
        params: { period }
    });
};

// Get product performance analytics
export const getProductPerformance = (period = '3months') => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/product-performance',
        params: { period }
    });
};

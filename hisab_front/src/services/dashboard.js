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

// Export dashboard data
export const exportDashboardData = (format = 'csv', filters = {}) => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/export',
        params: { format, ...filters }
    });
};

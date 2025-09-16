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

// Get comprehensive chart data
export const getChartData = (period = '6months', filters = {}) => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/charts',
        params: { period, ...filters }
    });
};

// Get revenue chart data
export const getRevenueChartData = () => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/charts/revenue'
    });
};

// Get cash flow chart data
export const getCashFlowChartData = () => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/charts/cashflow'
    });
};

// Get payment status chart data
export const getPaymentStatusChartData = () => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/charts/payment-status'
    });
};

// Get monthly trends data
export const getMonthlyTrendsData = () => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/charts/monthly-trends'
    });
};

// Get dashboard insights and recommendations
export const getDashboardInsights = () => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/insights'
    });
};

// Get recent activities
export const getRecentActivities = () => {
    return apiCall({
        method: 'get',
        endpoint: '/dashboard/activities'
    });
};

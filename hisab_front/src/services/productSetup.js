import { apiCall } from '../utils/apiCall';

export const listStockCategories = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/stockCategory/listStockCategories',
        params,
    });
};

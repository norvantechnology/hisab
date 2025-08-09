import { apiCall } from '../utils/apiCall';

export const listStockCategories = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/stockCategory/listStockCategories',
        params,
    });
};

export const createStockCategory = async (categoryName) => {
    return apiCall({
        method: 'post',
        endpoint: '/stockCategory/createStockCategory',
        data: { name: categoryName },
    });
};

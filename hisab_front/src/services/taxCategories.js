import { apiCall } from '../utils/apiCall';

export const getTaxCategory = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/taxCategory/getTaxCategory',
        params
    });
};

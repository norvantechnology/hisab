import { apiCall } from '../utils/apiCall';

export const listPurchases = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/purchase/listPurchases',
        params,
    });
};
export const createPurchase = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/purchase/createPurchase',
        data,
    });
};
export const updatePurchases = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/purchase/updatePurchases',
        data,
    });
};
export const deletePurchase = async (params) => {
    return apiCall({
        method: 'delete',
        endpoint: '/purchase/deletePurchase',
        params,
    });
};
export const getPurchase = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/purchase/getPurchase',
        params,
    });
};

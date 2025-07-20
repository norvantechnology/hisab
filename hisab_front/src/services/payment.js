import { apiCall } from '../utils/apiCall';

export const createPayment = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/payment/createPayment',
        data
    });
};

export const listPayments = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/payment/listPayments',
        params
    });
};

export const getPendingTransactions = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/payment/getPendingTransactions',
        params
    });
};

export const deletePayment = async (id) => {
    return apiCall({
        method: 'delete',
        endpoint: '/payment/deletePayment',
        params: { id }
    });
};
export const updatePayment = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/payment/updatePayment',
        data
    });
};
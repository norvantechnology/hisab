import { apiCall } from '../utils/apiCall';

export const listSales = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/sales/listSales',
        params,
    });
};

export const createSale = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/sales/createSale',
        data,
    });
};

export const updateSales = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/sales/updateSale',
        data,
    });
};

export const deleteSale = async (params) => {
    return apiCall({
        method: 'delete',
        endpoint: '/sales/deleteSale',
        params,
    });
};

export const getSale = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/sales/getSale',
        params,
    });
}; 

export const getNextInvoiceNumber = async () => {
    return apiCall({
        method: 'get',
        endpoint: '/sales/getNextInvoiceNumber',
    });
}; 
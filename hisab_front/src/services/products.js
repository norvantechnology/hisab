import { apiCall } from '../utils/apiCall';

export const createProduct = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/product/createProduct',
        data,
    });
};

export const listProducts = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/product/listProducts',
        params,
    });
};

export const bulkImportProducts = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/product/bulkImportProducts',
        data,
    });
};

export const getProduct = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/product/getProduct',
        params
    });
};

export const updateProduct = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/product/updateProduct',
        data
    });
};

export const deleteProduct = async (params) => {
    return apiCall({
        method: 'delete',
        endpoint: '/product/deleteProduct',
        params
    });
};
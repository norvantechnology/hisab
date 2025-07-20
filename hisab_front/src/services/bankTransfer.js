import { apiCall } from '../utils/apiCall';

export const listBankTransfers = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/bankTransfer/listBankTransfers',
        params
    });
};

export const createBankTransfer = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/bankTransfer/createBankTransfer',
        data
    });
};

export const deleteBankTransfer = async (id) => {
    return apiCall({
        method: 'delete',
        endpoint: '/bankTransfer/deleteBankTransfer',
        params: { id }
    });
};

export const updateBankTransfer = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/bankTransfer/updateBankTransfer',
        data
    });
};
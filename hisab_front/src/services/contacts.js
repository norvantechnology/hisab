import { apiCall } from '../utils/apiCall';

export const getContacts = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/contact/getContacts',
        params
    });
};

export const createContact = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/contact/createContact',
        data
    });
};

export const deleteContact = async (id) => {
    return apiCall({
        method: 'delete',
        endpoint: '/contact/deleteContact',
        params: { id }
    });
};
export const updateContact = async (data) => {
    return apiCall({
        method: 'put',
        endpoint: '/contact/updateContact',
        data
    });
};
import { apiCall } from '../utils/apiCall';

export const getTemplates = async (moduleType) => {
    return apiCall({
        method: 'get',
        endpoint: '/templates',
        params: { moduleType }
    });
};

export const setUserDefaultTemplate = async (data) => {
    return apiCall({
        method: 'post',
        endpoint: '/templates/preferences',
        data
    });
}; 
import { apiCall } from '../utils/apiCall';

export const getUnitOfMeasurements = async (params) => {
    return apiCall({
        method: 'get',
        endpoint: '/unitOfMeasurements/getUnitOfMeasurements',
        params
    });
};

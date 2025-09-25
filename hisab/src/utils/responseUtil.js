export const successResponse = (res, data) => {
    return res.status(200).json({
        success: true,
        ...data
    });
};


export const errorResponse = (res, message, statusCode = 400, additionalData = {}) => {
    return res.status(statusCode).json({
        success: false,
        message,
        ...additionalData
    });
};


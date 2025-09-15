// Authentication utilities for handling remember me functionality

/**
 * Get authentication token from storage
 * Checks localStorage first (for remember me), then sessionStorage
 */
export const getAuthToken = () => {
    // Check localStorage first (remember me)
    let token = localStorage.getItem('authToken');
    let isRemembered = localStorage.getItem('rememberMe') === 'true';
    

    
    // If remember me was used, check if token is still valid
    if (isRemembered && token) {
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        if (tokenExpiry && new Date() > new Date(tokenExpiry)) {

            // Token expired, clear localStorage
            clearRememberMeData();
            token = null;
        } else {

        }
    }
    
    // If no valid token in localStorage, check sessionStorage
    if (!token) {
        token = sessionStorage.getItem('authToken');

    }
    

    return token;
};

/**
 * Get user data from storage
 * Checks localStorage first (for remember me), then sessionStorage
 */
export const getUserData = () => {
    let userData = localStorage.getItem('userData') || sessionStorage.getItem('userData');
    
    if (userData) {
        try {
            return JSON.parse(userData);
        } catch (e) {
            return null;
        }
    }
    
    return null;
};

/**
 * Set authentication data based on remember me preference
 */
export const setAuthData = (token, user, rememberMe = false) => {

    
    const storage = rememberMe ? localStorage : sessionStorage;
    
    storage.setItem('authToken', token);
    storage.setItem('userData', JSON.stringify(user));
    

    
    if (rememberMe) {
        const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('tokenExpiry', expiryDate.toISOString());

    } else {
        clearRememberMeData();
    }
    

};

/**
 * Clear remember me data from localStorage
 */
export const clearRememberMeData = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('tokenExpiry');
};

/**
 * Clear all authentication data
 */
export const clearAllAuthData = () => {
    // Clear sessionStorage
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('authUser'); // legacy
    sessionStorage.removeItem('selectedCompanyId'); // Clear company selection
    
    // Clear localStorage (remember me data)
    clearRememberMeData();
    localStorage.removeItem('selectedCompanyId'); // Clear company selection from localStorage too
};

/**
 * Check if user is remembered (has valid remember me token)
 */
export const isUserRemembered = () => {
    const isRemembered = localStorage.getItem('rememberMe') === 'true';
    const token = localStorage.getItem('authToken');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    
    if (isRemembered && token && tokenExpiry) {
        return new Date() <= new Date(tokenExpiry);
    }
    
    return false;
};

/**
 * Check if user is authenticated (has valid token in any storage)
 */
export const isAuthenticated = () => {
    const token = getAuthToken();
    const userData = getUserData();
    
    return !!(token && userData);
};

/**
 * Get remaining days for remember me token
 */
export const getRememberMeRemainingDays = () => {
    if (!isUserRemembered()) {
        return 0;
    }
    
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (tokenExpiry) {
        const expiryDate = new Date(tokenExpiry);
        const now = new Date();
        const diffTime = expiryDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }
    
    return 0;
}; 
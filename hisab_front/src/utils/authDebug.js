// Authentication Debug Utilities

import { getAuthToken, getUserData, isUserRemembered, getRememberMeRemainingDays } from './authUtils';

/**
 * Debug authentication state
 */
export const debugAuthState = () => {
    console.log('=== AUTH DEBUG STATE ===');
    
    // Check sessionStorage
    const sessionToken = sessionStorage.getItem('authToken');
    const sessionUserData = sessionStorage.getItem('userData');
    console.log('SessionStorage:', { 
        hasToken: !!sessionToken, 
        hasUserData: !!sessionUserData,
        token: sessionToken ? `${sessionToken.substring(0, 20)}...` : null
    });
    
    // Check localStorage (remember me)
    const localToken = localStorage.getItem('authToken');
    const localUserData = localStorage.getItem('userData');
    const rememberMe = localStorage.getItem('rememberMe');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    console.log('LocalStorage:', { 
        hasToken: !!localToken, 
        hasUserData: !!localUserData,
        rememberMe,
        tokenExpiry,
        token: localToken ? `${localToken.substring(0, 20)}...` : null
    });
    
    // Check utility functions
    const utilToken = getAuthToken();
    const utilUserData = getUserData();
    const isRemembered = isUserRemembered();
    const remainingDays = getRememberMeRemainingDays();
    
    console.log('Utility Results:', {
        hasToken: !!utilToken,
        hasUserData: !!utilUserData,
        isRemembered,
        remainingDays,
        token: utilToken ? `${utilToken.substring(0, 20)}...` : null
    });
    
    console.log('=== END AUTH DEBUG ===');
    
    return {
        sessionStorage: { hasToken: !!sessionToken, hasUserData: !!sessionUserData },
        localStorage: { hasToken: !!localToken, hasUserData: !!localUserData, rememberMe, tokenExpiry },
        utils: { hasToken: !!utilToken, hasUserData: !!utilUserData, isRemembered, remainingDays }
    };
};

/**
 * Test remember me functionality
 */
export const testRememberMe = () => {
    console.log('=== TESTING REMEMBER ME ===');
    
    const testToken = 'test-token-12345';
    const testUser = { id: 1, name: 'Test User', email: 'test@test.com' };
    
    // Test setting remember me data
    console.log('Setting test remember me data...');
    const storage = localStorage;
    storage.setItem('authToken', testToken);
    storage.setItem('userData', JSON.stringify(testUser));
    storage.setItem('rememberMe', 'true');
    storage.setItem('tokenExpiry', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    
    // Test retrieving
    const retrievedToken = getAuthToken();
    const retrievedUserData = getUserData();
    const isRemembered = isUserRemembered();
    
    console.log('Test Results:', {
        tokenMatch: retrievedToken === testToken,
        userDataMatch: JSON.stringify(retrievedUserData) === JSON.stringify(testUser),
        isRemembered
    });
    
    // Cleanup test data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('tokenExpiry');
    
    console.log('=== END REMEMBER ME TEST ===');
};

/**
 * Clear all debug data and reset auth state
 */
export const clearDebugAuth = () => {
    sessionStorage.clear();
    localStorage.clear();
    console.log('All auth data cleared for debugging');
}; 
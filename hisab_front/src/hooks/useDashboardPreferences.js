import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'business_dashboard_preferences';

const defaultPreferences = {
    showCharts: true,
    showInsights: true,
    showActivities: true,
    showFinancialSummary: true,
    showBusinessOverview: true,
    showOutstandingPayments: true,
    period: '6months',
    chartTypes: {
        revenueTrend: true,
        cashFlow: true,
        paymentStatus: true,
        topProducts: true,
        monthlySales: true,
        businessGrowth: true
    },
    layout: {
        compactMode: false,
        sidebarLayout: false
    },
    filters: {},
    lastUpdated: null
};

const useDashboardPreferences = () => {
    const [preferences, setPreferences] = useState(defaultPreferences);
    const [isLoading, setIsLoading] = useState(true);

    // Load preferences from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsedPreferences = JSON.parse(stored);
                // Merge with defaults to handle new preferences
                setPreferences(prev => ({
                    ...defaultPreferences,
                    ...parsedPreferences,
                    chartTypes: {
                        ...defaultPreferences.chartTypes,
                        ...parsedPreferences.chartTypes
                    },
                    layout: {
                        ...defaultPreferences.layout,
                        ...parsedPreferences.layout
                    }
                }));
            }
        } catch (error) {
            console.warn('Failed to load dashboard preferences:', error);
            setPreferences(defaultPreferences);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Save preferences to localStorage
    const savePreferences = useCallback((newPreferences) => {
        try {
            const preferencesToSave = {
                ...newPreferences,
                lastUpdated: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferencesToSave));
            setPreferences(preferencesToSave);
        } catch (error) {
            console.error('Failed to save dashboard preferences:', error);
        }
    }, []);

    // Update a specific preference
    const updatePreference = useCallback((key, value) => {
        const newPreferences = { ...preferences, [key]: value };
        savePreferences(newPreferences);
    }, [preferences, savePreferences]);

    // Update nested preferences (like chartTypes)
    const updateNestedPreference = useCallback((parentKey, childKey, value) => {
        const newPreferences = {
            ...preferences,
            [parentKey]: {
                ...preferences[parentKey],
                [childKey]: value
            }
        };
        savePreferences(newPreferences);
    }, [preferences, savePreferences]);

    // Toggle a boolean preference
    const togglePreference = useCallback((key) => {
        updatePreference(key, !preferences[key]);
    }, [preferences, updatePreference]);

    // Toggle nested boolean preference
    const toggleNestedPreference = useCallback((parentKey, childKey) => {
        updateNestedPreference(parentKey, childKey, !preferences[parentKey][childKey]);
    }, [preferences, updateNestedPreference]);

    // Reset to defaults
    const resetPreferences = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            setPreferences(defaultPreferences);
        } catch (error) {
            console.error('Failed to reset dashboard preferences:', error);
        }
    }, []);

    // Bulk update preferences
    const updatePreferences = useCallback((updates) => {
        const newPreferences = { ...preferences, ...updates };
        savePreferences(newPreferences);
    }, [preferences, savePreferences]);

    // Get preference value with fallback
    const getPreference = useCallback((key, fallback = null) => {
        return preferences[key] !== undefined ? preferences[key] : fallback;
    }, [preferences]);

    // Check if any data sections are hidden
    const hasHiddenSections = useCallback(() => {
        return !preferences.showCharts || 
               !preferences.showInsights || 
               !preferences.showActivities || 
               !preferences.showFinancialSummary || 
               !preferences.showBusinessOverview || 
               !preferences.showOutstandingPayments;
    }, [preferences]);

    return {
        preferences,
        isLoading,
        updatePreference,
        updateNestedPreference,
        togglePreference,
        toggleNestedPreference,
        resetPreferences,
        updatePreferences,
        getPreference,
        hasHiddenSections,
        // Convenience methods for common operations
        toggleCharts: () => togglePreference('showCharts'),
        toggleInsights: () => togglePreference('showInsights'),
        toggleActivities: () => togglePreference('showActivities'),
        setPeriod: (period) => updatePreference('period', period),
        setFilters: (filters) => updatePreference('filters', filters),
        toggleChart: (chartType) => toggleNestedPreference('chartTypes', chartType),
        setCompactMode: (compact) => updateNestedPreference('layout', 'compactMode', compact)
    };
};

export default useDashboardPreferences; 
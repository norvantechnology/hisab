import { useState, useEffect, useCallback, useRef } from 'react';
import { apiCall } from '../../utils/apiCall';

// Debounce utility
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Custom hook for optimized API calls
export const useOptimizedApi = (apiFunction, dependencies = [], options = {}) => {
  const {
    immediate = true,
    debounceMs = 300,
    retryCount = 3,
    retryDelay = 1000
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  const abortControllerRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Debounced dependencies
  const debouncedDependencies = useDebounce(dependencies, debounceMs);

  // Memoized API call function
  const fetchData = useCallback(async (retryAttempt = 0) => {
    if (!apiFunction) return;

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction({
        signal: abortControllerRef.current.signal
      });

      setData(result);
      setLastFetchTime(Date.now());
      setLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }

      setError(err);
      setLoading(false);

      // Retry logic
      if (retryAttempt < retryCount) {
        retryTimeoutRef.current = setTimeout(() => {
          fetchData(retryAttempt + 1);
        }, retryDelay * (retryAttempt + 1));
      }
    }
  }, [apiFunction, retryCount, retryDelay]);

  // Effect to trigger API call when dependencies change
  useEffect(() => {
    if (immediate && debouncedDependencies.length > 0) {
      fetchData();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [debouncedDependencies, immediate, fetchData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastFetchTime,
    refresh
  };
};

// Hook for paginated data with infinite scroll support
export const usePaginatedApi = (apiFunction, pageSize = 10, options = {}) => {
  const {
    immediate = true,
    debounceMs = 300
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  const abortControllerRef = useRef(null);

  const fetchPage = useCallback(async (page = 1, append = false) => {
    if (!apiFunction) return;

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction({
        page,
        limit: pageSize,
        signal: abortControllerRef.current.signal
      });

      if (result.success) {
        const newData = result.data || result.items || [];
        
        if (append) {
          setData(prev => [...prev, ...newData]);
        } else {
          setData(newData);
        }

        setCurrentPage(page);
        setTotalPages(result.pagination?.totalPages || 0);
        setTotalRecords(result.pagination?.total || 0);
        setHasMore(page < (result.pagination?.totalPages || 0));
      } else {
        setError(new Error(result.message || 'Failed to fetch data'));
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [apiFunction, pageSize]);

  // Load next page for infinite scroll
  const loadNextPage = useCallback(() => {
    if (!loading && hasMore) {
      fetchPage(currentPage + 1, true);
    }
  }, [loading, hasMore, currentPage, fetchPage]);

  // Reset to first page
  const reset = useCallback(() => {
    setData([]);
    setCurrentPage(1);
    setHasMore(true);
    fetchPage(1, false);
  }, [fetchPage]);

  return {
    data,
    loading,
    error,
    hasMore,
    currentPage,
    totalPages,
    totalRecords,
    loadNextPage,
    reset,
    refresh: () => fetchPage(currentPage, false)
  };
};

// Hook for search with debouncing
export const useSearchApi = (apiFunction, options = {}) => {
  const {
    debounceMs = 500,
    minSearchLength = 2
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  // Fetch search results
  useEffect(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < minSearchLength) {
      setResults([]);
      return;
    }

    if (!apiFunction) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const fetchResults = async () => {
      try {
        const result = await apiFunction({
          search: debouncedSearchTerm,
          signal: abortControllerRef.current.signal
        });

        if (result.success) {
          setResults(result.data || result.items || []);
        } else {
          setError(new Error(result.message || 'Search failed'));
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedSearchTerm, apiFunction, minSearchLength]);

  return {
    searchTerm,
    setSearchTerm,
    results,
    loading,
    error
  };
}; 
// Performance monitoring utility
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: new Map(),
      renderTimes: new Map(),
      memoryUsage: [],
      errors: []
    };
    
    this.isEnabled = process.env.NODE_ENV === 'development';
    this.startTime = Date.now();
  }

  // Track API call performance
  trackApiCall(endpoint, method, startTime, endTime, success, error = null) {
    if (!this.isEnabled) return;

    const duration = endTime - startTime;
    const key = `${method}:${endpoint}`;
    
    if (!this.metrics.apiCalls.has(key)) {
      this.metrics.apiCalls.set(key, {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        successCount: 0,
        errorCount: 0,
        errors: []
      });
    }

    const metric = this.metrics.apiCalls.get(key);
    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);

    if (success) {
      metric.successCount++;
    } else {
      metric.errorCount++;
      if (error) {
        metric.errors.push({
          timestamp: new Date().toISOString(),
          error: error.message || error
        });
      }
    }
  }

  // Track component render performance
  trackRenderTime(componentName, renderTime) {
    if (!this.isEnabled) return;

    if (!this.metrics.renderTimes.has(componentName)) {
      this.metrics.renderTimes.set(componentName, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0
      });
    }

    const metric = this.metrics.renderTimes.get(componentName);
    metric.count++;
    metric.totalTime += renderTime;
    metric.avgTime = metric.totalTime / metric.count;
    metric.minTime = Math.min(metric.minTime, renderTime);
    metric.maxTime = Math.max(metric.maxTime, renderTime);
  }

  // Track memory usage
  trackMemoryUsage() {
    if (!this.isEnabled || !performance.memory) return;

    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    });

    // Keep only last 100 entries
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift();
    }
  }

  // Track errors
  trackError(error, context = '') {
    if (!this.isEnabled) return;

    this.metrics.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message || error,
      stack: error.stack,
      context
    });
  }

  // Get performance report
  getReport() {
    if (!this.isEnabled) return null;

    const report = {
      uptime: Date.now() - this.startTime,
      apiCalls: {},
      renderTimes: {},
      memoryUsage: this.getMemoryStats(),
      errors: this.metrics.errors.length,
      topSlowestApis: [],
      topSlowestComponents: []
    };

    // API calls summary
    for (const [key, metric] of this.metrics.apiCalls) {
      report.apiCalls[key] = {
        count: metric.count,
        avgDuration: Math.round(metric.avgDuration),
        minDuration: Math.round(metric.minDuration),
        maxDuration: Math.round(metric.maxDuration),
        successRate: Math.round((metric.successCount / metric.count) * 100),
        errorCount: metric.errorCount
      };
    }

    // Render times summary
    for (const [key, metric] of this.metrics.renderTimes) {
      report.renderTimes[key] = {
        count: metric.count,
        avgTime: Math.round(metric.avgTime),
        minTime: Math.round(metric.minTime),
        maxTime: Math.round(metric.maxTime)
      };
    }

    // Top slowest APIs
    const apiEntries = Array.from(this.metrics.apiCalls.entries());
    report.topSlowestApis = apiEntries
      .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
      .slice(0, 5)
      .map(([key, metric]) => ({
        endpoint: key,
        avgDuration: Math.round(metric.avgDuration),
        count: metric.count
      }));

    // Top slowest components
    const renderEntries = Array.from(this.metrics.renderTimes.entries());
    report.topSlowestComponents = renderEntries
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 5)
      .map(([key, metric]) => ({
        component: key,
        avgTime: Math.round(metric.avgTime),
        count: metric.count
      }));

    return report;
  }

  // Get memory statistics
  getMemoryStats() {
    if (!this.metrics.memoryUsage.length) return null;

    const latest = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    const avgUsed = this.metrics.memoryUsage.reduce((sum, entry) => sum + entry.usedJSHeapSize, 0) / this.metrics.memoryUsage.length;

    return {
      current: {
        used: Math.round(latest.usedJSHeapSize / 1024 / 1024),
        total: Math.round(latest.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(latest.jsHeapSizeLimit / 1024 / 1024)
      },
      average: {
        used: Math.round(avgUsed / 1024 / 1024)
      }
    };
  }

  // Clear metrics
  clear() {
    this.metrics.apiCalls.clear();
    this.metrics.renderTimes.clear();
    this.metrics.memoryUsage = [];
    this.metrics.errors = [];
    this.startTime = Date.now();
  }

  // Enable/disable monitoring
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  // Log report to console
  logReport() {
    if (!this.isEnabled) return;

    const report = this.getReport();
    console.group('🚀 Performance Report');
    console.log('Uptime:', Math.round(report.uptime / 1000), 'seconds');
    console.log('API Calls:', Object.keys(report.apiCalls).length);
    console.log('Components Tracked:', Object.keys(report.renderTimes).length);
    console.log('Errors:', report.errors);
    
    if (report.topSlowestApis.length > 0) {
      console.group('🐌 Slowest APIs');
      report.topSlowestApis.forEach(api => {
        console.log(`${api.endpoint}: ${api.avgDuration}ms (${api.count} calls)`);
      });
      console.groupEnd();
    }

    if (report.topSlowestComponents.length > 0) {
      console.group('🐌 Slowest Components');
      report.topSlowestComponents.forEach(comp => {
        console.log(`${comp.component}: ${comp.avgTime}ms (${comp.count} renders)`);
      });
      console.groupEnd();
    }

    if (report.memoryUsage) {
      console.group('💾 Memory Usage');
      console.log('Current Used:', report.memoryUsage.current.used, 'MB');
      console.log('Current Total:', report.memoryUsage.current.total, 'MB');
      console.log('Average Used:', report.memoryUsage.average.used, 'MB');
      console.groupEnd();
    }

    console.groupEnd();
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Auto-track memory usage every 30 seconds
if (performanceMonitor.isEnabled) {
  setInterval(() => {
    performanceMonitor.trackMemoryUsage();
  }, 30000);
}

export default performanceMonitor;

// Higher-order component for performance tracking
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  return function PerformanceTrackedComponent(props) {
    const startTime = performance.now();
    
    const result = <WrappedComponent {...props} />;
    
    const endTime = performance.now();
    performanceMonitor.trackRenderTime(componentName, endTime - startTime);
    
    return result;
  };
};

// Hook for performance tracking
export const usePerformanceTracking = (componentName) => {
  const startTime = performance.now();
  
  useEffect(() => {
    const endTime = performance.now();
    performanceMonitor.trackRenderTime(componentName, endTime - startTime);
  });
}; 
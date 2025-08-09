module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Find the source-map-loader rule
      const sourceMapLoaderRule = webpackConfig.module.rules.find(
        rule => rule.enforce === 'pre' && rule.use && rule.use.length && rule.use[0].loader && rule.use[0].loader.includes('source-map-loader')
      );
      
      if (sourceMapLoaderRule) {
        // Exclude node_modules from source-map-loader to avoid warnings
        sourceMapLoaderRule.exclude = /node_modules/;
      }
      
      // Alternative: Disable all source map warnings
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /source-map-loader/
      ];
      
      return webpackConfig;
    }
  }
}; 
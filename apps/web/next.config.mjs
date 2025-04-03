/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add webpack configuration for resolving shared package
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add alias for packages/shared
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": "../../packages/shared/src",
    };

    // Fix Supabase webpack issues by ensuring chunking works correctly
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: "commons",
            chunks: "all",
            minChunks: 2,
          },
          // This configures better handling of the supabase dependency
          supabase: {
            test: /[\\/]node_modules[\\/](@supabase|supabase-js)[\\/]/,
            name: "supabase-vendors",
            chunks: "all",
          },
        },
      };
    }

    return config;
  },
  // External packages configuration
  serverExternalPackages: ["@langchain/community", "@langchain/core"],
  // Output standalone build
  output: "standalone",

  // Force disable asset prefix for development to prevent 404s
  // Set basePath explicitly to an empty string
  basePath: "",

  // Disable strict mode temporarily for debugging
  reactStrictMode: false,

  // Add proper trailing slashes to prevent path issues
  trailingSlash: true,

  // Enable detailed error messages
  distDir: ".next",
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    typescript: {
        ignoreBuildErrors: true,
    },
    // Note: Turbopack doesn't fully support WASM files yet
    // For now, WASM files should be loaded dynamically via fetch
};

export default nextConfig;

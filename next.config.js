/** @type {import('next').NextConfig} */
const path = require("path");
const nextConfig = {
    reactStrictMode: false,
    turbopack: {
        root: path.resolve(__dirname),
        rules: {
            "*.f": {
                loaders: ["raw-loader"],
                as: "*.js",
            },
            "*.fx": {
                loaders: ["raw-loader"],
                as: "*.js",
            },
        },
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    // 删除 X-Frame-Options 以允许在 iframe 中加载
                    { key: 'Content-Security-Policy', value: "frame-ancestors *" },
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    // { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
                    // { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                    // { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                ],
            },
        ];
    },
};

module.exports = nextConfig;

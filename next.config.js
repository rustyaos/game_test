/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
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
    webpack: (config) => {
        config.module.rules.push({
            test: /\.fx?$/,
            loader: "raw-loader"
        });
        return config;
    },
};

module.exports = nextConfig;

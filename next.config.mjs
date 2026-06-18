/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fonts are loaded via <link> in app/layout.tsx. Disable Next's build-time
  // font optimization so it doesn't try to fetch/minify that stylesheet during
  // the build (harmless warning otherwise, and avoids any network dependency).
  optimizeFonts: false,
};
export default nextConfig;

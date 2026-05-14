import type { NextConfig } from 'next';
import { dirname, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAEMON_PORT = Number(process.env.OD_PORT) || 7456;
const DAEMON_ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;

const isProd = process.env.NODE_ENV !== 'development';
const webOutputMode = process.env.OD_WEB_OUTPUT_MODE;
const isServerOutput = webOutputMode === 'server' || webOutputMode === 'standalone';
const shouldStaticExport = isProd && !isServerOutput;

const WEB_ROOT = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = dirname(dirname(WEB_ROOT));
const toPosixPath = (value: string) => value.replaceAll('\\', '/');

function resolveDistDir(defaultValue: string) {
  if (process.env.OD_WEB_PROD === '1') return defaultValue;
  const configured = process.env.OD_WEB_DIST_DIR;
  if (!configured) return defaultValue;
  return toPosixPath(isAbsolute(configured) ? relative(WEB_ROOT, configured) || '.' : configured);
}

const DIST_DIR = resolveDistDir(isProd ? (shouldStaticExport ? 'out' : '.next') : '.next');

function resolveDevTsconfigPath() {
  const configured = process.env.OD_WEB_TSCONFIG_PATH;
  if (!configured) return undefined;
  return toPosixPath(isAbsolute(configured) ? relative(WEB_ROOT, configured) || 'tsconfig.json' : configured);
}

const DEV_TSCONFIG_PATH = resolveDevTsconfigPath();

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  outputFileTracingRoot: WORKSPACE_ROOT,
  reactStrictMode: true,
  turbopack: {
    root: WORKSPACE_ROOT,
  },
  ...(DEV_TSCONFIG_PATH ? { typescript: { tsconfigPath: DEV_TSCONFIG_PATH } } : {}),
  distDir: DIST_DIR,
  ...(shouldStaticExport
    ? {
        output: 'export' as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : webOutputMode === 'standalone'
      ? {
          output: 'standalone' as const,
        }
      : !isProd
        ? {
            async rewrites() {
              return [
                { source: '/api/:path*', destination: `${DAEMON_ORIGIN}/api/:path*` },
                { source: '/artifacts/:path*', destination: `${DAEMON_ORIGIN}/artifacts/:path*` },
                { source: '/frames/:path*', destination: `${DAEMON_ORIGIN}/frames/:path*` },
              ];
            },
            devIndicators: {
              position: 'bottom-right',
            },
          }
        : {}),
};

export default nextConfig;

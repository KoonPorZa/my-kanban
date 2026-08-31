import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac';

const PRODUCTION_ORIGIN = 'https://kanban.koonporza.com';
const SINGAPORE_REGION = 'asia-southeast1-eqsg3a';
const SHARED_BUILD_INPUTS = [
  '/package.json',
  '/pnpm-lock.yaml',
  '/pnpm-workspace.yaml',
  '/packages/**',
];

export default defineRailway((context) => {
  const isProduction = context.isEnvironment('production');
  const database = postgres('Postgres', { region: SINGAPORE_REGION });

  const api = service('api', {
    source: github('KoonPorZa/my-kanban', { branch: 'main', checkSuites: true }),
    build: {
      builder: 'RAILPACK',
      buildCommand: 'pnpm --filter @my-kanban/api build',
      watchPatterns: ['/apps/api/**', ...SHARED_BUILD_INPUTS],
    },
    start: 'pnpm --filter @my-kanban/api start:prod',
    preDeploy: 'pnpm --filter @my-kanban/api prisma:deploy',
    healthcheck: '/health/ready',
    healthcheckTimeout: 300,
    replicas: isProduction ? { [SINGAPORE_REGION]: 1 } : 1,
    deploy: {
      overlapSeconds: 30,
      drainingSeconds: 30,
    },
    env: {
      NODE_ENV: 'production',
      PORT: '3001',
      APP_ORIGIN: PRODUCTION_ORIGIN,
      DATABASE_URL: database.env.DATABASE_URL,
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      GOOGLE_CALLBACK_URL: `${PRODUCTION_ORIGIN}/api/v1/auth/google/callback`,
      ALLOWED_GOOGLE_EMAILS: preserve(),
      SESSION_SECRET: preserve(),
      SESSION_TTL_SECONDS: '604800',
      RAILPACK_NODE_VERSION: '22',
      RAILPACK_INSTALL_CMD: 'pnpm install --frozen-lockfile',
    },
  });

  const web = service('web', {
    source: github('KoonPorZa/my-kanban', { branch: 'main', checkSuites: true }),
    build: {
      builder: 'RAILPACK',
      buildCommand: 'pnpm --filter @my-kanban/web build',
      watchPatterns: ['/apps/web/**', ...SHARED_BUILD_INPUTS],
    },
    start: 'pnpm --filter @my-kanban/web start',
    healthcheck: '/health/live',
    healthcheckTimeout: 300,
    replicas: isProduction ? { [SINGAPORE_REGION]: 1 } : 1,
    deploy: {
      overlapSeconds: 30,
      drainingSeconds: 30,
    },
    env: {
      NODE_ENV: 'production',
      API_INTERNAL_URL: 'http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}',
      NEXT_PUBLIC_AUTH_SKIP: 'false',
      RAILPACK_NODE_VERSION: '22',
      RAILPACK_INSTALL_CMD: 'pnpm install --frozen-lockfile',
    },
  });

  return project('my-kanban', {
    resources: [database, api, web],
  });
});

import "server-only";

/** UI에 노출할 환경 변수 스냅샷. 시크릿(SERVICE_ROLE_KEY, CLIENT_SECRET 등)은 boolean만 노출. */
export type EnvSnapshot = {
  mail: {
    dryRun: string;
    thresholdDays: string;
    companyName: string;
    baseUrl: string;
  };
  sharepoint: {
    driveId: { configured: boolean; preview: string };
    contractsItemId: { configured: boolean; preview: string };
    receivablesDriveId: { configured: boolean; preview: string };
    receivablesItemId: { configured: boolean; preview: string };
  };
  azure: {
    tenantId: { configured: boolean; preview: string };
    clientId: { configured: boolean; preview: string };
    clientSecret: { configured: boolean };
  };
  supabase: {
    url: string;
    serviceRoleConfigured: boolean;
  };
  build: {
    version: string;
    gitSha: string;
    gitBranch: string;
    gitMessage: string;
    nodeVersion: string;
  };
  deploy: {
    nodeEnv: string;
    vercelEnv: string;
    vercelUrl: string;
    siteUrl: string;
    region: string;
  };
};

function preview(value: string | undefined, head = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function getEnvSnapshot(): EnvSnapshot {
  return {
    mail: {
      dryRun: process.env.MAIL_DRY_RUN ?? "(미설정)",
      thresholdDays: process.env.MAIL_REMINDER_THRESHOLD_DAYS ?? "(미설정)",
      companyName: process.env.MAIL_COMPANY_NAME ?? "(미설정)",
      baseUrl: process.env.FOLIO_BASE_URL ?? "(미설정)",
    },
    sharepoint: {
      driveId: {
        configured: Boolean(process.env.SHAREPOINT_DRIVE_ID),
        preview: preview(process.env.SHAREPOINT_DRIVE_ID),
      },
      contractsItemId: {
        configured: Boolean(process.env.SHAREPOINT_CONTRACTS_ITEM_ID),
        preview: preview(process.env.SHAREPOINT_CONTRACTS_ITEM_ID),
      },
      receivablesDriveId: {
        configured: Boolean(process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID),
        preview: preview(process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID),
      },
      receivablesItemId: {
        configured: Boolean(process.env.SHAREPOINT_RECEIVABLES_ITEM_ID),
        preview: preview(process.env.SHAREPOINT_RECEIVABLES_ITEM_ID),
      },
    },
    azure: {
      tenantId: {
        configured: Boolean(process.env.AZURE_AD_TENANT_ID),
        preview: preview(process.env.AZURE_AD_TENANT_ID),
      },
      clientId: {
        configured: Boolean(process.env.AZURE_AD_CLIENT_ID),
        preview: preview(process.env.AZURE_AD_CLIENT_ID),
      },
      clientSecret: {
        configured: Boolean(process.env.AZURE_AD_CLIENT_SECRET),
      },
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(미설정)",
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    build: {
      version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? "(미설정)",
      gitSha:
        process.env.NEXT_PUBLIC_GIT_SHA ??
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
        "(미설정)",
      gitBranch:
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ?? "(미설정)",
      gitMessage:
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE ?? "(미설정)",
      nodeVersion: process.version,
    },
    deploy: {
      nodeEnv: process.env.NODE_ENV ?? "(미설정)",
      vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "(local)",
      vercelUrl: process.env.NEXT_PUBLIC_VERCEL_URL ?? "(미설정)",
      siteUrl:
        process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.FOLIO_BASE_URL ??
        "(미설정)",
      region: process.env.VERCEL_REGION ?? "(미설정)",
    },
  };
}

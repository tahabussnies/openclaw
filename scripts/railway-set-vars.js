/**
 * Set Railway service variables via GraphQL API.
 * Requires: RAILWAY_TOKEN in env or .env.
 * - Account/workspace token: https://railway.com/account/tokens (uses Bearer auth)
 * - Project token: Project → Settings → Tokens (set RAILWAY_PROJECT_TOKEN=1 to use Project-Access-Token header)
 * IDs below are from the openclaw service deployment logs.
 */
try { require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') }); } catch (_) {}

const PROJECT_ID = '01f2903c-1d90-46f0-b9e3-dc6d6dd0aa38';
const ENVIRONMENT_ID = 'c5c3358c-6984-4b3a-9c15-52c7d8869d5d';
const SERVICE_ID = 'a9f85d7f-3ae4-4af8-9e07-b37257f2ec35';
const ENDPOINT = 'https://backboard.railway.com/graphql/v2';

const varsToSet = [
  { name: 'RAILWAY_RUN_UID', value: '0' },
  { name: 'PORT', value: '8080' },
  { name: 'OPENCLAW_STATE_DIR', value: '/data/.openclaw' },
  { name: 'OPENCLAW_WORKSPACE_DIR', value: '/data/workspace' },
  { name: 'OPENCLAW_GATEWAY_TRUSTED_PROXIES', value: '100.64.0.0/24' },
];

// Account/workspace tokens use Authorization: Bearer; project tokens use Project-Access-Token
const useProjectToken = process.env.RAILWAY_PROJECT_TOKEN === '1';

async function variableUpsert(token, name, value) {
  const headers = {
    'Content-Type': 'application/json',
    ...(useProjectToken
      ? { 'Project-Access-Token': token }
      : { 'Authorization': `Bearer ${token}` }),
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: 'mutation variableUpsert($input:VariableUpsertInput!){variableUpsert(input:$input)}',
      variables: {
        input: {
          projectId: PROJECT_ID,
          environmentId: ENVIRONMENT_ID,
          serviceId: SERVICE_ID,
          name,
          value,
        },
      },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json;
}

async function main() {
  const token = process.env.RAILWAY_TOKEN;
  if (!token) {
    console.error('RAILWAY_TOKEN is not set. Create one at https://railway.com/account/tokens and set it in your environment.');
    process.exit(1);
  }
  console.log('Setting variables on Railway service...');
  for (const { name, value } of varsToSet) {
    await variableUpsert(token, name, value);
    console.log('  Set', name, '=', name.includes('TOKEN') || name.includes('KEY') || name.includes('PASSWORD') ? '***' : value);
  }
  console.log('Done. Redeploy the service if it is already running.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

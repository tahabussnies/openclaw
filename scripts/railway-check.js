/**
 * Railway: check settings, latest deployment logs, and get service URL.
 * Requires RAILWAY_TOKEN (and RAILWAY_PROJECT_TOKEN=1 for project token).
 */
try { require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') }); } catch (_) {}

const PROJECT_ID = '01f2903c-1d90-46f0-b9e3-dc6d6dd0aa38';
const ENVIRONMENT_ID = 'c5c3358c-6984-4b3a-9c15-52c7d8869d5d';
const SERVICE_ID = 'a9f85d7f-3ae4-4af8-9e07-b37257f2ec35';
const ENDPOINT = 'https://backboard.railway.com/graphql/v2';
const useProjectToken = process.env.RAILWAY_PROJECT_TOKEN === '1';

async function gql(token, query, variables = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(useProjectToken ? { 'Project-Access-Token': token } : { 'Authorization': `Bearer ${token}` }),
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function main() {
  const token = process.env.RAILWAY_TOKEN;
  if (!token) {
    console.error('Set RAILWAY_TOKEN (and RAILWAY_PROJECT_TOKEN=1 if using a project token).');
    process.exit(1);
  }

  console.log('=== Railway openclaw service check ===\n');

  // 1. Variables (names only; values are redacted in API)
  const varsData = await gql(token, `
    query variables($projectId: String!, $environmentId: String!, $serviceId: String) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }
  `, { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID, serviceId: SERVICE_ID });
  const varNames = varsData.variables ? Object.keys(varsData.variables) : [];
  console.log('1. Variables set on service:', varNames.length ? varNames.join(', ') : '(none)');
  const required = ['RAILWAY_RUN_UID', 'PORT', 'OPENCLAW_STATE_DIR', 'OPENCLAW_WORKSPACE_DIR', 'OPENCLAW_GATEWAY_TOKEN'];
  const missing = required.filter((k) => !varNames.includes(k));
  if (missing.length) console.log('   Missing (recommended):', missing.join(', '));
  console.log('');

  // 2. Domains (public URL)
  const domainsData = await gql(token, `
    query domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
      domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
        serviceDomains { domain }
        customDomains { domain }
      }
    }
  `, { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID, serviceId: SERVICE_ID });
  const serviceDomains = domainsData.domains?.serviceDomains || [];
  const customDomains = domainsData.domains?.customDomains || [];
  const firstDomain = serviceDomains[0]?.domain || customDomains[0]?.domain;
  const baseUrl = firstDomain ? `https://${firstDomain}` : null;
  console.log('2. Public URL:', baseUrl || '(no domain found – add one in Railway → Settings → Networking)');
  if (serviceDomains.length) console.log('   Service domains:', serviceDomains.map((d) => d.domain).join(', '));
  if (customDomains.length) console.log('   Custom domains:', customDomains.map((d) => d.domain).join(', '));
  console.log('');

  // 3. Latest deployments
  const deploymentsData = await gql(token, `
    query deployments($input: DeploymentListInput!) {
      deployments(first: 5, input: $input) {
        edges { node { id status createdAt staticUrl } }
      }
    }
  `, { input: { projectId: PROJECT_ID, environmentId: ENVIRONMENT_ID, serviceId: SERVICE_ID } });
  const edges = deploymentsData.deployments?.edges || [];
  const latest = edges[0]?.node;
  if (!latest) {
    console.log('3. Latest deployment: (none found)');
  } else {
    console.log('3. Latest deployment:', latest.id);
    console.log('   Status:', latest.status);
    console.log('   Created:', latest.createdAt);
    if (latest.staticUrl) console.log('   Static URL:', latest.staticUrl);
    console.log('');

    // 4. Runtime logs for latest deployment
    const logsData = await gql(token, `
      query deploymentLogs($deploymentId: String!, $limit: Int) {
        deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
          message timestamp severity
        }
      }
    `, { deploymentId: latest.id, limit: 80 });
    const logs = logsData.deploymentLogs || [];
    console.log('4. Last', logs.length, 'runtime log lines:');
    console.log('---');
    logs.slice(-40).forEach((l) => {
      const t = l.timestamp ? new Date(l.timestamp).toISOString() : '';
      const sev = l.severity === 'err' ? 'ERR' : '';
      console.log((t + ' ' + sev).trim() ? `[${t}] ${sev} ${l.message}` : l.message);
    });
    console.log('---');
  }

  // 5. Test live site
  if (baseUrl) {
    console.log('\n5. Live site check:');
    try {
      const healthRes = await fetch(`${baseUrl}/health`, { method: 'GET' });
      const healthOk = healthRes.ok;
      const healthBody = await healthRes.text();
      console.log('   GET /health:', healthRes.status, healthOk ? 'OK' : 'FAIL', healthBody.slice(0, 120));
      const rootRes = await fetch(baseUrl, { method: 'GET' });
      console.log('   GET / (root):', rootRes.status);
    } catch (e) {
      console.log('   Request failed:', e.message);
    }
  }

  console.log('\n=== Done ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

const CLOUD_STORAGE_KEY = 'uluk_site_cloud_overrides_v1';
const DEFAULT_CLOUD_SETTINGS = {
  useCloud: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
  tableName: 'leads',
  telegramEnabled: false,
  telegramFunctionName: 'telegram-notify',
  localFallback: true
};

function normalizeText(value) {
  return String(value || '').trim();
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function mergeCloudSettings(base, extra) {
  return {
    ...base,
    ...(extra && typeof extra === 'object' ? extra : {})
  };
}

function getCloudSettings() {
  const staticConfig = typeof window !== 'undefined' && window.ULUK_CLOUD_CONFIG ? window.ULUK_CLOUD_CONFIG : {};
  const storedConfig = safeJsonParse(localStorage.getItem(CLOUD_STORAGE_KEY) || 'null', {});
  const settings = mergeCloudSettings(mergeCloudSettings(DEFAULT_CLOUD_SETTINGS, staticConfig), storedConfig);

  settings.supabaseUrl = normalizeText(settings.supabaseUrl);
  settings.supabaseAnonKey = normalizeText(settings.supabaseAnonKey);
  settings.tableName = normalizeText(settings.tableName) || 'leads';
  settings.telegramFunctionName = normalizeText(settings.telegramFunctionName) || 'telegram-notify';
  settings.useCloud = Boolean(settings.useCloud && settings.supabaseUrl && settings.supabaseAnonKey);
  settings.telegramEnabled = Boolean(settings.telegramEnabled);
  settings.localFallback = settings.localFallback !== false;

  return settings;
}

function saveCloudOverrides(payload) {
  const current = safeJsonParse(localStorage.getItem(CLOUD_STORAGE_KEY) || 'null', {});
  const next = mergeCloudSettings(current || {}, payload || {});
  localStorage.setItem(CLOUD_STORAGE_KEY, JSON.stringify(next));
  return getCloudSettings();
}

function clearCloudOverrides() {
  localStorage.removeItem(CLOUD_STORAGE_KEY);
  return getCloudSettings();
}

function getFunctionsBaseUrl(settings) {
  return `${settings.supabaseUrl.replace(/\/+$/, '')}/functions/v1`;
}

async function ensureSupabaseClientLoaded() {
  if (window.supabase?.createClient) return true;
  return false;
}

async function getSupabaseClient() {
  const settings = getCloudSettings();
  if (!settings.useCloud) return null;
  const loaded = await ensureSupabaseClientLoaded();
  if (!loaded) {
    throw new Error('Библиотека Supabase не загружена.');
  }
  return window.supabase.createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function mapLeadToCloudRow(lead) {
  return {
    local_id: String(lead.id || Date.now()),
    created_at: lead.createdAt || new Date().toISOString(),
    status: lead.status || 'new',
    name: normalizeText(lead.name),
    phone: normalizeText(lead.phone),
    company: normalizeText(lead.company),
    service: normalizeText(lead.service),
    channel: normalizeText(lead.channel),
    comment: normalizeText(lead.comment),
    page: normalizeText(lead.page),
    source: 'website',
    raw_payload: lead
  };
}

function mapCloudRowToLead(row) {
  return {
    id: row.id,
    localId: row.local_id || '',
    createdAt: row.created_at,
    status: row.status || 'new',
    name: row.name || '',
    phone: row.phone || '',
    company: row.company || '',
    service: row.service || '',
    channel: row.channel || '',
    comment: row.comment || '',
    page: row.page || '',
    source: row.source || 'website',
    cloud: true
  };
}

async function saveLeadToCloud(lead) {
  const settings = getCloudSettings();
  if (!settings.useCloud) {
    return { ok: false, mode: 'local-only', data: null };
  }

  const client = await getSupabaseClient();
  const payload = mapLeadToCloudRow(lead);
  const { data, error } = await client
    .from(settings.tableName)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return { ok: true, mode: 'cloud', data: mapCloudRowToLead(data) };
}

async function fetchCloudLeads(filters = {}) {
  const settings = getCloudSettings();
  if (!settings.useCloud) return [];

  const client = await getSupabaseClient();
  let query = client
    .from(settings.tableName)
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const search = normalizeText(filters.search);
  if (search) {
    const escaped = search.replace(/[%_,]/g, ' ');
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,company.ilike.%${escaped}%,service.ilike.%${escaped}%,comment.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapCloudRowToLead);
}

async function updateCloudLeadStatus(id, status) {
  const settings = getCloudSettings();
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from(settings.tableName)
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapCloudRowToLead(data);
}

async function deleteCloudLead(id) {
  const settings = getCloudSettings();
  const client = await getSupabaseClient();
  const { error } = await client
    .from(settings.tableName)
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

async function clearCloudLeads() {
  const settings = getCloudSettings();
  const client = await getSupabaseClient();
  const { error } = await client
    .from(settings.tableName)
    .delete()
    .not('id', 'is', null);

  if (error) throw error;
  return true;
}

async function notifyLeadToTelegram(lead) {
  const settings = getCloudSettings();
  if (!settings.useCloud || !settings.telegramEnabled) {
    return { ok: false, skipped: true };
  }

  const endpoint = `${getFunctionsBaseUrl(settings)}/${settings.telegramFunctionName}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: settings.supabaseAnonKey,
      Authorization: `Bearer ${settings.supabaseAnonKey}`
    },
    body: JSON.stringify({ lead })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Telegram function error');
  }

  return response.json().catch(() => ({ ok: true }));
}

async function syncLeadEverywhere(lead) {
  const settings = getCloudSettings();
  const result = {
    localSaved: true,
    cloudSaved: false,
    telegramSent: false
  };

  if (!settings.useCloud) {
    return result;
  }

  const saved = await saveLeadToCloud(lead);
  result.cloudSaved = Boolean(saved?.ok);

  if (settings.telegramEnabled) {
    try {
      await notifyLeadToTelegram(saved?.data || lead);
      result.telegramSent = true;
    } catch (error) {
      console.error('Telegram notify failed', error);
    }
  }

  return result;
}

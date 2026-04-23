const STORAGE_KEY = 'uluk_site_content_v2';
const LEADS_KEY = 'uluk_site_leads_v2';
const USERS_KEY = 'uluk_site_users_v2';
const AUTH_KEY = 'uluk_site_auth_v2';
const TEMP_RETENTION_DAYS = 45;

let siteData = null;
let currentUser = null;
let currentCollection = null;
let currentEditIndex = null;
let currentLeads = [];
let currentLeadMode = 'local';

const collectionConfigs = {
  services: {
    title: 'услугу',
    fields: [
      { name: 'icon', label: 'Иконка / emoji', type: 'text', placeholder: '📹' },
      { name: 'title', label: 'Название услуги', type: 'text', required: true },
      { name: 'category', label: 'Категория', type: 'text', placeholder: 'Безопасность / Офис / Поддержка' },
      { name: 'desc', label: 'Описание', type: 'textarea', required: true },
      { name: 'features', label: 'Преимущества (каждое с новой строки)', type: 'textarea', placeholder: 'Подбор оборудования\nНастройка удалённого доступа' }
    ],
    normalize(payload) {
      return {
        icon: payload.icon || '🛠️',
        title: payload.title.trim(),
        category: payload.category.trim(),
        desc: payload.desc.trim(),
        features: payload.features.split('\n').map((item) => item.trim()).filter(Boolean)
      };
    }
  },
  cases: {
    title: 'кейс',
    fields: [
      { name: 'title', label: 'Название кейса', type: 'text', required: true },
      { name: 'industry', label: 'Отрасль / тип клиента', type: 'text' },
      { name: 'task', label: 'Задача', type: 'textarea', required: true },
      { name: 'solution', label: 'Решение', type: 'textarea', required: true },
      { name: 'result', label: 'Результат', type: 'textarea', required: true },
      { name: 'metrics', label: 'Метрики / факты (каждая с новой строки)', type: 'textarea', placeholder: '5 дней на запуск\n25 рабочих мест' }
    ],
    normalize(payload) {
      return {
        title: payload.title.trim(),
        industry: payload.industry.trim(),
        task: payload.task.trim(),
        solution: payload.solution.trim(),
        result: payload.result.trim(),
        metrics: payload.metrics.split('\n').map((item) => item.trim()).filter(Boolean)
      };
    }
  },
  testimonials: {
    title: 'отзыв',
    fields: [
      { name: 'name', label: 'Имя', type: 'text', required: true },
      { name: 'company', label: 'Компания / тип клиента', type: 'text' },
      { name: 'text', label: 'Текст отзыва', type: 'textarea', required: true }
    ],
    normalize(payload) {
      return {
        name: payload.name.trim(),
        company: payload.company.trim(),
        text: payload.text.trim()
      };
    }
  },
  faq: {
    title: 'вопрос',
    fields: [
      { name: 'q', label: 'Вопрос', type: 'text', required: true },
      { name: 'a', label: 'Ответ', type: 'textarea', required: true }
    ],
    normalize(payload) {
      return {
        q: payload.q.trim(),
        a: payload.a.trim()
      };
    }
  }
};

const defaultUsers = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Главный администратор' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', name: 'Пользователь для просмотра' }
];

const defaultDataPromise = fetch('data.json')
  .then((response) => response.json())
  .catch(() => null);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeData(defaults, stored) {
  if (Array.isArray(defaults)) {
    return Array.isArray(stored) ? stored : defaults;
  }
  if (defaults && typeof defaults === 'object') {
    const output = { ...defaults };
    if (!stored || typeof stored !== 'object') return output;
    Object.keys(stored).forEach((key) => {
      output[key] = key in defaults ? mergeData(defaults[key], stored[key]) : stored[key];
    });
    return output;
  }
  return stored ?? defaults;
}

async function getDefaultData() {
  const data = await defaultDataPromise;
  return data ? deepClone(data) : null;
}

async function loadSiteData() {
  const defaults = await getDefaultData();
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    siteData = defaults;
    return siteData;
  }

  try {
    const parsed = JSON.parse(raw);
    siteData = defaults ? mergeData(defaults, parsed) : parsed;
  } catch (error) {
    console.error(error);
    siteData = defaults;
  }

  return siteData;
}

function saveSiteData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3500);
}

function ensureUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    return;
  }

  try {
    JSON.parse(raw);
  } catch (error) {
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  }
}

function getUsers() {
  ensureUsers();
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(AUTH_KEY);
  }
}

function restoreSession() {
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    currentUser = JSON.parse(raw);
    return currentUser;
  } catch (error) {
    sessionStorage.removeItem(AUTH_KEY);
    return null;
  }
}

function isAdmin() {
  return currentUser?.role === 'admin';
}

function cleanupExpiredLeads() {
  const raw = localStorage.getItem(LEADS_KEY);
  if (!raw) return;

  try {
    const leads = JSON.parse(raw);
    const maxAge = TEMP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const filtered = leads.filter((lead) => Date.now() - new Date(lead.createdAt).getTime() <= maxAge);

    if (filtered.length !== leads.length) {
      localStorage.setItem(LEADS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error(error);
  }
}

function getLocalLeads() {
  cleanupExpiredLeads();
  try {
    return JSON.parse(localStorage.getItem(LEADS_KEY) || '[]');
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveLocalLeads(leads) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function renderLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('adminApp').classList.add('hidden');

  const form = document.getElementById('loginForm');
  form.onsubmit = (event) => {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    const user = getUsers().find((item) => item.username === username && item.password === password);

    if (!user) {
      showToast('Неверный логин или пароль.');
      return;
    }

    setCurrentUser(user);
    showApp();
  };
}

async function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');

  await loadSiteData();
  renderTopbar();
  setupTabs();
  fillContentForm();
  renderAllCollections();
  renderCloudSettingsForm();
  bindGeneralActions();
  applyPermissions();
  await refreshLeadData();
}

function renderTopbar() {
  document.getElementById('currentUserName').textContent = currentUser?.name || 'Пользователь';
  document.getElementById('currentUserRole').textContent = isAdmin() ? 'Администратор' : 'Пользователь';
  document.getElementById('currentUserRole').className = `tag ${isAdmin() ? 'success' : 'warning'}`;
  updateRetentionInfo();
}

function updateRetentionInfo() {
  const settings = getCloudSettings();
  document.getElementById('retentionInfo').textContent = settings.useCloud
    ? `Supabase подключён. Локальный резерв: ${TEMP_RETENTION_DAYS} дней.`
    : `Локальное хранение заявок: ${TEMP_RETENTION_DAYS} дней без сервера.`;
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const tabs = document.querySelectorAll('.tab-content');

  buttons.forEach((button) => {
    button.onclick = () => {
      const target = button.dataset.tab;
      buttons.forEach((item) => item.classList.remove('active'));
      tabs.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`${target}Tab`).classList.add('active');
    };
  });
}

function fillContentForm() {
  if (!siteData) return;

  document.getElementById('heroEyebrow').value = siteData.hero?.eyebrow || '';
  document.getElementById('heroTagline').value = siteData.hero?.tagline || '';
  document.getElementById('heroSubtitle').value = siteData.hero?.subtitle || '';
  document.getElementById('heroCta').value = siteData.hero?.cta || '';

  document.getElementById('aboutHeadline').value = siteData.about?.headline || '';
  document.getElementById('aboutText').value = siteData.about?.text || '';

  document.getElementById('companyName').value = siteData.company?.name || '';
  document.getElementById('companyCity').value = siteData.company?.city || '';
  document.getElementById('companyAddress').value = siteData.company?.address || '';
  document.getElementById('companyPhone').value = siteData.company?.phone || '';
  document.getElementById('companyWhatsapp').value = siteData.company?.whatsapp || '';
  document.getElementById('companyTelegram').value = siteData.company?.telegram || '';
  document.getElementById('companyEmail').value = siteData.company?.email || '';
}

function renderDashboard() {
  const newLeads = currentLeads.filter((lead) => lead.status === 'new').length;
  const settings = getCloudSettings();

  document.getElementById('dashboardCards').innerHTML = `
    <div class="panel dashboard-card glow-border"><span class="muted">Услуги</span><span class="value">${siteData.services?.length || 0}</span></div>
    <div class="panel dashboard-card glow-border"><span class="muted">Кейсы</span><span class="value">${siteData.cases?.length || 0}</span></div>
    <div class="panel dashboard-card glow-border"><span class="muted">Всего заявок</span><span class="value">${currentLeads.length}</span></div>
    <div class="panel dashboard-card glow-border"><span class="muted">Новые заявки</span><span class="value">${newLeads}</span></div>
    <div class="panel dashboard-card glow-border"><span class="muted">Хранение</span><span class="value">${settings.useCloud ? 'Supabase' : 'localStorage'}</span></div>
  `;
}

function renderCollection(collectionName, containerId) {
  const container = document.getElementById(containerId);
  const items = siteData[collectionName] || [];
  const config = collectionConfigs[collectionName];
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">Пока нет элементов. Нажмите «Добавить ${config.title}».</div>`;
    return;
  }

  container.innerHTML = items.map((item, index) => {
    const subtitle = collectionName === 'services' ? item.category || 'Без категории' : collectionName === 'cases' ? item.industry || 'Без отрасли' : collectionName === 'testimonials' ? item.company || 'Клиент' : 'FAQ';
    const body = collectionName === 'services' ? item.desc : collectionName === 'cases' ? item.result : collectionName === 'testimonials' ? item.text : item.a;
    const title = collectionName === 'faq' ? item.q : item.title || item.name;

    return `
      <article class="collection-item glow-border">
        <span class="meta">${subtitle}</span>
        <h3>${title}</h3>
        <p>${body}</p>
        ${isAdmin() ? `<div class="item-actions"><button class="btn-secondary" data-edit-collection="${collectionName}" data-index="${index}">Редактировать</button><button class="btn-danger" data-delete-collection="${collectionName}" data-index="${index}">Удалить</button></div>` : ''}
      </article>
    `;
  }).join('');
}

function renderAllCollections() {
  renderCollection('services', 'servicesAdminList');
  renderCollection('cases', 'casesAdminList');
  renderCollection('testimonials', 'testimonialsAdminList');
  renderCollection('faq', 'faqAdminList');

  if (isAdmin()) {
    document.querySelectorAll('[data-open-modal]').forEach((button) => {
      button.onclick = () => openCollectionModal(button.dataset.openModal);
    });

    document.querySelectorAll('[data-edit-collection]').forEach((button) => {
      button.onclick = () => openCollectionModal(button.dataset.editCollection, Number(button.dataset.index));
    });

    document.querySelectorAll('[data-delete-collection]').forEach((button) => {
      button.onclick = () => deleteCollectionItem(button.dataset.deleteCollection, Number(button.dataset.index));
    });
  }
}

function openCollectionModal(collectionName, index = null) {
  currentCollection = collectionName;
  currentEditIndex = index;
  const config = collectionConfigs[collectionName];
  const modal = document.getElementById('editorModal');
  const form = document.getElementById('editorForm');
  const title = document.getElementById('modalTitle');
  const item = index === null ? null : siteData[collectionName][index];
  title.textContent = `${index === null ? 'Добавить' : 'Редактировать'} ${config.title}`;

  form.innerHTML = config.fields.map((field) => {
    const rawValue = item?.[field.name];
    const value = Array.isArray(rawValue) ? rawValue.join('\n') : (rawValue || '');
    return `
      <div class="form-field">
        <label for="field_${field.name}">${field.label}${field.required ? ' *' : ''}</label>
        ${field.type === 'textarea'
          ? `<textarea id="field_${field.name}" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>${value}</textarea>`
          : `<input class="admin-input" id="field_${field.name}" name="${field.name}" type="${field.type}" value="${value}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`}
      </div>
    `;
  }).join('');

  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('editorModal').classList.remove('active');
  currentCollection = null;
  currentEditIndex = null;
}

function collectModalData() {
  const config = collectionConfigs[currentCollection];
  const form = document.getElementById('editorForm');
  const payload = Object.fromEntries(new FormData(form).entries());
  for (const field of config.fields) {
    if (field.required && !String(payload[field.name] || '').trim()) {
      throw new Error(`Поле "${field.label}" обязательно.`);
    }
  }
  return config.normalize(payload);
}

function deleteCollectionItem(collectionName, index) {
  if (!isAdmin()) return;
  if (!confirm('Удалить элемент?')) return;
  siteData[collectionName].splice(index, 1);
  saveSiteData();
  renderAllCollections();
  renderDashboard();
  showToast('Элемент удалён.');
}

function exportJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function getLeadSourceLabel() {
  const settings = getCloudSettings();
  if (settings.useCloud) {
    return 'Заявки читаются из Supabase. При сбое будет использован локальный резерв этого браузера.';
  }
  return `Заявки читаются из localStorage этого браузера. Срок хранения: ${TEMP_RETENTION_DAYS} дней.`;
}

async function refreshLeadData() {
  const search = document.getElementById('leadSearch')?.value.trim().toLowerCase() || '';
  const status = document.getElementById('leadStatusFilter')?.value || '';
  const settings = getCloudSettings();

  try {
    if (settings.useCloud) {
      currentLeads = await fetchCloudLeads({ search, status });
      currentLeadMode = 'cloud';
    } else {
      const allLocal = getLocalLeads().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      currentLeads = allLocal.filter((lead) => {
        const haystack = `${lead.name} ${lead.phone} ${lead.company || ''} ${lead.service || ''} ${lead.comment || ''}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = !status || lead.status === status;
        return matchesSearch && matchesStatus;
      });
      currentLeadMode = 'local';
    }
  } catch (error) {
    console.error(error);
    currentLeads = getLocalLeads().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    currentLeadMode = 'local-fallback';
    showToast('Не удалось получить заявки из облака. Показан локальный резерв.');
  }

  document.getElementById('leadsSourceNote').textContent = await getLeadSourceLabel();
  renderDashboard();
  renderLeads();
}

function renderLeads() {
  document.getElementById('leadsCount').textContent = String(currentLeads.length);
  const container = document.getElementById('leadsList');
  if (!currentLeads.length) {
    container.innerHTML = `<div class="empty-state">Заявок не найдено.</div>`;
    return;
  }

  container.innerHTML = currentLeads.map((lead) => `
    <article class="lead-card glow-border">
      <div class="lead-head">
        <div>
          <h3>${lead.name}</h3>
          <div class="lead-meta">
            <span class="meta">${formatDate(lead.createdAt)}</span>
            <span class="meta">${lead.status || 'new'}</span>
            <span class="meta">${lead.page || 'Сайт'}</span>
            <span class="meta">${currentLeadMode.startsWith('cloud') ? 'cloud' : 'local'}</span>
          </div>
        </div>
        ${isAdmin() ? `<div class="toolbar-group"><select class="admin-input" data-lead-status="${lead.id}"><option value="new" ${lead.status === 'new' ? 'selected' : ''}>new</option><option value="in_progress" ${lead.status === 'in_progress' ? 'selected' : ''}>in_progress</option><option value="done" ${lead.status === 'done' ? 'selected' : ''}>done</option><option value="archived" ${lead.status === 'archived' ? 'selected' : ''}>archived</option></select><button class="btn-danger" data-delete-lead="${lead.id}">Удалить</button></div>` : ''}
      </div>
      <div class="lead-grid">
        <div class="lead-field"><strong>Телефон</strong><span>${lead.phone || '—'}</span></div>
        <div class="lead-field"><strong>Компания</strong><span>${lead.company || '—'}</span></div>
        <div class="lead-field"><strong>Услуга</strong><span>${lead.service || '—'}</span></div>
        <div class="lead-field"><strong>Канал связи</strong><span>${lead.channel || '—'}</span></div>
      </div>
      ${lead.comment ? `<div class="lead-comment"><strong>Комментарий</strong><div>${lead.comment}</div></div>` : ''}
    </article>
  `).join('');

  if (isAdmin()) {
    container.querySelectorAll('[data-delete-lead]').forEach((button) => {
      button.onclick = () => deleteLead(button.dataset.deleteLead);
    });
    container.querySelectorAll('[data-lead-status]').forEach((select) => {
      select.onchange = () => updateLeadStatus(select.dataset.leadStatus, select.value);
    });
  }
}

async function updateLeadStatus(id, status) {
  if (!isAdmin()) return;
  try {
    if (currentLeadMode.startsWith('cloud')) {
      await updateCloudLeadStatus(id, status);
    } else {
      const leads = getLocalLeads();
      const lead = leads.find((item) => String(item.id) === String(id));
      if (!lead) return;
      lead.status = status;
      saveLocalLeads(leads);
    }
    await refreshLeadData();
    showToast('Статус заявки обновлён.');
  } catch (error) {
    console.error(error);
    showToast('Не удалось обновить статус заявки.');
  }
}

async function deleteLead(id) {
  if (!isAdmin()) return;
  if (!confirm('Удалить заявку?')) return;
  try {
    if (currentLeadMode.startsWith('cloud')) {
      await deleteCloudLead(id);
    } else {
      const leads = getLocalLeads().filter((item) => String(item.id) !== String(id));
      saveLocalLeads(leads);
    }
    await refreshLeadData();
    showToast('Заявка удалена.');
  } catch (error) {
    console.error(error);
    showToast('Не удалось удалить заявку.');
  }
}

function renderCloudSettingsForm() {
  const settings = getCloudSettings();
  document.getElementById('cloudUseCloud').checked = settings.useCloud;
  document.getElementById('cloudSupabaseUrl').value = settings.supabaseUrl || '';
  document.getElementById('cloudSupabaseAnonKey').value = settings.supabaseAnonKey || '';
  document.getElementById('cloudTableName').value = settings.tableName || 'leads';
  document.getElementById('cloudTelegramEnabled').checked = settings.telegramEnabled;
  document.getElementById('cloudTelegramFunctionName').value = settings.telegramFunctionName || 'telegram-notify';
  updateCloudConfigPreview();
}

function collectCloudSettingsForm() {
  return {
    useCloud: document.getElementById('cloudUseCloud').checked,
    supabaseUrl: document.getElementById('cloudSupabaseUrl').value.trim(),
    supabaseAnonKey: document.getElementById('cloudSupabaseAnonKey').value.trim(),
    tableName: document.getElementById('cloudTableName').value.trim() || 'leads',
    telegramEnabled: document.getElementById('cloudTelegramEnabled').checked,
    telegramFunctionName: document.getElementById('cloudTelegramFunctionName').value.trim() || 'telegram-notify',
    localFallback: true
  };
}

function updateCloudConfigPreview() {
  const settings = collectCloudSettingsForm();
  document.getElementById('cloudConfigPreview').value = `window.ULUK_CLOUD_CONFIG = ${JSON.stringify(settings, null, 2)};`;
}

async function testCloudConnection() {
  const settings = getCloudSettings();
  if (!settings.useCloud) {
    showToast('Сначала включите облако и заполните URL и key.');
    return;
  }

  try {
    await fetchCloudLeads({});
    showToast('Подключение к Supabase успешно.');
  } catch (error) {
    console.error(error);
    showToast('Не удалось подключиться к Supabase. Проверьте URL, key и SQL.');
  }
}

function bindGeneralActions() {
  document.getElementById('logoutBtn').onclick = () => {
    setCurrentUser(null);
    location.reload();
  };

  document.getElementById('saveContentBtn').onclick = () => {
    if (!isAdmin()) return;
    siteData.hero = {
      eyebrow: document.getElementById('heroEyebrow').value.trim(),
      tagline: document.getElementById('heroTagline').value.trim(),
      subtitle: document.getElementById('heroSubtitle').value.trim(),
      cta: document.getElementById('heroCta').value.trim()
    };
    siteData.about = {
      headline: document.getElementById('aboutHeadline').value.trim(),
      text: document.getElementById('aboutText').value.trim()
    };
    siteData.company = {
      name: document.getElementById('companyName').value.trim(),
      city: document.getElementById('companyCity').value.trim(),
      address: document.getElementById('companyAddress').value.trim(),
      phone: document.getElementById('companyPhone').value.trim(),
      whatsapp: document.getElementById('companyWhatsapp').value.trim(),
      telegram: document.getElementById('companyTelegram').value.trim(),
      email: document.getElementById('companyEmail').value.trim()
    };
    saveSiteData();
    showToast('Контент сохранён.');
  };

  document.getElementById('resetContentBtn').onclick = async () => {
    if (!isAdmin()) return;
    if (!confirm('Сбросить сайт к данным из data.json?')) return;
    const defaults = await getDefaultData();
    if (!defaults) {
      showToast('Не удалось загрузить data.json');
      return;
    }
    siteData = defaults;
    saveSiteData();
    fillContentForm();
    renderAllCollections();
    renderDashboard();
    showToast('Контент сброшен к базовой версии.');
  };

  document.getElementById('exportContentBtn').onclick = () => {
    if (isAdmin()) exportJson(siteData, 'uluk-site-content.json');
  };
  document.getElementById('exportLeadsBtn').onclick = () => {
    if (isAdmin()) exportJson(currentLeads, 'uluk-site-leads.json');
  };
  document.getElementById('refreshLeadsBtn').onclick = () => refreshLeadData();
  document.getElementById('clearLeadsBtn').onclick = async () => {
    if (!isAdmin()) return;
    if (!confirm('Удалить все заявки?')) return;
    try {
      if (currentLeadMode.startsWith('cloud')) {
        await clearCloudLeads();
      } else {
        localStorage.removeItem(LEADS_KEY);
      }
      await refreshLeadData();
      showToast('Все заявки удалены.');
    } catch (error) {
      console.error(error);
      showToast('Не удалось очистить заявки.');
    }
  };

  document.getElementById('closeModalBtn').onclick = closeModal;
  document.getElementById('editorModal').addEventListener('click', (event) => {
    if (event.target.id === 'editorModal') closeModal();
  });

  document.getElementById('editorSaveBtn').onclick = () => {
    if (!isAdmin()) return;
    try {
      const payload = collectModalData();
      const list = siteData[currentCollection] || [];
      if (currentEditIndex === null) {
        list.push(payload);
      } else {
        list[currentEditIndex] = payload;
      }
      siteData[currentCollection] = list;
      saveSiteData();
      renderAllCollections();
      renderDashboard();
      closeModal();
      showToast('Изменения сохранены.');
    } catch (error) {
      showToast(error.message);
    }
  };

  document.getElementById('leadSearch').addEventListener('input', refreshLeadData);
  document.getElementById('leadStatusFilter').addEventListener('change', refreshLeadData);

  ['cloudUseCloud', 'cloudSupabaseUrl', 'cloudSupabaseAnonKey', 'cloudTableName', 'cloudTelegramEnabled', 'cloudTelegramFunctionName'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateCloudConfigPreview);
    document.getElementById(id).addEventListener('change', updateCloudConfigPreview);
  });

  document.getElementById('saveCloudSettingsBtn').onclick = async () => {
    if (!isAdmin()) return;
    saveCloudOverrides(collectCloudSettingsForm());
    renderCloudSettingsForm();
    renderTopbar();
    await refreshLeadData();
    showToast('Настройки облака сохранены в этом браузере.');
  };

  document.getElementById('resetCloudSettingsBtn').onclick = async () => {
    if (!isAdmin()) return;
    clearCloudOverrides();
    renderCloudSettingsForm();
    renderTopbar();
    await refreshLeadData();
    showToast('Локальные override-настройки облака сброшены.');
  };

  document.getElementById('testCloudConnectionBtn').onclick = () => testCloudConnection();
}

function applyPermissions() {
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.classList.toggle('hidden', !isAdmin());
  });
  if (!isAdmin()) {
    document.querySelectorAll('.tab-btn[data-tab="dashboard"], .tab-btn[data-tab="content"], .tab-btn[data-tab="collections"], .tab-btn[data-tab="cloud"]').forEach((button) => {
      button.classList.add('hidden');
    });
    document.getElementById('leadsTab').classList.add('active');
    document.getElementById('dashboardTab').classList.remove('active');
    document.getElementById('contentTab').classList.remove('active');
    document.getElementById('collectionsTab').classList.remove('active');
    document.getElementById('cloudTab').classList.remove('active');
    document.querySelector('.tab-btn[data-tab="leads"]').classList.add('active');
    document.getElementById('permissionsNote').innerHTML = `<div class="note-box">Вы вошли как пользователь просмотра. Вам доступен только список заявок без редактирования и удаления.</div>`;
  } else {
    document.getElementById('permissionsNote').innerHTML = `<div class="note-box">Администратор может редактировать контент сайта, добавлять услуги и кейсы, управлять статусами заявок и настраивать Supabase / Telegram.</div>`;
  }
}

async function init() {
  ensureUsers();
  if (restoreSession()) {
    await showApp();
  } else {
    renderLogin();
  }
}

document.addEventListener('DOMContentLoaded', init);

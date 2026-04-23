const STORAGE_KEY = 'uluk_site_content_v2';
const LEADS_KEY = 'uluk_site_leads_v2';
const TEMP_RETENTION_DAYS = 45;

let siteData = null;

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
    if (!stored || typeof stored !== 'object') {
      return output;
    }
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
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    siteData = defaults;
    return siteData;
  }

  try {
    const parsed = JSON.parse(saved);
    siteData = defaults ? mergeData(defaults, parsed) : parsed;
  } catch (error) {
    console.error('Could not parse site data', error);
    siteData = defaults;
  }

  return siteData;
}

function getLeads() {
  cleanupExpiredLeads();
  try {
    return JSON.parse(localStorage.getItem(LEADS_KEY) || '[]');
  } catch (error) {
    console.error('Could not parse leads', error);
    return [];
  }
}

function saveLeads(leads) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

function cleanupExpiredLeads() {
  const raw = localStorage.getItem(LEADS_KEY);
  if (!raw) return;

  try {
    const leads = JSON.parse(raw);
    const now = Date.now();
    const maxAge = TEMP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const filtered = leads.filter((lead) => now - new Date(lead.createdAt).getTime() <= maxAge);

    if (filtered.length !== leads.length) {
      localStorage.setItem(LEADS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Could not cleanup leads', error);
  }
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch (error) {
    return value;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element && value !== undefined && value !== null) {
    element.textContent = value;
  }
}

function setLink(id, value, type) {
  const element = document.getElementById(id);
  if (!element || !value) return;
  element.textContent = value;
  element.href = `${type}:${value}`;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3800);
}

function renderHero() {
  if (!siteData?.hero) return;

  setText('hero-eyebrow', siteData.hero.eyebrow);
  setText('hero-tagline', siteData.hero.tagline);
  setText('hero-subtitle', siteData.hero.subtitle);

  const cta = document.getElementById('hero-cta');
  if (cta) cta.textContent = siteData.hero.cta || 'Оставить заявку';

  const stats = document.getElementById('hero-stats');
  if (stats && Array.isArray(siteData.hero.stats)) {
    stats.innerHTML = siteData.hero.stats.map((item) => `
      <div class="stat-card">
        <strong>${item.value}</strong>
        <span>${item.label}</span>
      </div>
    `).join('');
  }
}

function renderCompany() {
  if (!siteData?.company) return;

  setText('company-name', siteData.company.name);
  setText('company-name-footer', siteData.company.name);
  setText('company-city', siteData.company.city);
  setText('company-address', siteData.company.address);
  setText('footer-city', siteData.company.city);
  setText('footer-address', siteData.company.address);
  setText('company-whatsapp', siteData.company.whatsapp);
  setText('company-telegram', siteData.company.telegram);
  setText('company-email-text', siteData.company.email);
  setText('company-phone-text', siteData.company.phone);
  setText('footer-phone-text', siteData.company.phone);
  setText('footer-email-text', siteData.company.email);

  setLink('company-phone-link', siteData.company.phone, 'tel');
  setLink('company-email-link', siteData.company.email, 'mailto');
  setLink('footer-phone-link', siteData.company.phone, 'tel');
  setLink('footer-email-link', siteData.company.email, 'mailto');
}

function renderAbout() {
  if (!siteData?.about) return;
  setText('about-headline', siteData.about.headline);
  setText('about-text', siteData.about.text);
}

function renderServices(targetId, items, compact = false) {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.className = `cards-grid services-grid${compact ? ' compact' : ''}`;
  container.innerHTML = items.map((service) => `
    <article class="card service-card glow-border">
      <div class="service-top">
        <div class="service-icon">${service.icon || '🛠️'}</div>
        <span class="meta">${service.category || 'Услуга'}</span>
      </div>
      <div>
        <h3>${service.title}</h3>
      </div>
      <p>${service.desc || ''}</p>
      <ul class="features-list">
        ${(service.features || []).map((feature) => `<li>${feature}</li>`).join('')}
      </ul>
    </article>
  `).join('');
}

function renderCases(targetId, items) {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.className = 'cards-grid case-grid';
  container.innerHTML = items.map((item, index) => `
    <article class="card case-card glow-border">
      <div class="case-top">
        <div class="case-icon">${['⚙️', '📦', '🏪', '📈', '🧩', '🔐'][index % 6]}</div>
        <span class="meta">${item.industry || 'Кейс'}</span>
      </div>
      <div class="case-body">
        <h3>${item.title}</h3>
        <div class="case-block">
          <strong>Задача</strong>
          <p>${item.task || ''}</p>
        </div>
        <div class="case-block">
          <strong>Решение</strong>
          <p>${item.solution || ''}</p>
        </div>
        <div class="case-block">
          <strong>Результат</strong>
          <p>${item.result || ''}</p>
        </div>
        <ul class="metrics-list">
          ${(item.metrics || []).map((metric) => `<li>${metric}</li>`).join('')}
        </ul>
      </div>
    </article>
  `).join('');
}

function renderTestimonials() {
  const container = document.getElementById('testimonials-grid');
  if (!container || !Array.isArray(siteData?.testimonials)) return;

  container.innerHTML = siteData.testimonials.map((item) => `
    <article class="card testimonial-card glow-border">
      <div class="testimonial-top">
        <div>
          <h3>${item.name}</h3>
          <span class="meta">${item.company || 'Клиент'}</span>
        </div>
      </div>
      <p>${item.text}</p>
    </article>
  `).join('');
}

function renderFaq() {
  const container = document.getElementById('faq-list');
  if (!container || !Array.isArray(siteData?.faq)) return;

  container.innerHTML = siteData.faq.map((item, index) => `
    <article class="card faq-card">
      <div class="service-top">
        <h3>${item.q}</h3>
        <span class="meta">#${index + 1}</span>
      </div>
      <p>${item.a}</p>
    </article>
  `).join('');
}

function populateServiceOptions() {
  const selects = document.querySelectorAll('[data-service-select]');
  if (!selects.length || !Array.isArray(siteData?.services)) return;

  const optionsHtml = ['<option value="">Выберите услугу</option>']
    .concat(siteData.services.map((service) => `<option value="${service.title}">${service.title}</option>`))
    .join('');

  selects.forEach((select) => {
    select.innerHTML = optionsHtml;
  });
}

function saveLeadLocally(formData) {
  const leads = getLeads();

  const lead = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    status: 'new',
    name: formData.name,
    phone: formData.phone,
    company: formData.company || '',
    service: formData.service || 'Не указано',
    channel: formData.channel || 'Телефон',
    comment: formData.comment || '',
    page: formData.page || document.title
  };

  leads.push(lead);
  saveLeads(leads);
  return lead;
}

function getLeadSuccessMessage(syncResult) {
  const settings = getCloudSettings();
  if (syncResult?.cloudSaved) {
    return settings.telegramEnabled
      ? 'Заявка отправлена: сохранена в облаке и отправлено уведомление в Telegram.'
      : 'Заявка отправлена и сохранена в облаке.';
  }
  return `Заявка сохранена локально на ${TEMP_RETENTION_DAYS} дней.`;
}

function setupLeadForms() {
  const forms = document.querySelectorAll('.js-lead-form');
  if (!forms.length) return;

  forms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = Object.fromEntries(new FormData(form).entries());
      if (!formData.name || !formData.phone) {
        showToast('Заполните имя и телефон.');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;

      try {
        const lead = saveLeadLocally(formData);
        const syncResult = await syncLeadEverywhere(lead).catch((error) => {
          console.error(error);
          return null;
        });

        form.reset();
        populateServiceOptions();
        showToast(getLeadSuccessMessage(syncResult));
        renderStorageNote();
      } catch (error) {
        console.error(error);
        showToast('Не удалось сохранить заявку.');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
}

function renderStorageNote() {
  const updatedEl = document.getElementById('local-updated-at');
  if (!updatedEl) return;

  const leads = getLeads();
  const settings = getCloudSettings();

  if (settings.useCloud) {
    updatedEl.textContent = leads.length
      ? `Локальный резерв: ${leads.length} заявок. Последняя локальная копия: ${formatDate(leads[leads.length - 1].createdAt)}.`
      : 'Облачное сохранение подключено. Локальный резерв включён на случай сбоя сети.';
    return;
  }

  updatedEl.textContent = leads.length
    ? `Локально сохранено заявок: ${leads.length}. Последняя заявка: ${formatDate(leads[leads.length - 1].createdAt)}`
    : 'Пока заявок нет. Они будут храниться локально в браузере.';
}

function renderCloudBadges() {
  const settings = getCloudSettings();
  document.querySelectorAll('[data-retention-days]').forEach((el) => {
    el.textContent = TEMP_RETENTION_DAYS;
  });

  const notes = document.querySelectorAll('[data-cloud-mode]');
  notes.forEach((el) => {
    el.textContent = settings.useCloud
      ? 'Облако Supabase подключено. Заявки доступны с разных устройств.'
      : 'Пока включено только локальное временное хранение в браузере.';
  });
}

async function renderPage() {
  await loadSiteData();
  if (!siteData) return;

  renderHero();
  renderCompany();
  renderAbout();
  populateServiceOptions();

  if (Array.isArray(siteData.services)) {
    renderServices('services-grid', siteData.services.slice(0, 6), true);
    renderServices('servicesGridFull', siteData.services);
  }

  if (Array.isArray(siteData.cases)) {
    renderCases('cases-preview-grid', siteData.cases.slice(0, 3));
    renderCases('casesGrid', siteData.cases);
  }

  renderTestimonials();
  renderFaq();
  renderCloudBadges();
  setupLeadForms();
  renderStorageNote();
}

document.addEventListener('DOMContentLoaded', renderPage);

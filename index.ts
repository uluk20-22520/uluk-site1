Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const body = await request.json();
    const lead = body?.lead || {};

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!botToken || !chatId) {
      return json({ ok: false, message: 'Telegram secrets are missing' }, 400);
    }

    const text = [
      'Новая заявка с сайта',
      '',
      `Имя: ${lead.name || '—'}`,
      `Телефон: ${lead.phone || '—'}`,
      `Компания: ${lead.company || '—'}`,
      `Услуга: ${lead.service || '—'}`,
      `Канал: ${lead.channel || '—'}`,
      `Страница: ${lead.page || '—'}`,
      `Комментарий: ${lead.comment || '—'}`,
      `Дата: ${lead.createdAt || lead.created_at || new Date().toISOString()}`
    ].join('\n');

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    const result = await response.json();
    return json({ ok: response.ok, result }, response.ok ? 200 : 500);
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json'
    }
  });
}

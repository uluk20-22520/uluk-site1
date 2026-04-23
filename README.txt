# ULUK site — версия с Supabase и Telegram

## Что уже сделано
- улучшен дизайн всех страниц;
- добавлены услуги и кейсы;
- формы заявок работают;
- роли в админке:
  - admin / admin123
  - viewer / viewer123
- админ может редактировать контент, услуги, кейсы, отзывы и FAQ;
- viewer может только смотреть заявки;
- заявки всегда сохраняются в localStorage как резерв;
- если включить Supabase, заявки также пишутся в облако;
- если включить Telegram, после сохранения заявки уходит уведомление через Edge Function.

## Как настроить облако, чтобы заявки были видны с разных телефонов

### 1. Создайте проект в Supabase
После создания проекта откройте:
- Project URL
- anon / publishable key

### 2. Выполните SQL
Откройте SQL Editor и выполните файл:
- SUPABASE_SETUP.sql

Это создаст таблицу public.leads.

### 3. Заполните cloud-config.js
Откройте файл cloud-config.js и вставьте свои значения:

window.ULUK_CLOUD_CONFIG = {
  useCloud: true,
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  tableName: 'leads',
  telegramEnabled: false,
  telegramFunctionName: 'telegram-notify',
  localFallback: true
};

После этого сайт на любом устройстве будет писать заявки в одну и ту же базу.

### 4. Загрузите сайт на хостинг
Когда cloud-config.js уже заполнен, разместите сайт на хостинге.
Теперь:
- заявка, отправленная с телефона клиента,
- попадёт в Supabase,
- и будет видна в admin.html с другого телефона.

## Настройка Telegram

### 1. Создайте бота
Создайте бота через @BotFather и получите token.

### 2. Узнайте chat_id
Добавьте бота в нужный чат или напишите ему и получите chat_id.

### 3. Задеплойте функцию
Используйте папку:
- supabase/functions/telegram-notify

### 4. Добавьте secrets в Supabase
Нужны secrets:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

### 5. Включите Telegram в cloud-config.js
Поменяйте:
- telegramEnabled: true

## Настройки через админку
В admin.html есть вкладка "Supabase и Telegram".
Там можно сохранить настройки локально для текущего браузера.
Это удобно для тестов.

Но для всех устройств нужно обязательно заполнить cloud-config.js в самом проекте.

## Важное замечание по безопасности
Файл SUPABASE_SETUP.sql сейчас настроен в "простом режиме" для статического сайта:
- anon key может читать, менять и удалять заявки.

Это сделано специально, чтобы проект работал быстро и без тяжёлого backend.
Для боевого production лучше вынести чтение/изменение заявок в Edge Functions и закрыть прямой доступ policy.

# ARCMET Backend

## Запуск (локально)

1) Установи MongoDB и запусти локально.
2) В папке `backend`:
- `npm i`
- скопируй `.env.example` -> `.env` и заполни
- `npm run dev`

Backend по умолчанию: `http://localhost:3001`

## API

- `GET /api/catalog` — каталог для сайта (только товары в наличии)
- `POST /api/leads/email` — заявка с главной
- `POST /api/orders/email` — заявка из корзины

Admin:
- `POST /api/admin/login` — пароль из `.env`
- `GET /api/admin/catalog` — все товары
- `POST /api/admin/import/excel` — импорт Excel (multipart/form-data, поле `file`)
- `POST /api/admin/purge-all` — полностью очистить БД (нужен `ADMIN_PURGE_PASSWORD` и `confirmText=DELETE_ALL`)
- `POST /api/admin/products` — добавить вручную
- `PATCH /api/admin/products/:id` — обновить (цена/наличие/и т.д.)
- `DELETE /api/admin/products/:id` — удалить

Переменные окружения:
- `ADMIN_PURGE_PASSWORD` — отдельный пароль для полного удаления данных. По умолчанию: `ArcmetPurge!2026#FullReset`

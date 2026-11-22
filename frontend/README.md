# BitPanel Admin Frontend

Vue 3 + TypeScript frontend for the BitPanel admin route. The production build writes to `frontend/dist`; the Docker build copies that output to `/www/public/assets/admin`. Requests continue through the existing Caddy-to-Octane-to-Laravel pipeline, which serves assets from Laravel's `public` directory.

## Local development

```sh
npm ci
npm run dev
```

The Vite dev server proxies `/api` and `/admin` requests to `http://127.0.0.1:8000`.

## Production build

```sh
npm run build
```

Vite emits `frontend/dist/manifest.json`; Docker copies it into `public/assets/admin/manifest.json`, which the Blade admin entry reads. Locale files are included under `frontend/dist/locales` and loaded by the Blade template.

## Migration status

The checked-in legacy admin bundle is a compiled React build without source maps. Its UI copy and navigation were used as reconstruction references; original React component source cannot be recovered exactly. The shell, admin login, live dashboard statistics/rankings/queue status, grouped system settings, and API-backed lists for the existing admin modules are migrated. User generation/editing, selected-user ban/mail and CSV export, node and plan create/edit/delete/sort forms, plan period pricing and existing-user synchronization, machine/group/route CRUD, machine token/install/history actions, order detail/assignment/payment/cancel/commission actions, system status/audit/failed-job views, mail-template editing/test/reset, test email and Telegram webhook actions are available. Node editors expand protocol-specific fields for the supported server types, including transport, TLS/ECH, Reality, multiplex, and protocol options; an advanced JSON field remains for settings without dedicated controls. Dashboard revenue range selection supports 7/14/30 days but does not yet match all legacy chart visualizations. The explicitly deferred plugin/theme workflows, ticket conversation detail, announcement/payment/knowledge/coupon/gift-card workflows, and broader all/filtered user bulk workflows remain incomplete; no mock records are used.

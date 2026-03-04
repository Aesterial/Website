# Техническая документация проекта Aesterial

Дата подготовки: 22 февраля 2026  
Репозиторий: `E:\Development\Aesterial-Website`

## 1. Назначение документа

Документ описывает текущее техническое устройство системы Aesterial:
- архитектуру и состав сервисов;
- структуру монорепозитория;
- серверные API и модель данных;
- требования к окружению, запуску, сборке и развертыванию;
- эксплуатационные особенности и технические риски.

## 2. Обзор системы

Aesterial — платформа «Город идей» для публикации и обсуждения инициатив по развитию городской среды.  
Основные пользовательские сценарии:
- регистрация и авторизация (включая 2FA/TOTP и VK OAuth);
- создание и просмотр проектов с геоданными и медиа;
- голосование/лайки и обсуждение проектов;
- обращения в поддержку (tickets);
- административные сценарии модерации, управления ролями и публикациями;
- уведомления, статистика, режим технических работ.

## 3. Архитектура решения

## 3.1 Логическая схема

1. Клиент (браузер) открывает фронтенд на Next.js.
2. Reverse proxy (`Caddy`) маршрутизирует:
   - `/api/*` в backend;
   - остальные запросы во frontend.
3. Backend на Go обслуживает:
   - gRPC API;
   - REST API через gRPC-Gateway;
   - gRPC-web для веб-клиента.
4. Backend работает с:
   - PostgreSQL (основные данные);
   - S3-совместимым хранилищем (медиа/аватары, presign URL);
   - почтовым прокси (`mail-proxy`) по gRPC.

## 3.2 Технологический стек

- Frontend: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4.
- Backend: Go 1.26, gRPC, grpc-gateway, pgx, AWS SDK v2 (S3).
- Database: PostgreSQL (в docker-окружении используется `postgres:16`).
- Edge/Ingress: Caddy 2.
- Дополнительно: отдельный gRPC сервис `mail-proxy`.

## 3.3 Транспорт и протоколы

- Внешний веб-трафик: HTTP/HTTPS через Caddy.
- API для web-клиента: REST (`/api/...`) через gRPC-Gateway.
- Внутренний backend API: gRPC и gRPC-web.
- Межсервисная почтовая интеграция: gRPC (`mail-proxy`), авторизация по токену.

## 4. Структура репозитория

## 4.1 Корневой уровень

- `backend/` — Go workspace.
- `frontend/web/` — Next.js приложение.
- `docker-compose.yml` — production-like compose с Caddy.
- `docker-compose-new.yml` — compose с локальным Postgres.
- `docker-compose.build.yml` — сборка Docker-образов.
- `stack.yml` — стек для Docker Swarm.
- `Caddyfile` — правила reverse proxy.
- `run.bat` — Windows-скрипт для быстрого локального запуска.

## 4.2 Backend workspace

`backend/go.work` включает:
- `./internal` — доменная и прикладная логика;
- `./starter` — основной entrypoint backend;
- `./mail-proxy` — отдельный сервис отправки почты.

Основные подсистемы `backend/internal`:
- `app/` — use case слой;
- `domain/` — доменные модели/контракты;
- `infra/` — DB, gRPC-сервер, логирование;
- `proto/` — gRPC контракт и HTTP-аннотации;
- `gen/` — сгенерированный код protobuf/gateway;
- `migrations/` — SQL-запросы/генерация sqlc.

## 4.3 Frontend

`frontend/web`:
- `app/` — маршруты App Router (26 страниц);
- `components/` — UI и провайдеры состояния;
- `lib/` — API-клиент и вспомогательная логика;
- `styles/`, `app/globals.css` — глобальные стили;
- `public/` — статика;
- `proxy.ts` — edge/proxy middleware.

## 5. Backend: сервисная архитектура

## 5.1 Инициализация

Основной запуск (`backend/starter/start.go`):
1. Загрузка конфигурации из окружения (`internal/app/config`).
2. Подключение к PostgreSQL (`internal/infra/db/connection.go`).
3. Инициализация репозиториев.
4. Создание прикладных сервисов (`app/*`).
5. Регистрация gRPC-сервисов (11 сервисов).
6. Поднятие HTTP/gRPC обработчика (можно на одном или на разных портах).
7. Поддержка TLS (опционально).
8. Graceful shutdown по `SIGTERM`/`Ctrl+C`.

## 5.2 Зарегистрированные gRPC сервисы

- `LoginService`
- `UserService`
- `StatisticsService`
- `ProjectService`
- `StorageService`
- `RanksService`
- `SubmissionsService`
- `MaintenanceService`
- `TicketsService`
- `CheckerService`
- `NotificationService`

## 5.3 REST API (gRPC-Gateway)

Ниже — основные группы REST endpoints из `.proto` контрактов:

- Авторизация (`LoginService`):
  - `POST /api/login/authorization`
  - `POST /api/login/register`
  - `POST /api/login/logout`
  - `POST /api/login/2fa/setup|confirm|check`
  - `POST /api/login/verify-email/start|verify-email`
  - `POST /api/login/reset-password/start|reset-password`
  - `GET /api/login/check`

- Пользователи (`UserService`):
  - `GET /api/user`, `GET /api/user/{userID}`, `GET /api/user/list`
  - `GET /api/user/sessions`, `POST /api/user/sessions/revoke/{id}`
  - `POST /api/user/{userID}/ban|unban`
  - `PATCH /api/user/change/name/{name}`
  - `PATCH /api/user/change/description/{description}`
  - `POST /api/user/avatar`

- Проекты (`ProjectService`):
  - `GET /api/projects`, `/api/projects/{id}`, `/api/projects/top`, `/api/projects/categories`
  - `POST /api/projects/create`
  - `PATCH /api/projects/{id}/name/{to}`
  - `PATCH /api/project/{id}/description/{to}`
  - `POST /api/projects/like/{id}`
  - Обсуждения: `/api/projects/{id}/discussion/*`

- Модерация и платформенные сервисы:
  - `SubmissionsService`: `/api/submissions/*`
  - `TicketsService`: `/api/tickets/*`
  - `RanksService`: `/api/ranks/*`
  - `StatisticsService`: `/api/statistics/*`
  - `MaintenanceService`: `/api/maintenance/*`
  - `NotificationService`: `/api/notifications/*`
  - `StorageService`: `/api/storage/presign/*`
  - `CheckerService`: `GET /api/health`

Полный OpenAPI снапшот расположен в `backend/gen/openapi/openapi.yaml`.

## 5.4 CORS и HTTP обработка

HTTP слой (`backend/starter/http.go`) поддерживает:
- CORS с whitelist/`*` из `CORS_ALLOWED_ORIGINS`;
- preflight `OPTIONS`;
- grpc-web;
- проброс trace-id в `x-trace-id`;
- логирование входящих/исходящих запросов.

## 5.5 Tracing и логирование

`internal/infra/grpcserver/tracing.go`:
- для каждого gRPC-запроса генерируется `x-trace-id` (UUID);
- trace-id передается в metadata/headers;
- фиксируется начало/конец запроса и статус ответа.

## 6. Mail Proxy

Сервис `backend/mail-proxy`:
- gRPC endpoint по умолчанию `:50051` (`GRPC_ADDR`);
- метод `SendEmail`;
- обязательная проверка `MAIL_PROXY_AUTH_TOKEN`;
- отправка через SMTP (`SMTP_*`);
- health-check сервис gRPC;
- graceful shutdown.

Используется как выделенный адаптер отправки почты, вызываемый backend-сервисом.

## 7. Frontend: ключевые элементы

## 7.1 Маршрутизация (App Router)

Основные маршруты:
- `/`, `/account`, `/suggest`, `/voting`, `/technics`, `/auth`, `/banned`
- `/projects/[id]`, `/users/[id]`
- `/support`, `/support/[id]`, `/support/history`, `/support/queue`
- `/login/*` (verify/reset-password/email-verify/vk-callback)
- `/admin/*` (users, support, submissions, maintenance)

## 7.2 Глобальные провайдеры

В `app/layout.tsx` подключаются:
- `AuthProvider`
- `LanguageProvider`
- `ThemeProvider`
- `NotificationsProvider`
- `MaintenanceBanner`
- `MfaRequiredDialog`

## 7.3 API-клиент фронтенда

`frontend/web/lib/api.ts`:
- единая функция `apiRequest` с `credentials: include`;
- унификация ошибок и выделение сценариев:
  - бан пользователя;
  - обязательная MFA-проверка;
- поддержка профиля, проектов, тикетов, уведомлений, рангов, статистики, техработ.

`frontend/web/lib/api-base.ts`:
- приоритет `NEXT_PUBLIC_API_BASE_URL`;
- dev fallback: `http://127.0.0.1:8080`;
- в production форсируется `https`.

## 7.4 Proxy/middleware

`frontend/web/proxy.ts`:
- проверка авторизации через `GET /api/login/check`;
- проверка режима техработ через `/api/maintenance/active`;
- редиректы на `/technics` при активном maintenance;
- защита server actions через `NEXT_ALLOW_SERVER_ACTIONS`.

## 8. Модель данных (PostgreSQL)

Базовая схема определяется в `backend/migrations/schema/init.sql`.

Количество таблиц: 24.

Ключевые таблицы:
- `users`, `sessions`, `oauth`, `bans`, `banned_emails`
- `ranks`, `rank_activations`
- `projects`, `project_photos`, `project_likes`, `project_messages`
- `submissions`
- `tickets`, `ticket_messages`
- `notifications`, `notification_receipts`
- `maintenance`
- `statistics_recap`
- `events`
- `auth_action_tokens`
- `pictures`, `user_avatars`
- `seed_credentials`

Особенность схемы:
- активно используются composite types и enum-типы для прав доступа/структур полей.

## 9. Объектное хранилище (S3-совместимое)

`internal/app/storage/service.go`:
- обязательный параметр: `STORAGE_BUCKET`;
- операции: presign GET/PUT, HEAD, DELETE, list;
- ключи:
  - аватары: `avatars/{userID}/{picID}`;
  - проектные фото: `photos/{projectID}/{...}`;
- TTL presign: `STORAGE_PRESIGN_TTL_SECONDS` (дефолт 900 сек).

## 10. Конфигурация и переменные окружения

## 10.1 Backend (основные группы)

- БД:
  - `DATABASE_URL`
  - или `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Сеть и порты:
  - `START_PORT`, `START_GRPC_PORT`, `START_HTTP_PORT`
- TLS:
  - `TLS_USE`, `TLS_CERT_PATH`, `TLS_KEY_PATH`
- Cookie/CORS:
  - `COOKIES_NAME`, `COOKIES_SECRET`, `COOKIES_DOMAIN`, `COOKIES_SAMESITE`, `COOKIES_SECURE`
  - `CORS_ALLOWED_ORIGINS`
- S3:
  - `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`
  - `STORAGE_USE_SSL`, `STORAGE_FORCE_PATH_STYLE`, `STORAGE_PRESIGN_TTL_SECONDS`
- Почта:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_SECURE`, `SMTP_STARTTLS`
  - `MAIL_PROXY_ADDR`, `MAIL_PROXY_TLS`, `MAIL_PROXY_SERVER_NAME`, `MAIL_PROXY_INSECURE_SKIP_VERIFY`
  - `MAIL_PROXY_DIAL_TIMEOUT_SECONDS`, `MAIL_PROXY_REQUEST_TIMEOUT_SECONDS`, `MAIL_PROXY_AUTH_TOKEN`
- OAuth VK:
  - `VK_CLIENT_ID`, `VK_CLIENT_SECRET`, `VK_REDIRECT_URI`, `VK_SUCCESS_REDIRECT_URL`
- Прочее:
  - `ASYNC_*`, `URL_MAIN`, `URL_PRIVACY`, `URL_SUPPORT`
  - `GEOCODE_PROVIDER`, `GEOCODE_USER_AGENT`, `GEOCODE_CONTACT_EMAIL`, `GEOCODE_RATE_LIMIT_MS`

## 10.2 Frontend

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_ALLOW_SERVER_ACTIONS`

## 10.3 Mail Proxy

- `GRPC_ADDR` (дефолт `:50051`)
- `MAIL_PROXY_AUTH_TOKEN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_REPLY_TO`
- `SMTP_SECURE`, `SMTP_STARTTLS`
- `SMTP_DIAL_TIMEOUT`, `SMTP_SEND_TIMEOUT`

## 11. Сборка, запуск, деплой

## 11.1 Локальная разработка

Frontend (`frontend/web`):
- `npm install`
- `npm run dev`
- `npm run lint`
- `npm run build`

Backend:
- `cd backend && go work sync`
- `cd backend/starter && go run .`
- тесты: `go test ./...` (в `backend/internal` и/или `backend/starter`)

Windows helper:
- `run.bat` открывает отдельные окна для frontend/backend.

## 11.2 Генерация артефактов

- Proto/gateway:
  - `backend/generate-proto.ps1`
- SQLC:
  - `backend/internal/generate-sqlc.ps1`

## 11.3 Docker

- Сборка образов:
  - `docker compose --profile build-only -f docker-compose.yml -f docker-compose.build.yml build`
- Runtime (production-like):
  - `docker-compose.yml` + `Caddyfile`
- Локально с PostgreSQL:
  - `docker-compose-new.yml`
- Swarm:
  - `stack.yml`

## 12. Безопасность

- CORS контролируется переменной `CORS_ALLOWED_ORIGINS`.
- Cookie + session модель используется на API-клиенте (`credentials: include`).
- Поддержана MFA (TOTP) и recovery-коды.
- Почтовый прокси защищен токеном (`MAIL_PROXY_AUTH_TOKEN`).
- Поддерживается TLS на backend и HTTPS на edge (Caddy/Let's Encrypt).

## 13. Наблюдаемость и эксплуатация

- Трассировка запросов: `x-trace-id`.
- Логирование gRPC и HTTP запросов/ответов.
- Endpoint здоровья: `GET /api/health`.
- Механизм maintenance:
  - backend API `/api/maintenance/*`;
  - frontend-редиректы в `/technics`.

## 14. Технические примечания

1. В `frontend/web/next.config.mjs` включен `typescript.ignoreBuildErrors = true`, что снижает строгость CI-сборок фронтенда.
2. В `README.md` указан Go 1.25.5, но рабочие модули (`go.mod`, `go.work`) уже на Go 1.26.
3. Фронтенд содержит несколько fallback/legacy маршрутов API (например для challenge/login и части ticket/project сценариев), что важно учитывать при регрессионном тестировании API.
4. Источник истины для REST-маршрутов — `.proto` контракты в `backend/internal/proto/*/*.proto`; `backend/gen/openapi/openapi.yaml` полезен как снапшот и может требовать сверки после изменений контрактов.

## 15. Рекомендации по сопровождению

1. Добавить отдельный CI шаг `npm run typecheck` и отключить `ignoreBuildErrors` в production pipeline.
2. Зафиксировать единую матрицу версий (Go/Node) в README и CI.
3. Поддерживать versioning API (например `/api/v1`) перед расширением публичных контрактов.
4. Описать и автоматизировать миграции БД в отдельном operational runbook.


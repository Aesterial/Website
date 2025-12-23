<h1 align="center">Ascendant</h1>

<p align="center">
  <img src="./.github/assets/logo.svg" width="120" alt="Ascendant">
</p>

<h3 align="center">Ascendant · Основной репозиторий</h3>

<p align="center">
  🏙️ «ГОРОД ИДЕЙ» — современный цифровой инструмент, который помогает жителям <b>предлагать идеи</b>, <b>оценивать проекты</b> и <b>формировать совместное видение</b> будущего города
</p>

<p align="center">
  <a href="#-о-проекте">О проекте</a> ·
  <a href="#-возможности">Возможности</a> ·
  <a href="#-архитектура">Архитектура</a> ·
  <a href="#-быстрый-старт">Быстрый старт</a> ·
  <a href="#-команды">Команды</a> ·
  <a href="#-окружение--конфиг">Окружение</a> ·
</p>

<p align="center">
  <a href="LICENSE">
    <img alt="License" src="https://img.shields.io/badge/License-MIT-2ea44f">
  </a>
  <a href="https://github.com/4scendant/Website/actions">
    <img alt="CI" src="https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white">
  </a>
  <a href="https://go.dev/">
    <img alt="Go" src="https://img.shields.io/badge/Go-1.25.5-00ADD8?logo=go&logoColor=white">
  </a>
  <a href="https://kit.svelte.dev/">
    <img alt="SvelteKit" src="https://img.shields.io/badge/SvelteKit-Vite-FF3E00?logo=svelte&logoColor=white">
  </a>
</p>

---

## 📚 О проекте

**Ascendant** — проект для участия в **J-cup.fm** по задаче:

> **«ГОРОД ИДЕЙ: ИНТЕРАКТИВНАЯ КАРТА ПРЕДЛОЖЕНИЙ ЖИТЕЛЕЙ»**  
> Решения в области развития городской среды и цифрового взаимодействия с жителями.  
> Цель: создать современный цифровой инструмент, который позволит жителям участвовать в развитии городской среды, предлагать идеи, оценивать проекты и формировать совместное видение будущего города.

---

## ✨ Возможности

- 🗺️ **Интерактивная карта идей**: публикация предложений с геопривязкой
- 🧩 **Карточка предложения**: описание, фото, категории, статус, обсуждение
- ⭐ **Оценка и поддержка**: лайки/рейтинги/голосование (в зависимости от правил)
- 🧭 **Фильтры и поиск**: район, категории, популярность, актуальность, статус
- 🧑‍🤝‍🧑 **Цифровое взаимодействие**: комментарии, модерация
- 📊 **Аналитика** (по мере развития): срезы по районам/категориям, тренды, топ-идеи

---

## 🧱 Архитектура

Монорепозиторий для веба и бэкенда.

- 🌐 **Web**: SvelteKit + Vite, TypeScript, SSR-ready
  `frontend/web`
- ⚙️ **Backend**: Go workspace (`backend/go.work`)
  `backend/internal` (domain/app/infra/shared) + `backend/starter`

---

## 🗂️ Структура проекта

```text
backend/            Go workspace (internal packages + starter entry)
frontend/web/       SvelteKit app (src/routes, src/lib, static)
.github/            CI configuration + assets
```

---

## ✅ Требования

- **Node 20+** и **npm** (веб)
- **Go 1.25.5** (бэкенд, как в `go.work`)

---

## 🚀 Быстрый старт

Клонирование:
```sh
git clone https://github.com/4scendant/Website.git
cd Website
```

### Web
```sh
cd frontend/web
npm install
npm run dev
```

### Backend
```sh
cd backend
go work sync
```

---

## 🧰 Команды

### Web
- `npm run dev` — dev-сервер
- `npm run build` — сборка
- `npm run preview` — предпросмотр сборки
- `npm run check` — диагностика Svelte + TS

### Backend
- `go test ./...` (внутри `backend/internal` или `backend/starter`, когда появятся тесты)

---

## 🧪 Тестирование

- Web: `npm run check`, далее `*.spec.ts` (Vitest/Playwright) по мере расширения покрытия
- Backend: табличные Go-тесты рядом с пакетами (пример: `internal/app/auth/auth_test.go`)

---

## 🔐 Окружение & конфиг

- Web: `.env` в `frontend/web` (по соглашениям Vite)
- Backend: конфигурация — в `backend/internal/infra` по мере добавления компонентов

---

## 🧾 Git и стиль коммитов

Шаблон:
```text
<type>(<scope>): <summary>
```

- Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `build`, `ci`, `perf`, `revert`
- Scopes: `web`, `backend-<pkg>` (например `backend-app`) или `repo`

Примеры:
- `feat(web): add idea map filters`
- `chore(backend-domain): add user repo interface`


## 📄 Лицензия

MIT — подробности в `LICENSE`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agendamento is a Google Calendar clone built with React 19, TypeScript, and Vite. It's a client-side-only application (no backend API) that persists data to browser localStorage. The entire UI is in Portuguese.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # TypeScript type-check + Vite production build (output: dist/)
npm run lint      # ESLint across all .ts/.tsx files
npm run preview   # Preview production build locally
```

There are no tests configured in this project.

## Architecture

### State Management — Decoupled React Contexts

The app uses 5 focused React Contexts (not Redux), wrapped by a barrel `CalendarProvider` for backwards compatibility:

| Context | Hook | Responsibility |
|---------|------|----------------|
| `ThemeContext` | `useTheme()` | Light/dark mode, persists to localStorage (`calendar_theme`) |
| `ViewContext` | `useView()` | Current date, view type, selected date, sidebar toggle |
| `EventContext` | `useEvents()` | Event/calendar CRUD, search, filtered events (memoized) |
| `ModalContext` | `useModal()` | Modal and popover open/close state |
| `ToastContext` | `useToast()` | Toast notifications with undo support |

**`useCalendar()`** is a legacy convenience hook that merges all contexts. New code should prefer the individual hooks (`useTheme`, `useView`, `useEvents`, `useModal`) for better re-render isolation.

Provider nesting order (in `CalendarProvider`): Theme → View → Event → Modal. `ToastProvider` wraps `CalendarProvider` in `App.tsx`.

### Service Layer

`src/services/calendarService.ts` handles all localStorage persistence. All operations simulate 300ms async delay. Keys: `calendar_events`, `calendar_calendars`. Ships with 5 default calendars and 20 sample events.

### Event Operations Pattern

All CRUD operations in `EventContext` use **optimistic updates** — state is updated immediately, then the service call runs. On failure, state is rolled back. All operations return `{ success: boolean; error?: string }`.

### Calendar Views

`CalendarGrid.tsx` is a router component that renders the active view based on `ViewType`:
- `MonthView`, `WeekView` (also handles `4day` via prop), `DayView`, `YearView`, `AgendaView`

### Styling

- **CSS Modules** (`.module.css` per component) for scoped styles
- **CSS Variables** for theming, defined in `src/styles/global.css`
- Dark theme activated via `[data-theme='dark']` on document root
- Layout tokens: `--header-height: 64px`, `--sidebar-width: 256px`

### Key Types (`src/types.ts`)

- `ViewType`: `'day' | 'week' | 'month' | 'year' | 'agenda' | '4day'`
- `CalendarEvent`: Core event model with recurrence, reminders, guests, color
- `Calendar`: Calendar model with visibility toggle
- `RecurrenceRule`: Custom recurrence configuration (frequency, interval, end conditions)

### Deployment

Nginx serves static files from `dist/` on port 3000. `nginx.conf` includes CSP headers, gzip compression, and SPA fallback routing. JS/CSS cached 30 days; HTML never cached.

### Fluxo de Homologação → Deploy em Produção

Sempre que fizer alterações no código, siga este fluxo antes de fazer commit/push:

#### 1. Build de produção

```bash
cd /opt/agendamento/agendamento
npm run build    # tsc -b && vite build → gera dist/
```

Se houver erros de TypeScript, corrija antes de prosseguir.

#### 2. Encontrar porta livre para homologação

```bash
ss -tlnp | grep -E ':(4200|4201|4202|4300)'
```

Use a primeira porta livre entre essas (preferencialmente 4200).

#### 3. Subir servidor de homologação

```bash
nohup npx serve dist -l 4200 -s > /tmp/serve-homolog.log 2>&1 &
echo "PID: $!"
```

Confirme que está rodando:

```bash
ss -tlnp | grep ':4200'
```

Informe ao usuário: **`http://<ip-do-servidor>:4200`** para testar.

#### 4. Aguardar aprovação do usuário

Não faça commit/push até o usuário aprovar explicitamente. Aguarde o feedback.

#### 5. Após aprovação — Commit e Push

```bash
cd /opt/agendamento/agendamento
git add <arquivos-alterados>
git commit -m "$(cat <<'EOF'
Descrição concisa das alterações

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
git push
```

#### 6. Encerrar servidor de homologação

```bash
kill $(lsof -t -i:4200) 2>/dev/null || true
```

#### Resumo do fluxo

```
Alterações → npm run build → serve na porta 4200 → usuário testa → aprovação → commit + push → kill serve
```

**Importante:** O servidor de homologação (`npx serve`) é temporário e somente para preview. A produção é servida pelo Nginx na porta 3000 via Docker.

## Conventions

- Icons: `@phosphor-icons/react` (tree-shakeable)
- Dates: `date-fns` (immutable operations)
- IDs: `uuid` package
- TypeScript strict mode is enabled
- Recurrent event instances use compound IDs: `{originalId}_{dateISO}`

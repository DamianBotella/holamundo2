# X6 — UI Foxhole — diseño y wireframes

**Estado**: 📐 DRAFT (B40).
**Bloqueado por**: X3, X4, X5.
**Visión**: interfaz tipo videojuego Foxhole adaptada a estudio de arquitectura técnica.

---

## TL;DR

Dos vistas principales:

1. **Mapa Global** (`/`) — vista panorámica del portfolio. Cada proyecto = "ficha táctica" con indicador de fase, alertas, presupuesto, ubicación. Densidad alta de información.
2. **Zoom Táctico** (`/projects/{id}`) — drill-down de un proyecto. Pipeline de 13 agentes visible, timeline cronológico, alertas, oficios, materiales, presupuesto, todos los outputs en una sola pantalla operativa.

**Stack recomendado**: React 19 + Vite + TanStack Router/Query + Tailwind + shadcn/ui + lucide-react + recharts.

**Paleta**: oscura, técnica, militar — verdes oliva, ámbar para alertas, rojo para crítico, gris pizarra para superficies. Tipografía monospace para datos técnicos, sans-serif legible para narrativa.

**Estimación X6**: 3-4 semanas full-time para versión pilotable.

---

## 1. Inspiración Foxhole — qué tomamos

De Foxhole (videojuego):
- ✅ **Densidad alta de información** sin overwhelming. Datos discretos en HUD.
- ✅ **Mapa global con drill-down**. Click → zoom a sector.
- ✅ **Indicadores visuales de estado** (frente activo, recursos bajos, ataques).
- ✅ **Estética técnica/militar**: monospace, iconografía minimalista, paleta sobria.
- ✅ **Logística como ciudadana de primera**: en Foxhole los materiales y rutas son tan importantes como el combate. Aquí, los oficios y materiales son tan importantes como el diseño técnico.

NO tomamos:
- ❌ Real-time multi-jugador (no es un MMO).
- ❌ Combate / mecánicas de juego (esto es B2B SaaS).
- ❌ Audio ambiental (sería raro en una app de trabajo).

---

## 2. Mapa Global — pantalla `/`

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  ARQUITAI │ Estudio Damián Martínez │ 5 activos │ 2 críticos │ ⚙️ Damián │ Salir │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  KPIs:                                                                               │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┐   │
│  │ ACTIVOS     │ ALERTAS     │ APROBACIONES│ INGRESOS €  │ COSTE LLM (mes)     │   │
│  │   5         │   2 critico │   3 pending │   €245.000  │   $12.34            │   │
│  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────────────┘   │
│                                                                                      │
│  Filtros: [ Todos ▼ ]  [ Fase: cualquiera ▼ ]  [ Busca... ]                          │
│                                                                                      │
│  ┌──── Pipeline Phase Column View ────────────────────────────────────────────────┐ │
│  │                                                                                 │ │
│  │  intake (1)        briefing (1)      design (0)       analysis (1)   …         │ │
│  │ ┌──────────────┐  ┌──────────────┐                  ┌──────────────┐           │ │
│  │ │ Reforma      │  │ Lavapiés     │                  │ Bajo Embaj.  │           │ │
│  │ │ Vallecas     │  │ piso         │   (vacío)        │ piso         │           │ │
│  │ │ ─────────────│  │ ─────────────│                  │ ─────────────│           │ │
│  │ │ ⚠ 1 alert    │  │              │                  │ ⚠ 2 alerts   │           │ │
│  │ │ €45.000      │  │ €72.000      │                  │ €48.000      │           │ │
│  │ │ Madrid       │  │ Madrid       │                  │ Madrid       │           │ │
│  │ │ 3d ago       │  │ 1d ago       │                  │ 5d ago       │           │ │
│  │ └──────────────┘  └──────────────┘                  └──────────────┘           │ │
│  │                                                                                 │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  Feed de actividad reciente (últimas 24h):                                           │
│  ▸ 16:42 │ Reforma Vallecas     │ agent_briefing      │ pending review               │
│  ▸ 14:18 │ Lavapiés piso        │ agent_design        │ 3 design_options creadas    │
│  ▸ 11:05 │ Bajo Embaj.          │ agent_regulatory    │ 20 tareas detectadas        │
│  …                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Componentes

- **TopBar** (sticky): logo + studio name + counters + user menu.
- **DashboardKPIs**: 5 tarjetas con `data` de `/metrics/dashboard`. Cache 60s.
- **Filters**: dropdown estado + dropdown fase + búsqueda full-text. Sincroniza URL params.
- **PhaseColumnView**: Kanban-like, una columna por fase. Tarjetas (ProjectCard) draggables NO en MVP — sólo click para zoom.
- **ProjectCard**: 110×140 px. Muestra:
  - Nombre del proyecto (truncado).
  - Cliente.
  - Indicador de alertas (rojo si critical, ámbar si warning, gris si none).
  - Presupuesto target.
  - Ubicación (city).
  - Days since updated.
- **ActivityFeed**: lista timeline con icono por agent, timestamp, breve mensaje. Lee `/alerts/global` + `v_timeline` cross-projects (necesita endpoint nuevo).

### Endpoints consumidos

- `GET /api/v1/me` — para topbar.
- `GET /api/v1/metrics/dashboard` — KPIs.
- `GET /api/v1/projects?phase=...&q=...` — listado con filtros.
- `GET /api/v1/alerts/global?limit=10` — feed de actividad.

---

## 3. Zoom Táctico — pantalla `/projects/{id}`

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Volver │ Reforma Vallecas │ briefing_done │ 14d │ €45.000 │ ⚙️ Acciones ▼ │       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│ ┌─ Pipeline ───────────────────────────────────────────────────────────────────────┐│
│ │                                                                                   ││
│ │ [✓] intake   →   [✓] briefing   →   [⏳] design   →   [ ] analysis   →   [ ]…  ││
│ │                                                                                   ││
│ └───────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│ ┌─ Tabs ───────────────────────────────────────────────────────────────────────────┐│
│ │ [Resumen] [Briefing] [Diseño] [Normativa] [Materiales] [Costes] [Oficios]        ││
│ │ [Propuesta] [Plan] [Seguridad] [Accesibilidad] [Timeline] [Alertas] [Logs]       ││
│ └───────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│  Tab activa: Resumen                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │  Cliente: María García López                                                   │ │
│  │  Email: cliente@example.com                                                    │ │
│  │  Inmueble: piso 72m², Calle X, Vallecas, Madrid                                │ │
│  │  Tipo: reforma_integral                                                        │ │
│  │  Presupuesto target: €45.000                                                   │ │
│  │  Urgencia: normal                                                              │ │
│  │  Fase actual: briefing_done (avanzó hace 3h)                                   │ │
│  │  ─────────────────────────────────────────────────────────────────────────────│ │
│  │  Briefing v1 (estado: approved):                                                │ │
│  │   • Resumen: Reforma integral piso años 60. Apertura cocina-salón…              │ │
│  │   • Objetivos: 3 (apertura cocina, baño con ducha, suelo radiante)              │ │
│  │   • Restricciones: 2 (presupuesto ajustado, NO tocar techos)                    │ │
│  │   • Necesidades cliente: 4                                                      │ │
│  │   • Open questions: 3 (tipo suelo radiante, cata muro, presupuesto eficiencia) │ │
│  │  ─────────────────────────────────────────────────────────────────────────────│ │
│  │  Próxima fase: design (no iniciada). Estimado 2-3h cuando se dispare.           │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  Sidebar derecho (sticky):                                                           │
│  ┌── ALERTAS ────────────────────────┐                                                │
│  │ ⚠ Briefing pending architect      │                                                │
│  │   approval (3h)                   │                                                │
│  │ ✓ All regulatory low-priority     │                                                │
│  │ — Sin oficios asignados aún       │                                                │
│  └────────────────────────────────────┘                                                │
│                                                                                      │
│  ┌── ÚLTIMAS EJECUCIONES ────────────┐                                                │
│  │ agent_briefing  ✓ ok  $0.018  3h │                                                │
│  │ agent_design    ⏳ running  …    │                                                │
│  └────────────────────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Componentes

- **PhasePipeline**: barra horizontal con 11 estados. ✓ done, ⏳ running, [ ] pending, ⚠ blocked. Click en una fase con output → scroll a esa tab.
- **TabBar**: 14 tabs, virtualizada. Cada tab = componente lazy-loaded con su propio fetch.
- **ResumenTab**: meta del proyecto + briefing approved + summary de cada fase posterior.
- **BriefingTab**: viewer de la jsonb completa. Editable si hay revisión pendiente.
- **DiseñoTab**: 3 design_options en cards comparables. Botón "Seleccionar" si is_selected=false.
- **NormativaTab**: lista de 20+ regulatory_tasks con priority, status, citation_source clickeable.
- **MaterialesTab**: tabla de material_items con filtros por category, total estimado.
- **CostesTab**: cost_estimate con breakdown jsonb visualizado como tabla + chart bars.
- **OficiosTab**: trade_assignments + RFQs (trade_quotes) por estado.
- **PropuestaTab**: proposals con preview PDF generable.
- **PlanTab**: project_plan con Gantt simple (recharts).
- **SeguridadTab**: safety_plan con riesgos categorizados + botón export PDF (script existente).
- **AccesibilidadTab**: accessibility_audits con compliance status.
- **TimelineTab**: vertical timeline de v_timeline. Filtro por agent_name.
- **AlertasTab**: lista de v_alerts del proyecto + acción "marcar resuelta".
- **LogsTab**: tabla de v_agent_runs + cost por execution.
- **AlertSidebar** (sticky derecho): top 3-5 alertas activas + estado oficios + últimas ejecuciones.

### Endpoints consumidos

- `GET /api/v1/projects/{id}` — payload completo (project + briefing + design + …).
- `GET /api/v1/projects/{id}/timeline` — para tab Timeline.
- `GET /api/v1/projects/{id}/agent-runs` — para tab Logs.
- `GET /api/v1/projects/{id}/alerts` — para sidebar + tab Alertas.
- `POST /api/v1/projects/{id}/approve/{approval_id}` — para acciones.

---

## 4. Sistema de design

### Paleta (modo oscuro principal)

| Token | Hex | Uso |
|---|---|---|
| `--surface-0` | `#0F1418` | fondo de la página |
| `--surface-1` | `#161C22` | superficie de tarjetas |
| `--surface-2` | `#1F2730` | hover / elevación |
| `--border` | `#2A333D` | divisores |
| `--text-primary` | `#E8EBED` | texto principal |
| `--text-secondary` | `#A4B0BA` | texto secundario |
| `--text-tertiary` | `#6B7884` | texto deshabilitado |
| `--accent-primary` | `#7FA650` | verde oliva (Foxhole signature) — actions |
| `--accent-primary-hover` | `#92B85F` | hover verde |
| `--warn` | `#D4A24C` | ámbar — warnings |
| `--critical` | `#C25450` | rojo — críticos |
| `--info` | `#5A8FB8` | azul — info / neutral |
| `--success` | `#6BAE5C` | verde claro — done |

Modo claro: tokens equivalentes con luminosidad invertida.

### Tipografía

- **Sans-serif**: Inter Variable (texto narrativa, headings).
- **Monospace**: JetBrains Mono (datos técnicos, IDs, código, métricas).
- **Display**: Inter Variable Bold para titulares (`h1`/`h2`).

Escala de tamaños (rem):
- `xs` 0.75 / `sm` 0.875 / `base` 1 / `md` 1.125 / `lg` 1.25 / `xl` 1.5 / `2xl` 2 / `3xl` 2.5

Densidad: alta. Padding base 8px (no 16). Font-size base 14px. Line-height 1.4.

### Iconografía

- **lucide-react** como base.
- Iconos custom para los 13 agentes (en `public/icons/agents/`):
  - briefing → 📋 → SVG custom de clipboard.
  - design → 📐 → compass.
  - regulatory → ⚖️ → balance-scale.
  - materials → 🧱 → bricks-stack.
  - costs → 💰 → coins.
  - trades → 🔧 → wrench.
  - proposal → 📄 → document.
  - planner → 📅 → calendar-grid.
  - memory → 🧠 → brain.
  - safety_plan → 🦺 → vest.
  - accessibility → ♿ → wheelchair.

Todos en stroke-only, 1.5px, currentColor.

### Componentes core (shadcn/ui)

- `Button`, `Input`, `Select`, `Dialog`, `Tabs`, `Card`, `Badge`, `Tooltip`, `Toast`, `DropdownMenu`, `Popover`, `Sheet`.
- Custom: `ProjectCard`, `PhaseIndicator`, `AlertBadge`, `TimelineEvent`, `AgentRunRow`, `KpiTile`.

### Animaciones

Filosofía: pocas y rápidas. No nos sobra tiempo del usuario.
- Transiciones de hover: 150ms ease-out.
- Apertura de modales: 200ms.
- Cambio de tab: instantáneo (no slide).
- Skeleton loaders mientras se cargan datos (no spinners).

---

## 5. Stack frontend recomendado

| Capa | Decisión | Por qué |
|---|---|---|
| Framework | **React 19** | madurez, ecosistema, contratación |
| Build | **Vite 5** | dev speed > webpack |
| Routing | **TanStack Router** | type-safe, search params nativos |
| Data | **TanStack Query v5** | cache, refetch, suspense |
| Styling | **Tailwind CSS 3.4** | densidad de iteración alta |
| UI primitives | **shadcn/ui** | copy-paste customizable, no lock-in |
| Icons | **lucide-react** | tree-shakeable |
| Charts | **recharts** | barras + Gantt fácil |
| Forms | **react-hook-form** + **zod** | validación type-safe |
| Auth | **Supabase JS** o cookie + fetch | cookie httpOnly preferred |
| Date | **date-fns** | tree-shakeable, no moment |
| Types | **TypeScript 5.7** | obligatorio |
| Tests | **vitest** + **@testing-library/react** | rápido, integrado con Vite |
| E2E | **Playwright** | smoke tests del Foxhole |
| Deploy | **Vercel** o **Cloudflare Pages** | static SPA |

### Estructura de carpetas

```
foxhole-ui/
├── src/
│   ├── routes/              # TanStack Router
│   │   ├── __root.tsx
│   │   ├── index.tsx        # Mapa Global
│   │   ├── projects.$id.tsx # Zoom Táctico
│   │   └── login.tsx
│   ├── api/
│   │   ├── client.ts        # fetch wrapper con JWT
│   │   ├── projects.ts      # endpoints /projects
│   │   ├── auth.ts          # login/logout/refresh
│   │   └── types.ts         # generados desde api_v1.yaml via openapi-typescript
│   ├── components/
│   │   ├── ui/              # shadcn primitivos
│   │   ├── layout/          # TopBar, Sidebar
│   │   ├── project/         # ProjectCard, PhasePipeline, etc.
│   │   ├── tabs/            # ResumenTab, BriefingTab, …
│   │   └── alerts/          # AlertBadge, AlertSidebar
│   ├── hooks/
│   │   ├── useProjects.ts
│   │   ├── useProject.ts
│   │   └── useMetrics.ts
│   ├── lib/
│   │   ├── format.ts        # formatEur, formatDate, formatDuration
│   │   └── tokens.ts        # access_token storage
│   ├── styles/
│   │   ├── globals.css      # tailwind + tokens
│   │   └── tokens.css       # CSS vars
│   └── main.tsx
├── public/
│   └── icons/agents/        # 13 SVGs custom
├── tests/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── playwright.config.ts
```

---

## 6. Roadmap de implementación

### M1 — Foundation (~5 días)
- Setup Vite + React + TS + Tailwind + shadcn.
- TanStack Router con rutas básicas.
- Layout base (TopBar + main).
- Tokens CSS + dark mode.
- Login HTML que postea a `api_auth_login`.
- Generar types de OpenAPI (`api_v1.yaml`) → `src/api/types.ts`.

### M2 — Mapa Global (~5 días)
- KPIs tiles consumiendo `/metrics/dashboard`.
- PhaseColumnView con drag NO, click YES.
- ProjectCard.
- Filtros + URL params.
- ActivityFeed.
- E2E test: login → ver portfolio.

### M3 — Zoom Táctico (~7 días)
- PhasePipeline component.
- TabBar con 14 tabs lazy.
- 4 tabs prioritarias completas: Resumen, Briefing, Diseño, Normativa.
- AlertSidebar.
- E2E test: login → click proyecto → ver detalle → cambiar tab.

### M4 — Tabs restantes (~7 días)
- 10 tabs restantes: Materiales, Costes, Oficios, Propuesta, Plan, Seguridad, Accesibilidad, Timeline, Alertas, Logs.
- Acciones: aprobar, rechazar, marcar resuelta.
- Export PDF safety_plan via API.

### M5 — Polish + ship (~3 días)
- Skeleton loaders todos los componentes.
- Error boundaries.
- Empty states.
- Responsive (móvil = read-only optimizado).
- Lighthouse > 90.
- Deploy a Vercel.

**Total**: ~27 días = 5-6 semanas con un solo dev a tiempo completo.

---

## 7. Roles y permisos en UI

```ts
// Defense-in-depth — RLS sigue siendo la primaria
function canEdit(role: Role) { return role === 'architect' || role === 'super_admin'; }
function canApprove(role: Role) { return role === 'architect' || role === 'super_admin'; }
function canCreate(role: Role) { return role === 'architect' || role === 'super_admin'; }
function isReadOnly(role: Role) { return role === 'colaborador'; }
```

Si `role === 'colaborador'`:
- Botones "Crear proyecto", "Aprobar", "Editar" hidden.
- Banner sticky: "Acceso de sólo lectura".

Si `role === 'super_admin'`:
- Selector de tenant en TopBar.
- Permite cambiar `current_tenant` server-side (workflow `api_admin_switch_tenant`).
- Banner sticky: "Modo admin: viendo tenant {X}".

---

## 8. Accesibilidad

Targets:
- WCAG 2.1 AA.
- Contraste mínimo 4.5:1 en texto, 3:1 en UI.
- Tab order lógico.
- Aria-labels en iconos sin texto.
- Focus visible (no `outline: none` global).
- Soporte teclado: ESC cierra modales, Cmd+K palette de comandos.

---

## 9. Performance

Targets:
- First Paint < 1.5s en 3G simulada.
- Time to Interactive < 3s.
- Lighthouse Performance ≥ 90.

Estrategias:
- Code splitting por route.
- Tabs lazy-loaded (los 14 no se cargan a la vez).
- React.lazy + Suspense.
- TanStack Query con staleTime 60s para `/metrics/dashboard`.
- Imágenes lazy + WebP.
- No CSS-in-JS runtime (Tailwind compile-time).

---

## 10. Open questions para Damián

Antes de empezar M1:

1. **Dominio**: ¿`app.arquitai.com`? ¿`foxhole.arquitai.com`? Afecta cookies cross-domain con el backend.
2. **Tenant switch**: ¿super_admin necesita cambio rápido entre tenants en TopBar, o sólo desde admin panel separado?
3. **Mobile**: ¿read-only en mobile suficiente para v1, o read-write desde día 1?
4. **Tema claro**: ¿lo necesitamos o sólo oscuro? (Foxhole es oscuro nativo.)
5. **i18n**: ¿sólo español de momento o preparar i18n desde día 1?
6. **Branding**: ¿logo y nombre definitivos? ¿"ArquitAI" se queda?

---

## 11. Archivos a generar (cuando X6 efectivo arranque)

- Repo nuevo `foxhole-ui/` (no dentro de `studio-multiagente/` — son deployments separados).
- `studio-multiagente/docs/x6_foxhole_ui_log.md` — bitácora de decisiones de UI.
- `studio-multiagente/docs/x6_foxhole_smoke_test.md` — evidencia post-deploy.

---

## Referencias

- [api_v1.yaml](api_v1.yaml) — contrato que la UI consume.
- [x4_auth_design.md](x4_auth_design.md) — auth flow.
- [x3_multi_tenant_design.md](x3_multi_tenant_design.md) — RLS que la UI respeta.
- Foxhole game: https://www.foxholegame.com/
- shadcn/ui: https://ui.shadcn.com/
- TanStack Router: https://tanstack.com/router

# Foxhole UI — ArquitAI Frontend

UI tipo videojuego Foxhole adaptada a estudio de arquitectura técnica. Vista panorámica del portfolio + drill-down operativo por proyecto.

**Estado**: M1 Foundation ✅ (B55) — scaffolding + Layout + 2 páginas mock data.
**Bloqueado por**: X4 (Auth Supabase) + X5 (API REST) para conectar a backend real.

---

## Setup

```bash
cd studio-multiagente/foxhole-ui
npm install
npm run dev
# http://localhost:5173
```

Para conectar al backend cuando X4+X5 estén listos:
```bash
cp .env.example .env
# Editar .env con SUPABASE_URL y N8N_API_BASE
npm run dev
```

## Stack

- **Vite** 5 + **React** 19 + **TypeScript** 5.5
- **TanStack Router** (file-based routing)
- **TanStack Query** (data fetching + cache)
- **Tailwind CSS** 3.4 + **shadcn/ui** components
- **lucide-react** (iconos)
- **recharts** (gráficos)

## Estructura

```
src/
├── main.tsx                    # entry point
├── App.tsx                     # root component
├── index.css                   # Tailwind + design tokens Foxhole
├── lib/
│   ├── api.ts                  # cliente API (mock + real cuando X5 listo)
│   ├── auth.ts                 # mock auth (Supabase real cuando X4 listo)
│   ├── types.ts                # tipos TS de las views v_*
│   └── mock-data.ts            # data mockeada para development
├── components/
│   ├── TopBar.tsx              # sticky header
│   ├── DashboardKPIs.tsx       # 5 tarjetas KPI
│   ├── PhaseColumnView.tsx     # Kanban por fase
│   ├── ProjectCard.tsx         # ficha táctica
│   └── ActivityFeed.tsx        # feed actividad reciente
└── pages/
    ├── DashboardPage.tsx       # / mapa global
    └── ProjectDetailPage.tsx   # /projects/{id} zoom táctico
```

## Diseño Foxhole

Paleta:
- `bg-foxhole-bg` (#0e1014) — fondo principal
- `bg-foxhole-surface` (#1a1d23) — superficies elevadas
- `bg-foxhole-border` (#2a2e36) — bordes sutiles
- `text-foxhole-fg` (#e6e8eb) — texto primario
- `text-foxhole-muted` (#8b9099) — texto secundario
- `text-foxhole-accent` (#a3c46a) — verde oliva acento
- `text-foxhole-warning` (#d4a847) — ámbar alertas
- `text-foxhole-danger` (#cc4848) — rojo crítico

Tipografía:
- `font-mono` (`Berkeley Mono` o `JetBrains Mono`) — datos técnicos
- `font-sans` (`Inter`) — narrativa, formularios

## Estado actual

- ✅ Scaffolding M1 Foundation (todas las dependencias declaradas, `npm install` pendiente).
- ✅ Layout TopBar + KPIs + PhaseColumnView con mock data.
- ✅ Páginas Dashboard + ProjectDetail (placeholders).
- ✅ API client con mock fallback (cuando no hay backend).
- ⏳ Conectar a `/api/v1/*` real (post X5).
- ⏳ Login UI + flujo Supabase Auth (post X4).

## Próximos hitos

| M | Nombre | Esfuerzo |
|---|---|---|
| ✅ M1 | Foundation: scaffolding + design system | Hecho B55 |
| ⏳ M2 | Dashboard funcional con mock | 1d |
| ⏳ M3 | ProjectDetail completo (timeline + agent runs + alerts) | 2d |
| ⏳ M4 | Conectar API real (X5) + login (X4) | 1d |
| ⏳ M5 | Polish + responsive + a11y | 2d |

## Test manual sin backend

```bash
npm run dev
```

La app arranca con mock data. Verás:
- 4 proyectos de ejemplo distribuidos en columnas de fase.
- KPIs calculados sobre mock.
- Feed de actividad simulado.
- Click en proyecto → ProjectDetailPage placeholder.

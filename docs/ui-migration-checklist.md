# UI migration checklist

This document lists shadcn-based components imported from `@workspace/ui/components`, utilities from `@workspace/ui/lib/*`, and local `@/components` wrappers that appear in `apps/web`. It also notes core variants/props and the pages or shared components that currently use them.

## Component APIs (from `packages/ui`)

- **Button** (`buttonVariants`): supports `variant` (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and `size` (`default`, `sm`, `lg`, `icon`) plus optional `asChild`.【F:packages/ui/src/components/button.tsx†L7-L59】
- **Badge** (`badgeVariants`): `variant` options `default`, `secondary`, `destructive`, `outline`; accepts `asChild`.【F:packages/ui/src/components/badge.tsx†L7-L46】
- **Card**: structural slots `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent` with styling hooks only (no variants).【F:packages/ui/src/components/card.tsx†L5-L92】
- **Input**: styled text input with `data-slot="input"`, inherits standard input props.【F:packages/ui/src/components/input.tsx†L5-L18】
- **Label**: Radix label wrapper with shared spacing/disabled styles; accepts standard label props.【F:packages/ui/src/components/label.tsx†L7-L21】
- **Dropdown Menu**: exports `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent` (with `sideOffset`), item primitives including `DropdownMenuItem` (`variant` `default`/`destructive`, `inset`), checkbox/radio variants, labels, separators, shortcuts, submenus with triggers/content.【F:packages/ui/src/components/dropdown-menu.tsx†L9-L182】【F:packages/ui/src/components/dropdown-menu.tsx†L200-L238】
- **Sidebar suite**: `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton` (with `variant` `default`/`outline`, `size` `default`/`sm`/`lg` and optional `isActive`/`tooltip`), `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarSeparator`, `SidebarHeader`, `SidebarFooter`. Sidebar supports `side`, `variant` (`sidebar`/`floating`/`inset`), and `collapsible` (`offcanvas`/`icon`/`none`), with mobile sheet behavior and context via `useSidebar`.【F:packages/ui/src/components/sidebar.tsx†L43-L203】【F:packages/ui/src/components/sidebar.tsx†L204-L534】
- **Breadcrumb**: `Breadcrumb`, list/item/link/page, separators (default ChevronRight), ellipsis helper. No variants beyond optional `asChild` on links.【F:packages/ui/src/components/breadcrumb.tsx†L7-L84】
- **Tooltip**: `Tooltip`, `TooltipTrigger`, `TooltipContent` (`sideOffset`, arrow), `TooltipProvider` (`delayDuration`).【F:packages/ui/src/components/tooltip.tsx†L7-L42】
- **Separator**: simple styled divider (imported indirectly via sidebar).【F:packages/ui/src/components/separator.tsx†L1-L18】
- **Avatar**: `Avatar`, `AvatarImage`, `AvatarFallback` primitives.【F:packages/ui/src/components/avatar.tsx†L7-L36】
- **Skeleton**: single styled div for loading placeholders.【F:packages/ui/src/components/skeleton.tsx†L1-L10】
- **Collapsible**: Radix `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` wrappers.【F:packages/ui/src/components/collapsible.tsx†L5-L25】
- **Chart helpers**: `ChartContainer`, `ChartTooltipContent`, `ChartConfig`, plus Recharts re-exports (used for telemetry visuals). Tooltip supports `indicator` (`line`/`dot`/`dashed`), `hideLabel`, `hideIndicator`, `nameKey`, `labelKey`, `formatter`/`labelFormatter`.【F:packages/ui/src/components/chart.tsx†L8-L113】【F:packages/ui/src/components/chart.tsx†L114-L198】

Utilities: `calculateSpeed` from `@workspace/ui/lib/utils` is used for telemetry calculations in web code.【F:apps/web/lib/track-map/utils.ts†L2-L12】

## Usage in `apps/web/app` pages

- `(auth)/sign-in`: `Button`, `Input`, `Label` in login form.【F:apps/web/app/(auth)/sign-in/page.tsx†L1-L99】
- `(auth)/sign-up`: `Button`, `Input`, `Label` in registration form.【F:apps/web/app/(auth)/sign-up/page.tsx†L1-L38】
- `(auth)/layout`: `Card`, `CardContent` for auth layout container.【F:apps/web/app/(auth)/layout.tsx†L1-L15】
- `(main)/layout`: `SidebarProvider`, `SidebarInset` wrapping main shell.【F:apps/web/app/(main)/layout.tsx†L1-L19】
- `(main)/page` dashboard: `Button`, `Card` slots, `Badge` for overview CTA and stats cards.【F:apps/web/app/(main)/page.tsx†L1-L118】【F:apps/web/app/(main)/page.tsx†L121-L199】
- `(main)/laps/page`: `Card`, `CardContent`, `CardHeader`, `CardTitle` for lap summaries.【F:apps/web/app/(main)/laps/page.tsx†L1-L80】
- `(main)/laps/all/page`: `Card`, `CardContent`, `Button` for all laps view.【F:apps/web/app/(main)/laps/all/page.tsx†L1-L64】
- `(main)/laps/_components/filtered-laps-list`: `Card`, `CardContent` wrapping list items.【F:apps/web/app/(main)/laps/_components/filtered-laps-list.tsx†L4-L89】
- `(main)/laps/_components/lap-filters`: `Button`, `Badge`, `Input`, `DropdownMenu` primitives for filters UI.【F:apps/web/app/(main)/laps/_components/lap-filters.tsx†L4-L95】
- `(main)/laps/categories/page`: `Card` slots and `Button` for navigation.【F:apps/web/app/(main)/laps/categories/page.tsx†L1-L71】
- `(main)/laps/categories/[categoryId]/page`: `Card` slots, `Badge`, `Button` for category detail.【F:apps/web/app/(main)/laps/categories/[categoryId]/page.tsx†L3-L90】
- `(main)/laps/cars/page`: `Card` slots, `Button`, `Badge` for car listings.【F:apps/web/app/(main)/laps/cars/page.tsx†L1-L69】
- `(main)/laps/cars/[vehicleId]/page`: `Card` slots, `Badge`, `Button` for vehicle detail.【F:apps/web/app/(main)/laps/cars/[vehicleId]/page.tsx†L3-L88】
- `(main)/laps/tracks/page`: `Card` slots, `Button`, `Badge` for track listing.【F:apps/web/app/(main)/laps/tracks/page.tsx†L1-L86】
- `(main)/laps/tracks/[trackId]/page`: `Card` slots, `Badge`, `Button` for track detail.【F:apps/web/app/(main)/laps/tracks/[trackId]/page.tsx†L3-L105】
- `(main)/laps/laps/[id]` telemetry view: `Button` controls plus `TrackMap`/`ZoomableChart` wrappers from `@/components` (see below).【F:apps/web/app/(main)/analyze/laps/[id]/_components/telemetry-view.tsx†L5-L107】

## Usage in shared components under `apps/web/components`

- **App shell & navigation**: `app-sidebar.tsx` uses the Sidebar suite (`Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarMenu*`).【F:apps/web/components/app-sidebar.tsx†L19-L120】 `nav-main.tsx` combines `Collapsible` and `SidebarMenu*` controls for nested nav.【F:apps/web/components/nav-main.tsx†L9-L73】 `nav-secondary.tsx` uses `SidebarMenu`, `SidebarGroup`, `SidebarGroupLabel` for secondary links.【F:apps/web/components/nav-secondary.tsx†L10-L43】 `nav-recent-activity.tsx` uses `SidebarGroup*` and `Tooltip*` for recent activity list.【F:apps/web/components/nav-recent-activity.tsx†L16-L97】 `nav-user.tsx` uses `Avatar`, `DropdownMenu` primitives, `SidebarMenu*`, and `Skeleton` for user info menu.【F:apps/web/components/nav-user.tsx†L16-L105】
- **Site header & breadcrumbs**: `site-header.tsx` pulls `Breadcrumb*`, `Button`, `Separator`, and `useSidebar` trigger.【F:apps/web/components/site-header.tsx†L15-L94】
- **Metric displays**: `components/metrics/chart.tsx` uses `ChartContainer` and `ChartTooltipContent` plus wrappers like `TelemetryChartTooltip`.【F:apps/web/components/metrics/chart.tsx†L10-L86】 `components/metrics/track-map.tsx` uses `Button` for zoom/reset controls alongside telemetry map output.【F:apps/web/components/metrics/track-map.tsx†L2-L77】 `components/telemetry-chart-tooltip.tsx` consumes `ChartTooltipContent`.【F:apps/web/components/telemetry-chart-tooltip.tsx†L4-L63】
- **Content cards**: `lap-card.tsx` and `community-lap-card.tsx` rely on `Card` slots, `Badge`, `Button`, and `Avatar` primitives.【F:apps/web/components/lap-card.tsx†L1-L87】【F:apps/web/components/community-lap-card.tsx†L1-L88】 Shared `search-form.tsx` uses `Label` and `SidebarInput` (sidebar input wrapper).【F:apps/web/components/search-form.tsx†L3-L35】
- **Sidebar wrappers**: `app-sidebar-wrapper.tsx` and `providers` hook into `SidebarProvider`/`SidebarInset` to scaffold layouts.【F:apps/web/components/app-sidebar-wrapper.tsx†L1-L39】【F:apps/web/app/layout.tsx†L4-L31】
- **Misc**: `nav-recent-activity` and `nav-user` leverage `Tooltip` and `DropdownMenu` variants for hover menus; `skeleton` is used for loading placeholders in navigation.【F:apps/web/components/nav-recent-activity.tsx†L16-L97】【F:apps/web/components/nav-user.tsx†L16-L105】

## Local `@/components` wrappers

- Navigation composites (`NavMain`, `NavSecondary`, `NavRecentActivity`, `NavUser`) wrap Sidebar primitives for custom layouts.【F:apps/web/components/app-sidebar.tsx†L19-L120】【F:apps/web/components/nav-main.tsx†L9-L73】
- Layout scaffolding (`AppSidebarWrapper`, `SiteHeader`) orchestrates sidebar and breadcrumb controls.【F:apps/web/components/app-sidebar-wrapper.tsx†L1-L39】【F:apps/web/components/site-header.tsx†L15-L94】
- Metrics (`TelemetryChartTooltip`, `TrackMap`, `ZoomableChart`) wrap shadcn Chart components for telemetry visuals.【F:apps/web/components/telemetry-chart-tooltip.tsx†L4-L63】【F:apps/web/components/metrics/chart.tsx†L10-L86】【F:apps/web/components/metrics/track-map.tsx†L2-L77】
- Lap presentation (`LapCard`, `CommunityLapCard`) packages Card/Badge/Button/Avatar combinations for listings used across lap pages.【F:apps/web/components/lap-card.tsx†L1-L87】【F:apps/web/components/community-lap-card.tsx†L1-L88】

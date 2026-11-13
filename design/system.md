# Design system — Made in Casa Pro

Synced from project sources (read only). Values below are only those found in the sources.

## Colors (light) — `app/globals.css` `:root`

| Token | Value | Usage |
| --- | --- | --- |
| --background | hsl(0 0% 100%) | Page background |
| --foreground | hsl(240 10% 3.9%) | Body text |
| --card | hsl(0 0% 100%) | Cards, sheets |
| --primary | hsl(240 5.9% 10%) | Primary buttons |
| --primary-foreground | hsl(0 0% 98%) | Text on primary |
| --secondary / --muted / --accent | hsl(240 4.8% 95.9%) | Subtle surfaces, hover |
| --muted-foreground | hsl(240 3.8% 46.1%) | Secondary text |
| --destructive | hsl(0 84.2% 60.2%) | Errors, destructive actions |
| --border / --input | hsl(240 5.9% 90%) | Borders, inputs |
| --ring | hsl(240 10% 3.9%) | Focus ring |
| --chart-1..5 | hsl(12 76% 61%), hsl(173 58% 39%), hsl(197 37% 24%), hsl(43 74% 66%), hsl(27 87% 67%) | Charts |
| --color-market-purple | #322fbc | Brand accent |
| --color-market-pink | #8b28c1 | Brand accent |
| --color-market-green | hsl(120 100% 50%) | Brand accent |

Dark mode (`.dark`): background hsl(240 10% 3.9%), foreground hsl(0 0% 98%), muted hsl(240 3.7% 15.9%), muted-foreground hsl(240 5% 64.9%), border hsl(240 3.7% 15.9%), destructive hsl(0 62.8% 30.6%).

Status badge colors in components use Tailwind palette classes (blue-50/700, purple-50/700, emerald-50/700, amber-50/700, orange-50/700) — source `app/components/tasks/MyTasksClient.tsx`.

## Tiptap scale — `app/styles/_variables.scss`

- Brand: --tt-brand-color-500 rgba(98,41,255,1), -50 rgba(239,238,255,1), -100 rgba(222,219,255,1)
- Gray light 50–900 (rgba(250,250,250) → rgba(34,35,37))
- Shadow: --tt-shadow-elevated-md (16/12/6/2px layered, rgba(17,24,39,.02–.04))
- Transition: default 0.2s, easing cubic-bezier(0.46, 0.03, 0.52, 0.96)

## Typography

No custom font declared in sources: system sans stack (Tailwind default). Page H1 `text-2xl font-bold`; `.primaryH1` `text-3xl font-bold`.

## Radius — `app/globals.css` `@theme`

--radius 0.6rem; sm = radius-4px, md = radius-2px, lg = radius, xl = radius+4px. Tiptap: 2/4/6/8/12/16px.

## Components

shadcn/ui (`app/components/ui/`): Button, Badge, Input, Label, Select, Popover, Calendar, Skeleton, Dialog, Sheet. Icons: lucide-react. Toasts: sonner.

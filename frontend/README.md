# Photo Album Frontend

React + Vite frontend scaffold for the Photo Album application.

## Stack

- React 19
- Vite 8
- TypeScript 6
- Tailwind CSS 4 via `@tailwindcss/vite`
- shadcn/ui CLI and local component copies
- Magic UI through the shadcn registry workflow
- Aceternity UI copy-in components with Tailwind CSS and Framer Motion

## Development Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Component Library Workflow

Use shadcn/ui for base accessible primitives:

```bash
npx shadcn@latest add button
```

Use Magic UI through the same shadcn workflow:

```bash
npx shadcn@latest add @magicui/globe
```

Use Aceternity UI by copying selected components into the app, keeping shared helpers under `src/lib` and reusable UI under `src/components`. The project already includes the common runtime dependencies used by Aceternity-style components: `tailwindcss`, `framer-motion`, `clsx`, and `tailwind-merge`.

No application pages have been implemented yet beyond the minimal scaffold placeholder.

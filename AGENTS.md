# AGENTS.md - AI Asset Studio

Guidelines for AI coding agents working in this repository.

## Project Overview

AI Asset Studio - A React + Fastify application for AI-powered image and video generation using FAL and KIE AI models.

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend**: Fastify file API server (Node.js)
- **Node Version**: 22+ (check `.nvmrc`)

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development (frontend only)
npm run dev

# Development (backend only)
npm run dev:server

# Development (both concurrently)
npm run dev:all

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview

# Start production server
npm start
```

**Note**: No test framework is currently installed. If adding tests, use Vitest or Jest and document the single test command here.

## Project Structure

```
server/                # Fastify file API server
├── index.js          # Main server entry
├── meta-db.js        # SQLite metadata database
└── backfill-meta.js  # Metadata migration script

src/
├── app/              # Main app shell
│   └── page.tsx      # Root page component
├── components/       # React UI components
├── lib/              # Core logic, API clients, utilities
│   ├── api/          # API client functions
│   └── providers/    # AI provider integrations
├── state/            # React Context state management
│   ├── catalog.tsx   # File catalog state
│   ├── queue.tsx     # Generation queue state
│   └── elements.tsx  # Elements manager state
└── styles/           # Global CSS styles

data/                 # File storage (gitignored)
dist/                 # Production build output
```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** - no implicit any, strict null checks
- Target: ES2022, Module: ESNext
- Use `type` keyword for type imports: `import type { Foo } from './foo'`
- No unused locals or parameters allowed
- Enable `noFallthroughCasesInSwitch` and `noUncheckedSideEffectImports`

### React

- Functional components with hooks only
- Use `StrictMode` in development
- Named exports for components: `export default function ComponentName()`
- Props interfaces: `interface ComponentNameProps { ... }`
- Use React 19 features where appropriate

### Naming Conventions

- Components: PascalCase (`ElementCard.tsx`)
- Functions/Variables: camelCase (`handleDelete`, `isLoading`)
- Constants: UPPER_SNAKE_CASE for true constants
- Types/Interfaces: PascalCase (`Element`, `FileEntry`)
- Files: Match the default export name

### Imports

- Group imports: React → Third-party → Local
- Use path aliases relative to `src/`: `import { Foo } from '../lib/foo'`
- Environment variables: `import.meta.env.VITE_*`

### Formatting

- 2-space indentation
- Double quotes for strings
- Semicolons: optional but be consistent (current codebase uses minimal semicolons)
- Max line length: ~100 characters (soft limit)

### Error Handling

- Use try/catch for async operations
- Log errors with context: `console.error("Failed to X:", error)`
- Throw descriptive errors: `throw new Error("Missing API key")`
- Handle edge cases explicitly (null checks, empty arrays)

### Tailwind CSS

- Use semantic color names: `bg-slate-950`, `text-sky-400`
- Custom animations defined in `tailwind.config.js`
- Dark theme only (no light mode support)
- Utility classes: prefer composition over custom CSS

### Environment Variables

Frontend (`.env.local`):
- `VITE_FAL_KEY` - FAL API key
- `VITE_KIE_KEY` - KIE API key
- `VITE_FILE_API_BASE` - File API base URL
- `VITE_FILE_API_TOKEN` - API authentication token

Backend (`.env.server`):
- `FILE_API_PORT` - Server port (default: 8787)
- `FILE_STORAGE_ROOT` - File storage path
- `FILE_API_TOKEN` - Must match frontend token
- `FILE_API_CORS_ORIGIN` - Frontend origin for CORS

## ESLint Configuration

- Extends: @eslint/js recommended, typescript-eslint recommended
- Plugins: react-hooks, react-refresh
- Ignores: `dist/` directory
- Applies to: `**/*.{ts,tsx}` files

## API Patterns

### Frontend API Clients

Located in `src/lib/api/`:
- Async functions returning Promises
- Type-safe request/response handling
- Error handling with descriptive messages

### Backend Routes

Located in `server/index.js`:
- Fastify plugin architecture
- Route prefixes: `/files`, `/workspaces`, `/meta`, `/elements`
- Authentication via `FILE_API_TOKEN`

## State Management

Uses React Context (not Redux):
- Providers wrap the app in `page.tsx`
- Custom hooks for accessing context: `useCatalog()`, `useQueue()`, `useElements()`
- State and actions separated in context value

## File Storage

- Images: `images/YYYY-MM-DD/`
- Videos: `videos/YYYY-MM-DD/`
- Metadata: SQLite database (`metadata.sqlite`)
- Trash: `_trash/` (emptied on server restart)

## Security Notes

- Never commit `.env.local` or `.env.server`
- API tokens must match between frontend and backend
- CORS configured for development origin
- File uploads limited by `FILE_MAX_SIZE_MB`

## Common Tasks

### Adding a New Component

1. Create file in `src/components/ComponentName.tsx`
2. Use functional component pattern
3. Export as default
4. Add to parent component or route

### Adding a New API Client Function

1. Add to appropriate file in `src/lib/api/`
2. Use TypeScript types for parameters and return values
3. Handle errors with try/catch
4. Log errors for debugging

### Adding a New Server Route

1. Add route handler in `server/index.js`
2. Include in `API_ROUTES` array if authentication required
3. Use async/await pattern
4. Return JSON responses

## Troubleshooting

- **CORS errors**: Check `FILE_API_CORS_ORIGIN` matches frontend URL
- **Auth failures**: Verify tokens match in `.env.local` and `.env.server`
- **Build errors**: Run `npm run lint` first
- **Type errors**: Check `tsconfig.app.json` strict settings

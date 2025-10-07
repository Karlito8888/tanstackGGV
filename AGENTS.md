# React GGV App - Agent Guidelines

## 🚀 Build/Lint/Test Commands
- `npm run build` - Build for production  
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🌍 PRIMORDIAL RULE - LANGUAGE & TARGET AUDIENCE
**THIS PWA MUST BE ENTIRELY IN ENGLISH AND TARGET A FILIPINO AUDIENCE**
- All user-facing text, labels, buttons, and content MUST be in English
- Design choices, cultural references, and user experience should consider Filipino users
- No French text or localization - English only for all UI elements
- Consider Filipino cultural context in design decisions and content

## 📝 Code Style Guidelines
- **Imports**: Use ES6 imports, group third-party then local imports
- **Formatting**: Follow ESLint rules, no unused vars (ignore ALL_CAPS)
- **Types**: Use TypeScript for mappers, JS for components
- **Naming**: camelCase for vars/functions, PascalCase for components
- **Error Handling**: Try/catch with console.warn for localStorage errors
- **Comments**: JSDoc for functions, minimal inline comments
- **Mobile First**: THIS PWA MUST BE ABSOLUTELY MOBILE FIRST - Design for mobile first, then adapt for desktop

## ⚠️ Required Documentation
**BEFORE ANY CODE CHANGES**, consult official docs:
- For TypeScript code style and best practices: https://www.typescriptlang.org/docs/
- For React 19 component architecture and hooks patterns: https://react.dev/
- TanStack: https://tanstack.com/  
- MapLibre: https://maplibre.org/maplibre-gl-js/docs/
- Supabase: https://supabase.com/docs/guides/getting-started/

## 🎯 Development Principles
**DRY, KISS, MINUTIEUX, ETAPE PAR ETAPE**
- No code duplication
- Keep it simple and readable
- Attention to detail
- Methodical step-by-step approach
- KISS (Keep It Simple, Stupid)
- YAGNI (You Aren't Gonna Need It)
- Éviter la sur-ingénierie

## 🗄️ Database Operations
**DOUBLE CONSULTATION REQUIRED** before any Supabase operations:
1. Check `supabase.sql` for database structure
2. Use Supabase MCP to verify state and execute operations
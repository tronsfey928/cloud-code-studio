# Design Decisions

## DD-001: Backend Framework Migration (Express → NestJS)
**Date**: 2026-04-01
**Decision**: Migrate from Express.js with manual routing to NestJS with module-based architecture
**Rationale**: CLAUDE.md requires NestJS + TypeORM. NestJS provides built-in DI, decorators, guards, interceptors, and Swagger integration.
**Impact**: All backend code restructured into modules/ with proper Module → Controller → Service layering.

## DD-002: ORM Migration (Sequelize → TypeORM)
**Date**: 2026-04-01
**Decision**: Replace Sequelize with TypeORM for database access
**Rationale**: CLAUDE.md specifies TypeORM. Better decorator-based entity definitions, native NestJS integration.
**Impact**: All 7 models migrated to TypeORM entities with proper decorators.

## DD-003: Frontend UI Migration (Ant Design → shadcn/ui)
**Date**: 2026-04-01
**Decision**: Replace Ant Design v5 with shadcn/ui (Radix UI primitives + Tailwind)
**Rationale**: CLAUDE.md requires shadcn/ui. Provides full styling control, smaller bundle, better dark mode support.
**Impact**: All components rewritten using Radix UI primitives with TailwindCSS v4 classes.

## DD-004: TailwindCSS v4 CSS-first Configuration
**Date**: 2026-04-01
**Decision**: Use TailwindCSS v4 with CSS-first @theme configuration instead of tailwind.config.js
**Rationale**: CLAUDE.md mandates @import "tailwindcss" + @theme blocks. oklch color space for perceptually uniform colors.
**Impact**: Removed tailwind.config.js and postcss.config.js. All design tokens defined in app.css @theme block.

## DD-005: Unified Response Format
**Date**: 2026-04-01
**Decision**: Backend API returns { code, message, data } envelope for all responses
**Rationale**: CLAUDE.md requires unified response format. Implemented via NestJS ResponseInterceptor.
**Impact**: Frontend api.ts interceptor unwraps the envelope automatically.

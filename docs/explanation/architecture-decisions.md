---
title: Architecture Decisions
description: Why IntelliFill is built the way it is
category: explanation
tags: [architecture, decisions, design]
lastUpdated: 2025-11-25
---

# Architecture Decisions

This document explains the key architectural decisions made in IntelliFill and the reasoning behind them.

---

## Monorepo Structure

### Decision

Organize the project as a monorepo with separate directories for backend (`quikadmin/`) and frontend (`quikadmin-web/`).

### Rationale

1. **Shared context**: Developers work on related code together
2. **Atomic changes**: Cross-cutting changes in single commits
3. **Simplified dependencies**: Easier to maintain consistency
4. **Reduced overhead**: One repository to clone and manage

### Trade-offs

- **Pros**: Unified tooling, easier refactoring, shared documentation
- **Cons**: Larger repository, potential for coupled changes

### Alternatives Considered

- **Polyrepo**: Separate repositories per project - rejected for coordination overhead
- **Nx/Turborepo**: Monorepo tooling - considered for future scaling

---

## Backend Framework: Express.js

### Decision

Use Express.js as the HTTP server framework.

### Rationale

1. **Maturity**: Battle-tested with extensive ecosystem
2. **Flexibility**: Minimal opinions, easy to customize
3. **Performance**: Lightweight and fast
4. **Community**: Large community, abundant resources

### Trade-offs

- **Pros**: Simple, flexible, well-documented
- **Cons**: More boilerplate than opinionated frameworks

### Alternatives Considered

- **Fastify**: Faster, but smaller ecosystem
- **NestJS**: Too opinionated for our needs
- **Hono**: Considered for future if edge deployment needed

---

## Frontend Framework: React + Vite

### Decision

Use React 18 with Vite as the build tool.

### Rationale

1. **React**: Industry standard, large talent pool
2. **Vite**: Fast development experience, modern tooling
3. **TypeScript**: Type safety across the stack

### Trade-offs

- **Pros**: Fast development, hot module replacement, wide ecosystem
- **Cons**: More configuration than Next.js

### Alternatives Considered

- **Next.js**: Good for SSR, but overkill for our SPA
- **SvelteKit**: Smaller community, harder to hire for
- **Vue**: Team more experienced with React

---

## State Management: Zustand

### Decision

Use Zustand for global state management in the frontend.

### Rationale

1. **Simplicity**: Minimal boilerplate
2. **Performance**: No unnecessary re-renders
3. **TypeScript**: Excellent type inference
4. **DevTools**: Redux DevTools compatible

### Trade-offs

- **Pros**: Simple API, small bundle, flexible
- **Cons**: Less structure than Redux

### Alternatives Considered

- **Redux Toolkit**: More boilerplate, heavier
- **Jotai**: Atomic model didn't fit our needs
- **Context API**: Prop drilling issues at scale

---

## Database: PostgreSQL via Neon

### Decision

Use PostgreSQL hosted on Neon serverless.

### Rationale

1. **PostgreSQL**: Robust, feature-rich, widely supported
2. **Neon**: Serverless scaling, cost-effective for development
3. **Prisma**: Excellent ORM integration

### Trade-offs

- **Pros**: Auto-scaling, branching, generous free tier
- **Cons**: Cold start latency, connection limits

### Alternatives Considered

- **Supabase Postgres**: Bundled with auth, but less flexible
- **PlanetScale**: MySQL-based, team prefers PostgreSQL
- **Local PostgreSQL**: No cloud benefits

---

## Authentication: Supabase Auth

### Decision

Use Supabase Auth for user authentication.

### Rationale

1. **Managed service**: No need to implement auth from scratch
2. **Security**: Industry-standard security practices
3. **Features**: Social logins, magic links, MFA ready
4. **Integration**: Works with PostgreSQL

### Trade-offs

- **Pros**: Secure, feature-rich, low maintenance
- **Cons**: External dependency, some vendor lock-in

### Alternatives Considered

- **Auth0**: More expensive at scale
- **Custom JWT**: More work, security risks
- **Passport.js**: Requires more implementation

---

## OCR Engine: Tesseract.js

### Decision

Use Tesseract.js for optical character recognition.

### Rationale

1. **Open source**: No API costs
2. **Node.js native**: No external processes
3. **Multi-language**: Supports many languages
4. **Accuracy**: Good accuracy with preprocessing

### Trade-offs

- **Pros**: Free, flexible, customizable
- **Cons**: Slower than cloud APIs, more preprocessing needed

### Alternatives Considered

- **Google Cloud Vision**: More accurate, but expensive
- **AWS Textract**: Great for structured data, costly
- **Azure Form Recognizer**: Similar trade-offs to Google

---

## PDF Library: pdf-lib

### Decision

Use pdf-lib for PDF manipulation and form filling.

### Rationale

1. **Pure JavaScript**: No native dependencies
2. **Form support**: Handles fillable PDF forms
3. **No external processes**: Works in Node.js
4. **Active maintenance**: Regular updates

### Trade-offs

- **Pros**: Pure JS, good form support, MIT license
- **Cons**: Limited rendering, no PDF-to-image

### Alternatives Considered

- **PDFKit**: Better for creation, worse for manipulation
- **pdf-parse**: Read-only, no form filling
- **Puppeteer**: Heavy, but better rendering

---

## API Design: REST

### Decision

Use REST API design with JSON payloads.

### Rationale

1. **Simplicity**: Easy to understand and use
2. **Tooling**: Universal HTTP client support
3. **Caching**: HTTP caching mechanisms
4. **Documentation**: Standard OpenAPI/Swagger support

### Trade-offs

- **Pros**: Simple, well-understood, cacheable
- **Cons**: Over-fetching, multiple requests for related data

### Alternatives Considered

- **GraphQL**: More complex, overkill for our use case
- **tRPC**: Good, but less familiar to team
- **gRPC**: Better for microservices, not web clients

---

## Styling: TailwindCSS

### Decision

Use TailwindCSS for styling with Radix UI primitives.

### Rationale

1. **Utility-first**: Fast development, consistent design
2. **Radix UI**: Accessible, unstyled components
3. **shadcn/ui**: Pre-built component patterns
4. **Performance**: Purged CSS in production

### Trade-offs

- **Pros**: Fast development, consistent, small bundle
- **Cons**: HTML can get verbose, learning curve

### Alternatives Considered

- **CSS Modules**: More isolation, less consistency
- **Styled Components**: Runtime overhead
- **Chakra UI**: Good, but less flexible

---

## Job Queue: Bull

### Decision

Use Bull with Redis for background job processing.

### Rationale

1. **Reliability**: Redis-backed persistence
2. **Features**: Retries, priorities, rate limiting
3. **Monitoring**: Bull Dashboard available
4. **Ecosystem**: Node.js standard

### Trade-offs

- **Pros**: Reliable, feature-rich, well-documented
- **Cons**: Requires Redis, more infrastructure

### Alternatives Considered

- **Agenda**: MongoDB-based, different stack
- **Bee-Queue**: Simpler, fewer features
- **In-memory**: Not persistent, lost on restart

---

## Future Considerations

### Potential Changes

1. **Edge functions**: Consider Hono for edge deployment
2. **Microservices**: Split if services grow complex
3. **ML models**: Move to TensorFlow Serving for scaling
4. **CDN**: Add CloudFlare or similar for static assets

### Technical Debt

1. **Type sharing**: Consider shared type package
2. **API versioning**: Implement proper versioning
3. **Testing**: Increase coverage to 90%+
4. **Monitoring**: Add proper APM solution

---

## Architecture Decision Records (ADRs)

For detailed decision records with full context, alternatives considered, and consequences:

- [ADR-001: Document Processing Pipeline](./adr/ADR-001-document-processing-pipeline.md) - Dual-path processing architecture for text-based vs scanned documents

---

## Related Documentation

- [System Overview](../reference/architecture/system-overview.md)
- [Extracted Data Lifecycle](../reference/architecture/extracted-data-lifecycle.md)
- [Data Flow](./data-flow.md)
- [Security Model](./security-model.md)

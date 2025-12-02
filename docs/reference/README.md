# Reference

Reference documentation is **information-oriented** and provides technical descriptions of the system. It describes the machinery and how to operate it.

---

## Reference Categories

### [API](./api/)

Complete API documentation:

- [Endpoints](./api/endpoints.md) - All API endpoints with parameters and responses

### [Configuration](./configuration/)

System configuration options:

- [Environment Variables](./configuration/environment.md) - All environment variables

### [Architecture](./architecture/)

System architecture documentation:

- [System Overview](./architecture/system-overview.md) - High-level architecture

### [Database](./database/)

Database documentation:

- [Schema](./database/schema.md) - Database schema reference

---

## Reference Philosophy

Reference documentation in this section follows these principles:

1. **Accurate** - Precisely describes the system as it is
2. **Complete** - Covers all aspects of the topic
3. **Structured** - Organized for easy navigation
4. **Consistent** - Uses uniform format and style
5. **Up-to-date** - Reflects current implementation

---

## Quick Reference

### API Base URLs

| Environment | URL |
|-------------|-----|
| Development | http://localhost:3002/api |
| Production | https://api.intellifill.com/api |

### Default Ports

| Service | Port |
|---------|------|
| Backend API | 3002 |
| Frontend UI | 8080 |
| Prisma Studio | 5555 |
| Redis | 6379 |
| PostgreSQL | 5432 |

### Key Files

| Purpose | Path |
|---------|------|
| Backend entry | `quikadmin/src/index.ts` |
| API routes | `quikadmin/src/api/routes.ts` |
| Frontend entry | `quikadmin-web/src/main.tsx` |
| Database schema | `quikadmin/prisma/schema.prisma` |

---

## Related Documentation

- [Tutorials](../tutorials/) - Learning by doing
- [How-To Guides](../how-to/) - Solving specific problems
- [Explanation](../explanation/) - Understanding concepts


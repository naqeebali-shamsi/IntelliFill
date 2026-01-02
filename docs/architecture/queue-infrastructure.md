# Queue Infrastructure Architecture

> **Status:** Production-ready, partially integrated
> **Last Updated:** 2026-01-02

## Overview

IntelliFill uses Bull + Redis for background job processing. The queue infrastructure is designed to support both current document processing and the upcoming MultiAgent system integration.

## Current State

| Queue                  | Status    | Consumer                                            |
| ---------------------- | --------- | --------------------------------------------------- |
| `ocr-processing`       | ✅ Active | Document upload flow                                |
| `document-processing`  | 🔌 Ready  | Awaiting integration                                |
| `batch-processing`     | 🔌 Ready  | Awaiting integration                                |
| `knowledge-processing` | 🔌 Ready  | **MultiAgent PoC** (`../IntelliFill-MultiAgentPoc`) |

## Architecture Decision

### Why Bull + Redis?

The Knowledge Queue processor (`knowledgeQueue.ts`) includes:

- **Checkpointing** - Resume from failures mid-processing
- **Memory management** - GC between embedding batches
- **Duplicate detection** - Text hash comparison
- **Batch processing** - 50 chunks for embeddings, 100 for storage

These features are designed for the MultiAgent PoC's heavy workloads:

- Large document corpus processing
- Embedding generation at scale
- Vector storage operations

### Why Not PostgreSQL-based Queues?

While pg-boss/graphile-worker would work for current (low) volume, the MultiAgent integration will require:

- High-throughput job processing
- Distributed workers (potential future scaling)
- Sub-second job pickup latency

Redis provides these capabilities; PostgreSQL queues would bottleneck at scale.

## Redis Configuration (Upstash Optimized)

All queues are configured to minimize Redis requests for Upstash free tier:

```typescript
settings: {
  stalledInterval: 300000,   // 5 min (default: 30s)
  guardInterval: 300000,     // 5 min (default: 5s)
  lockDuration: 300000,      // 5 min (default: 30s)
  lockRenewTime: 150000,     // 2.5 min
  retryProcessDelay: 60000,  // 1 min (default: 5s)
  drainDelay: 60000,         // 1 min (default: 5s)
}
```

**Estimated usage:** ~11 requests/min (~475k/month) - within 500k free tier limit.

## Pending Integration

### MultiAgent PoC Location

```
../IntelliFill-MultiAgentPoc/
```

### Integration Points

The Knowledge Queue exposes these functions (currently uncalled from API):

```typescript
// From: quikadmin/src/queues/knowledgeQueue.ts
addProcessDocumentJob(documentId, userId, options);
addGenerateEmbeddingsJob(documentId, chunks, options);
addReprocessChunksJob(documentId, chunkIds, options);
```

### When to Wire Up

Once the MultiAgent PoC is ready for production:

1. Import knowledge queue functions in relevant API routes
2. Add endpoints for triggering knowledge processing
3. Update frontend to show knowledge processing status
4. Enable the knowledge worker in production deployment

## File Reference

| Component       | Location                                   |
| --------------- | ------------------------------------------ |
| OCR Queue       | `quikadmin/src/queues/ocrQueue.ts`         |
| Document Queue  | `quikadmin/src/queues/documentQueue.ts`    |
| Knowledge Queue | `quikadmin/src/queues/knowledgeQueue.ts`   |
| Redis Health    | `quikadmin/src/utils/redisHealth.ts`       |
| Queue Settings  | All queues have identical `settings` block |

## Future Considerations

1. **Upgrade Upstash** - If request limits become restrictive after MultiAgent integration
2. **Dedicated Redis** - For production scale (self-hosted or managed)
3. **BullMQ migration** - Newer version with better Redis efficiency (when Bull v4 EOL)

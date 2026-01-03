# MultiAgent Integration PRD - Development Phase (Simplified)

**Version:** 2.0
**Date:** 2026-01-02
**Status:** Ready for Implementation
**Approach:** Minimal viable integration - NO unnecessary abstractions

---

## 1. Objective

Integrate the MultiAgent-PoC document processing pipeline into IntelliFill's backend via a new API endpoint. Direct integration using existing PoC infrastructure.

---

## 2. Scope

### In Scope
- Security fixes (auth bypass, input sanitization)
- Dependency alignment (Express 4.x)
- New API endpoint `/api/process/multiagent`
- Thin service wrapper around PoC's CompatibilityLayer
- Add job type to existing knowledgeQueue
- Unit and integration tests

### Out of Scope
- Strategy/Factory/Command patterns (YAGNI)
- New database models (use existing infrastructure)
- Shadow mode / A/B testing
- Feature flags

---

## 3. Technical Requirements

### 3.1 Security Fixes

**SEC-01: Remove Authentication Bypass**
- File: `IntelliFill-MultiAgent-PoC/src/server/middleware/apiKeyAuth.ts`
- Change: Remove `return next()` on lines 37-41, return 401 instead

**SEC-02: Add Input Sanitization**
- Single function, NOT a strategy pattern:
```typescript
// quikadmin/src/utils/sanitizeLLMInput.ts
export function sanitizeLLMInput(text: string, maxLength = 50000): string {
  return text
    .replace(/\{\{.*?\}\}/g, '')  // Remove template injections
    .replace(/\[\[.*?\]\]/g, '')  // Remove bracket injections
    .replace(/ignore previous instructions/gi, '')
    .slice(0, maxLength);
}
```

### 3.2 Dependency Alignment

**DEP-01: Express Version**
- Downgrade PoC from Express 5.x to 4.18.x
- Wrap async route handlers with try-catch (Express 4 requirement)

### 3.3 Core Integration

**INT-01: Add Job Type to knowledgeQueue**
- File: `quikadmin/src/queues/knowledgeQueue.ts`
- Add `'multiAgentProcess'` to KnowledgeJobType union
- Add helper function:
```typescript
export async function addMultiAgentProcessJob(data: {
  documentId: string;
  userId: string;
  rawText: string;
}): Promise<Job> {
  return knowledgeQueue.add('multiAgentProcess', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    timeout: 60000
  });
}
```

**INT-02: Create MultiAgentService (Thin Wrapper)**
- Location: `quikadmin/src/services/MultiAgentService.ts`
- Use PoC's CompatibilityLayer DIRECTLY - no additional adapter:
```typescript
import { CompatibilityLayer } from '@intellifill/multiagent-poc';
import { sanitizeLLMInput } from '../utils/sanitizeLLMInput';

export class MultiAgentService {
  private compatibility: CompatibilityLayer;

  constructor() {
    this.compatibility = new CompatibilityLayer();
  }

  async process(documentId: string, userId: string, rawText: string) {
    const sanitizedText = sanitizeLLMInput(rawText);
    return this.compatibility.processDocument({
      documentId,
      userId,
      rawText: sanitizedText
    });
  }
}
```

**INT-03: Queue Processor (Inline, No Command Pattern)**
- Add to existing queue processor or create simple handler:
```typescript
knowledgeQueue.process('multiAgentProcess', async (job) => {
  const service = new MultiAgentService();
  const result = await service.process(
    job.data.documentId,
    job.data.userId,
    job.data.rawText
  );

  // Update document with result (use existing Document model)
  await prisma.document.update({
    where: { id: job.data.documentId },
    data: {
      multiAgentResult: result,
      status: result.status === 'completed' ? 'COMPLETED' : 'FAILED'
    }
  });

  return result;
});
```

### 3.4 Database (Minimal Change)

**DB-01: Add Column to Existing Document Model**
- NO new model - add single column to existing Document:
```prisma
model Document {
  // ... existing fields ...
  multiAgentResult Json?  // Store multi-agent processing result
}
```

### 3.5 API Endpoints

**API-01: MultiAgent Processing Endpoint**
- Route: `POST /api/process/multiagent`
- Auth: Existing Supabase middleware
- Implementation:
```typescript
router.post('/multiagent', authenticateSupabase, async (req, res) => {
  const { documentId } = req.body;
  const userId = req.user.id;

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return res.status(404).json({ error: 'Document not found' });

  const job = await addMultiAgentProcessJob({
    documentId,
    userId,
    rawText: document.extractedText || ''
  });

  res.json({ jobId: job.id, status: 'queued' });
});
```

**API-02: Processing Status Endpoint**
- Route: `GET /api/process/multiagent/:jobId/status`
- Returns Bull job state directly (no new DB model needed)

---

## 4. File Structure (Minimal)

```
quikadmin/src/
├── services/
│   ├── IntelliFillService.ts      # UNCHANGED
│   └── MultiAgentService.ts       # NEW - thin wrapper (~30 lines)
├── utils/
│   └── sanitizeLLMInput.ts        # NEW - single function (~10 lines)
├── queues/
│   └── knowledgeQueue.ts          # MODIFIED - add job type
└── api/
    └── multiagent.routes.ts       # NEW - 2 endpoints (~50 lines)
```

**Total new code: ~100 lines**

---

## 5. What We're NOT Doing (Per Review)

| Removed | Reason |
|---------|--------|
| Strategy Pattern | No runtime switching needed |
| Factory Pattern | YAGNI - single processor |
| Command Pattern | Bull already provides this |
| New Prisma Model | Use Bull storage + Document.multiAgentResult |
| MultiAgentAdapter | Use PoC's CompatibilityLayer directly |
| interfaces.ts | Use PoC's types directly |
| ProcessingService.ts | Separate endpoints, no abstraction needed |

---

## 6. Implementation Order

1. **SEC-01**: Remove auth bypass in PoC
2. **DEP-01**: Downgrade Express in PoC to 4.18.x
3. **SEC-02**: Create sanitizeLLMInput utility
4. **DB-01**: Add multiAgentResult column to Document model
5. **INT-01**: Add job type to knowledgeQueue
6. **INT-02**: Create MultiAgentService
7. **INT-03**: Add queue processor
8. **API-01/02**: Create API routes
9. **Testing**: Unit tests for service + integration tests

---

## 7. Success Criteria

- [ ] `/api/process/multiagent` endpoint works
- [ ] Existing endpoints unchanged (no breaking changes)
- [ ] Processing completes in < 60s
- [ ] Tests pass

---

## 8. Testing Requirements

**Unit Tests (~80% coverage on new code)**
- `sanitizeLLMInput` - injection pattern removal
- `MultiAgentService.process` - with mocked CompatibilityLayer

**Integration Tests**
- Queue → Processor → Database flow
- API endpoint responses

**Smoke Tests**
- 3 document types: passport, invoice, ID

---

**Document Version:** 2.0 (Simplified per code review)
**Principles:** KISS, YAGNI, use existing infrastructure

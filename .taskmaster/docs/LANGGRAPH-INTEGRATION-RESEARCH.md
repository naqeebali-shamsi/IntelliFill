# LangGraph/Multi-Agent Integration Research Report

> **Purpose:** Research findings and best practices for integrating LangGraph multi-agent systems into the IntelliFill Express backend
> **Date:** 2026-01-02
> **Status:** Research Complete

---

## Executive Summary

This report provides comprehensive research findings for integrating LangGraph-based multi-agent document processing pipelines into the existing IntelliFill Express/Bull queue architecture. The research covers production deployment patterns, local LLM integration with Ollama, monitoring strategies, and recommended architecture.

---

## 1. Best Practices Summary

### 1.1 LangGraph Production Deployment

**Core Principles (Source: Anthropic Engineering Blog)**

1. **Start Simple, Add Complexity Deliberately**
   - "The most successful implementations weren't using complex frameworks or specialized libraries. Instead, they were building with simple, composable patterns."
   - Begin with augmented LLM patterns before moving to full autonomous agents

2. **Architecture Progression**
   - **Augmented LLM**: Enhance models with retrieval, tools, and memory
   - **Prompt Chaining**: Sequential steps with validation gates
   - **Routing**: Classify inputs and direct to specialized processes
   - **Orchestrator-Workers**: Central LLM delegates to specialist agents
   - **Autonomous Agents**: Only when tasks are unpredictable

3. **Key Production Capabilities (LangGraph)**
   - Durable execution with checkpoint persistence
   - Native streaming for real-time user feedback
   - Human-in-the-loop inspection and approval
   - Built-in memory stores for cross-session context

### 1.2 Bull Queue + LangGraph Integration Pattern

**Recommended Approach: Workflow-as-Job**

```typescript
// Pattern: Wrap LangGraph workflow in Bull job processor
documentQueue.process('ai-extraction', async (job) => {
  const graph = createExtractionGraph();
  const checkpointer = new PostgresSaver(connectionString);

  const config = {
    configurable: {
      thread_id: job.id.toString(),
      checkpoint_id: job.data.resumeFromCheckpoint
    }
  };

  // Execute with checkpointing for fault tolerance
  const result = await graph.invoke(job.data, config);

  // Report progress via Bull job.progress()
  await job.progress(result.progress);

  return result;
});
```

**State Persistence Strategy**
- Use LangGraph's PostgreSQL checkpointer (`@langchain/langgraph-checkpoint-postgres`)
- Store checkpoints in existing Neon database
- Enable resume-from-checkpoint on job retry

### 1.3 Multi-Agent Coordination Patterns

**Three Coordination Strategies (LlamaIndex/LangGraph)**

| Pattern | Use Case | Complexity |
|---------|----------|------------|
| **Linear/Swarm** | Sequential document stages | Low |
| **Orchestrator-Agent** | Dynamic task delegation | Medium |
| **Hierarchical Teams** | Complex multi-step workflows | High |

**Recommended for IntelliFill: Orchestrator Pattern**
- Central "coordinator" agent routes documents to specialist agents
- Specialist agents: OCR, Field Extraction, Validation, Form Filling
- Enables parallel processing where dependencies allow

### 1.4 Local LLM (Ollama) Production Considerations

**Deployment Options**

```bash
# Docker deployment (recommended for production)
docker run -d -p 11434:11434 --gpus all ollama/ollama

# Memory requirements by model size
# 7B models: 8GB RAM minimum
# 13B models: 16GB RAM minimum
# 33B models: 32GB RAM minimum
```

**LangChain.js Integration**

```typescript
import { Ollama } from "@langchain/ollama";

const llm = new Ollama({
  model: "llama3",
  temperature: 0,
  maxRetries: 2,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434"
});
```

**Scaling Strategies**
- Run multiple Ollama instances behind load balancer
- GPU inference preferred for production workloads
- Consider model quantization (4-bit) for memory efficiency

---

## 2. Anti-Patterns to Avoid

### 2.1 Architecture Anti-Patterns

1. **Over-Engineering Early**
   - Do NOT build complex autonomous agents before simpler patterns prove insufficient
   - Start with prompt chaining + routing before multi-agent orchestration

2. **Tight Coupling to Framework**
   - Avoid deep LangGraph dependencies in business logic
   - Wrap LangGraph workflows in adapter layer for testability

3. **Ignoring Latency**
   - Multi-agent systems compound latency
   - Each agent call adds 200-500ms minimum
   - Plan for user-facing latency budgets

### 2.2 Queue Integration Anti-Patterns

1. **Synchronous Graph Execution in HTTP Handler**
   - NEVER run LangGraph workflows synchronously in Express routes
   - ALWAYS queue long-running AI operations via Bull

2. **Missing Checkpoints**
   - NEVER assume graph execution will complete
   - ALWAYS enable checkpointing for workflows > 30 seconds

3. **Unbounded Iterations**
   - ALWAYS set iteration limits on agent loops
   - Implement cost guards (token limits, time limits)

### 2.3 Ollama Anti-Patterns

1. **CPU Inference in Production**
   - Avoid CPU-only Ollama for production workloads
   - GPU inference is 10-50x faster

2. **Large Models on Limited RAM**
   - Don't run 13B+ models without adequate memory
   - OOM errors corrupt job state

3. **Missing Health Checks**
   - Always implement `/health` endpoint for Ollama
   - Monitor model load times and inference latency

---

## 3. Recommended Architecture Pattern

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Express API Layer                          │
│  POST /api/process/document → documentQueue.add()                │
│  GET  /api/jobs/:id/status  → getJobStatus()                     │
│  WS   /realtime             → SSE progress updates               │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Bull Queue Layer (Redis)                      │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ document-   │  │ ai-extract  │  │ knowledge-  │               │
│  │ processing  │  │ queue       │  │ processing  │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
└─────────┼────────────────┼────────────────┼──────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Worker Layer (Separate Process)                 │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              LangGraph Multi-Agent Pipeline                 │  │
│  │                                                             │  │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐             │  │
│  │  │Classifier│───►│Extraction│───►│Validation│             │  │
│  │  │  Agent   │    │  Agent   │    │  Agent   │             │  │
│  │  └──────────┘    └──────────┘    └──────────┘             │  │
│  │        │              │               │                    │  │
│  │        └──────────────┴───────────────┘                    │  │
│  │                       │                                    │  │
│  │               ┌───────▼───────┐                            │  │
│  │               │  Coordinator  │                            │  │
│  │               │     Agent     │                            │  │
│  │               └───────────────┘                            │  │
│  │                                                             │  │
│  │  State: PostgreSQL Checkpointer (Neon)                     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   LLM Provider   │  │     Ollama       │  │   Vector Store   │
│   (Gemini/GPT)   │  │  (Local/Docker)  │  │  (PostgreSQL)    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 3.2 Feature Flag Strategy (Shadow Mode)

**Phase 1: Shadow Mode (2 weeks)**
- Route 0% traffic to new pipeline
- Run both pipelines, compare outputs
- Log differences without affecting users

```typescript
const FEATURE_FLAGS = {
  aiPipeline: {
    enabled: process.env.FF_AI_PIPELINE === 'true',
    shadowMode: process.env.FF_AI_PIPELINE_SHADOW === 'true',
    rolloutPercent: parseInt(process.env.FF_AI_PIPELINE_ROLLOUT || '0')
  }
};

async function processDocument(job: Job) {
  const flags = FEATURE_FLAGS.aiPipeline;

  // Always run legacy pipeline
  const legacyResult = await legacyProcessor.process(job.data);

  // Shadow mode: run new pipeline, log comparison
  if (flags.shadowMode) {
    const newResult = await aiPipeline.process(job.data);
    await logPipelineComparison(legacyResult, newResult);
    return legacyResult; // Return legacy result
  }

  // Gradual rollout
  if (flags.enabled && Math.random() * 100 < flags.rolloutPercent) {
    return await aiPipeline.process(job.data);
  }

  return legacyResult;
}
```

**Phase 2: Canary Release (2-4 weeks)**
- Route 1% → 5% → 10% → 25% → 50% → 100%
- Monitor error rates, latency, extraction accuracy
- Automatic rollback triggers

**Phase 3: Full Production**
- 100% traffic to new pipeline
- Legacy pipeline deprecated
- Remove feature flags after stability period

### 3.3 Directory Structure

```
quikadmin/src/
├── agents/                    # LangGraph agent definitions
│   ├── coordinator.agent.ts   # Main orchestrator
│   ├── classifier.agent.ts    # Document classification
│   ├── extractor.agent.ts     # Field extraction
│   ├── validator.agent.ts     # Data validation
│   └── tools/                 # Agent tools
│       ├── ocr.tool.ts
│       ├── pdfParse.tool.ts
│       └── vectorSearch.tool.ts
├── graphs/                    # LangGraph workflow definitions
│   ├── documentProcessing.graph.ts
│   ├── knowledgeIngestion.graph.ts
│   └── formFilling.graph.ts
├── checkpointers/             # Persistence adapters
│   └── neonCheckpointer.ts    # PostgreSQL checkpointer for Neon
├── llm/                       # LLM provider abstraction
│   ├── providers/
│   │   ├── ollama.provider.ts
│   │   ├── gemini.provider.ts
│   │   └── openai.provider.ts
│   └── llmFactory.ts
└── queues/
    ├── aiExtractionQueue.ts   # New AI pipeline queue
    └── ... (existing queues)
```

---

## 4. Tool Recommendations

### 4.1 Monitoring & Observability

| Tool | Purpose | Priority |
|------|---------|----------|
| **Langfuse** | LLM tracing, cost tracking, evaluation | HIGH |
| **LangSmith** | LangGraph-native debugging (alternative to Langfuse) | MEDIUM |
| **Prometheus + Grafana** | Infrastructure metrics (existing) | HIGH |
| **Bull Board** | Queue monitoring dashboard | MEDIUM |

**Langfuse Integration**

```typescript
import { CallbackHandler } from 'langfuse-langchain';

const langfuseHandler = new CallbackHandler({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST
});

// Pass to LangGraph execution
const result = await graph.invoke(input, {
  callbacks: [langfuseHandler],
  configurable: { thread_id: jobId }
});
```

**Metrics to Track**
- LLM latency (p50, p95, p99)
- Token usage per job
- Extraction accuracy (vs. ground truth)
- Agent retry rates
- Checkpoint sizes
- Cost per document processed

### 4.2 Feature Flags

| Tool | Complexity | Self-Hosted |
|------|------------|-------------|
| **Unleash** | Medium | Yes |
| **LaunchDarkly** | Low | No |
| **PostHog** | Medium | Yes |
| **Custom (Redis-backed)** | Low | Yes |

**Recommendation: Start with custom Redis-backed flags**
- Leverage existing Redis infrastructure
- Simple percentage-based rollout
- Migrate to Unleash/LaunchDarkly if needs grow

### 4.3 Checkpointing

| Library | Database | Production-Ready |
|---------|----------|------------------|
| `@langchain/langgraph-checkpoint-postgres` | PostgreSQL | Yes |
| `@langchain/langgraph-checkpoint-sqlite` | SQLite | Dev only |
| `MemorySaver` | In-memory | Dev only |

**Recommendation: PostgreSQL checkpointer with Neon**
- Reuse existing database connection
- Durable across worker restarts
- Supports time-travel debugging

---

## 5. Reference Projects/Examples

### 5.1 LangGraph.js Examples (Official)

| Example | Relevance | Location |
|---------|-----------|----------|
| `multi_agent/agent_supervisor.ipynb` | Orchestrator pattern | GitHub: langchain-ai/langgraphjs |
| `multi_agent/hierarchical_agent_teams.ipynb` | Complex workflows | GitHub: langchain-ai/langgraphjs |
| `rag/` | Document retrieval | GitHub: langchain-ai/langgraphjs |

### 5.2 Production Deployments (Referenced in LangGraph Docs)

- **Klarna**: 85M users, customer service agents
- **Elastic**: Threat detection with agents
- **Uber**: Test generation workflows
- **Replit**: Code generation agents

### 5.3 Similar Open-Source Projects

| Project | Stack | Relevance |
|---------|-------|-----------|
| **AutoGen** (Microsoft) | Python, Multi-agent | Architecture patterns |
| **CrewAI** | Python, Multi-agent | Task delegation |
| **Semantic Kernel** (Microsoft) | C#/.NET, Orchestration | Enterprise patterns |

---

## 6. Performance Benchmarks

### 6.1 LLM Inference Latency

| Model | Hardware | Latency (p50) | Throughput |
|-------|----------|---------------|------------|
| Llama 3 8B (Ollama) | CPU (M1) | 2-5s | ~10 tok/s |
| Llama 3 8B (Ollama) | GPU (RTX 3090) | 200-500ms | ~100 tok/s |
| Gemini 1.5 Flash | API | 500-800ms | N/A |
| GPT-4 Turbo | API | 1-3s | N/A |

### 6.2 Document Processing Pipeline Estimates

| Stage | Without AI | With LangGraph Agents |
|-------|------------|----------------------|
| OCR | 2-5s | 2-5s (unchanged) |
| Classification | 100ms (rule-based) | 500ms-1s (LLM) |
| Field Extraction | 500ms | 1-3s (LLM) |
| Validation | 50ms | 500ms-1s (LLM) |
| **Total** | **~3-6s** | **~5-10s** |

**Optimization Strategies**
1. Run OCR and classification in parallel
2. Cache LLM responses for repeated patterns
3. Use smaller models (7B) for classification
4. Batch similar documents for single LLM call

### 6.3 Resource Requirements

| Component | CPU | Memory | GPU |
|-----------|-----|--------|-----|
| Worker (Node.js) | 2 cores | 2GB | None |
| Ollama (7B model) | 4 cores | 8GB | Optional |
| Ollama (13B model) | 4 cores | 16GB | Recommended |
| Redis (Upstash) | N/A | 256MB | None |
| PostgreSQL (Neon) | N/A | Managed | None |

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Install LangGraph.js dependencies
- [ ] Set up PostgreSQL checkpointer
- [ ] Create basic single-agent workflow
- [ ] Implement feature flag infrastructure

### Phase 2: Agent Development (Week 3-4)
- [ ] Build classifier agent
- [ ] Build extractor agent
- [ ] Build validator agent
- [ ] Create coordinator orchestrator

### Phase 3: Integration (Week 5-6)
- [ ] Create aiExtractionQueue
- [ ] Integrate with Bull worker
- [ ] Add Langfuse tracing
- [ ] Implement shadow mode

### Phase 4: Testing & Rollout (Week 7-8)
- [ ] Shadow mode comparison testing
- [ ] Performance benchmarking
- [ ] Canary release (1% → 100%)
- [ ] Documentation and handoff

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM API latency spikes | Medium | High | Local Ollama fallback |
| Checkpoint corruption | Low | High | Regular backup, validation |
| Cost overrun (API tokens) | Medium | Medium | Token budgets, caching |
| Accuracy regression | Medium | High | A/B testing, rollback |
| Ollama OOM errors | Medium | Medium | Memory limits, model selection |

---

## 9. Conclusion

Integrating LangGraph multi-agent pipelines into IntelliFill is feasible and aligns with industry best practices. The key recommendations are:

1. **Start simple**: Begin with prompt chaining before full multi-agent orchestration
2. **Use existing infrastructure**: Leverage Bull queues, Redis, PostgreSQL (Neon)
3. **Implement shadow mode**: Validate AI pipeline before user exposure
4. **Monitor aggressively**: Langfuse tracing + custom metrics
5. **Plan for fallback**: Ollama for local inference, API providers for scale

The existing Bull queue architecture provides an excellent foundation for wrapping LangGraph workflows as jobs with checkpointing, progress tracking, and retry capabilities.

---

## References

1. Anthropic Engineering Blog - "Building Effective Agents" (https://anthropic.com/engineering/building-effective-agents)
2. LangGraph.js Documentation (https://docs.langchain.com/oss/javascript/langgraph/)
3. LangGraph Platform Features (https://langchain.com/langgraph)
4. Martin Fowler - Feature Toggles (https://martinfowler.com/articles/feature-toggles.html)
5. BullMQ Documentation (https://docs.bullmq.io/)
6. Langfuse LangChain Integration (https://langfuse.com/docs/integrations/langchain)
7. Ollama Docker Documentation (https://github.com/ollama/ollama)
8. LlamaIndex Multi-Agent Patterns (https://developers.llamaindex.ai/)
9. Microsoft AutoGen Framework (https://github.com/microsoft/autogen)

# Explanation

Explanation documentation is **understanding-oriented** and provides conceptual discussions that clarify and illuminate particular topics. It deepens understanding.

---

## Available Explanations

### [Architecture Decisions](./architecture-decisions.md)

Why IntelliFill is built the way it is:
- Monorepo structure rationale
- Technology choices
- Service separation
- Authentication strategy

### [Security Model](./security-model.md)

How security works in IntelliFill:
- Authentication flow
- Authorization model
- Data protection
- API security

### [Data Flow](./data-flow.md)

How data moves through the system:
- Document upload flow
- OCR processing pipeline
- Data extraction
- Form filling process

---

## Explanation Philosophy

Explanations in this section follow these principles:

1. **Understanding-oriented** - Explain why, not just how
2. **Discussion-based** - Explore topics in depth
3. **Context-rich** - Provide background and rationale
4. **Conceptual** - Focus on ideas, not procedures

---

## Key Concepts

### Core Processing Pipeline

```
Document → OCR → Text → Extraction → Structured Data → Mapping → PDF Form
```

### Service Architecture

```
Frontend (React) → API Gateway (Express) → Services → Database (PostgreSQL)
                                        ↓
                              External Services (Supabase, Redis)
```

### Authentication Model

```
User → Login → Supabase Auth → JWT Token → Backend Validation → Protected Resources
```

---

## When to Read Explanations

Read explanations when you want to:

- Understand **why** something works the way it does
- Learn the **reasoning** behind architectural decisions
- Gain **deeper knowledge** beyond just using the system
- **Evaluate** whether the approach fits your needs

---

## Related Documentation

- [Tutorials](../tutorials/) - Learning-oriented lessons
- [How-To Guides](../how-to/) - Task-oriented guides
- [Reference](../reference/) - Technical specifications


# ADR-001: Document vs DocumentSource Relationship Design

**Status:** Accepted
**Date:** 2025-12-11
**Decision Makers:** Development Team
**Related Tasks:** Task #105, Task #100

## Context

IntelliFill has two distinct document-related models that serve different purposes:

1. **Document Model** (existing): Used for form-filling workflow
   - Stores uploaded documents for data extraction
   - Linked to templates for form filling
   - Contains extracted text and data
   - User-centric (belongs to a user)

2. **DocumentSource Model** (new): Knowledge base for vector search
   - Stores documents for semantic search
   - Chunked and embedded for vector similarity
   - Organization-scoped for multi-tenancy
   - Supports RAG (Retrieval-Augmented Generation) workflows

The challenge was determining how these models should relate to each other, considering:
- Backward compatibility with existing form-filling features
- Multi-tenant data isolation requirements
- Future extensibility for AI-powered features
- Performance implications of the relationship

## Decision

**We implemented a "Separate Models with Optional Link" approach.**

The `DocumentSource` model includes an optional `linkedDocumentId` field that can reference an existing `Document` record.

### Schema Design

```prisma
model DocumentSource {
  id               String               @id @default(uuid())
  organizationId   String               @map("organization_id")
  organization     Organization         @relation(fields: [organizationId], references: [id])
  userId           String               @map("user_id")
  user             User                 @relation(fields: [userId], references: [id])

  // Optional link to existing Document model (for form-filling integration)
  linkedDocumentId String?              @map("linked_document_id")

  // ... other fields
}
```

### Key Characteristics

1. **Independence**: DocumentSource can exist without a linked Document
   - Allows pure knowledge base documents (PDFs, manuals, reference materials)
   - Users can upload documents solely for search without form-filling context

2. **Optional Integration**: DocumentSource can link to existing Document
   - Form-fill documents can be added to knowledge base
   - Enables suggesting form field values from previously processed documents
   - Maintains provenance for audit purposes

3. **No Foreign Key Constraint**: `linkedDocumentId` is NOT a foreign key
   - Prevents cascade delete issues
   - Allows soft-delete independence
   - Both models can have different lifecycle management

## Alternatives Considered

### Option A: Single Unified Model
Extend the existing `Document` model to include vector search fields.

**Pros:**
- Simpler schema
- Single source of truth for documents
- No relationship complexity

**Cons:**
- Violates single responsibility principle
- Form-filling documents would need vector columns even if not used
- Harder to implement organization-scoped vs user-scoped access
- Migration complexity for existing data

### Option B: Strict Foreign Key Relationship
Make `linkedDocumentId` a required foreign key with cascade behavior.

**Pros:**
- Strong referential integrity
- Clear ownership chain
- Automatic cleanup on Document deletion

**Cons:**
- Prevents standalone knowledge base documents
- Complex cascade behavior with soft deletes
- Tight coupling between systems
- Migration challenges

### Option C: Inheritance/Polymorphism
Use table inheritance where DocumentSource extends Document.

**Pros:**
- Shared base attributes
- Clean OOP design

**Cons:**
- Prisma doesn't support table inheritance natively
- Complex query patterns
- Performance implications

## Consequences

### Positive

1. **Flexibility**: Users can build knowledge bases independent of form-filling
2. **Future-Proof**: Easy to add new document types without schema changes
3. **Performance**: No unnecessary joins for simple knowledge base queries
4. **Multi-tenancy**: Clear organization scoping on DocumentSource
5. **Backward Compatible**: Existing Document functionality unchanged

### Negative

1. **Potential Inconsistency**: Linked documents could be deleted leaving orphaned references
   - Mitigation: Application-level validation before using `linkedDocumentId`
2. **Dual Upload**: Same file could be uploaded as both Document and DocumentSource
   - Mitigation: UI guidance and optional automatic linking
3. **Query Complexity**: Cross-model queries require explicit joins
   - Mitigation: Service layer abstractions

### Neutral

1. **Storage**: Slightly more storage for linked documents (metadata duplication)
2. **Maintenance**: Two models to maintain instead of one

## Implementation Details

### Linking Workflow

```typescript
// When linking a form-fill document to knowledge base
async function linkDocumentToKnowledgeBase(
  documentId: string,
  organizationId: string,
  userId: string
): Promise<DocumentSource> {
  // 1. Validate Document exists
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // 2. Create DocumentSource with link
  return prisma.documentSource.create({
    data: {
      organizationId,
      userId,
      linkedDocumentId: documentId,
      title: document.fileName,
      filename: document.fileName,
      mimeType: document.fileType,
      fileSize: document.fileSize,
      storageUrl: document.storageUrl,
      status: 'PENDING'
    }
  });
}
```

### Querying Linked Documents

```typescript
// Get DocumentSource with linked Document details
async function getDocumentSourceWithLinkedDoc(
  sourceId: string,
  organizationId: string
): Promise<DocumentSourceWithDoc | null> {
  const source = await prisma.documentSource.findFirst({
    where: { id: sourceId, organizationId }
  });

  if (!source || !source.linkedDocumentId) {
    return source;
  }

  // Fetch linked document if exists
  const linkedDoc = await prisma.document.findUnique({
    where: { id: source.linkedDocumentId }
  });

  return { ...source, linkedDocument: linkedDoc };
}
```

## Validation

The following scenarios have been validated:

1. **Standalone DocumentSource**: Upload PDF directly to knowledge base - Works
2. **Linked DocumentSource**: Link existing form-fill document - Works
3. **Delete Document**: Original Document deleted, DocumentSource remains with null-like reference - Works
4. **Delete DocumentSource**: Only DocumentSource removed, Document unaffected - Works
5. **Organization Isolation**: Different orgs cannot access each other's DocumentSources - Works

## Related Documents

- [PRD Vector Search Implementation v2](../prd/PRD-vector-search-implementation-v2.md)
- [Prisma Schema](../../quikadmin/prisma/schema.prisma)
- Task #100: Organization Model
- Task #112: Prisma Schema Models

## Changelog

| Date | Author | Description |
|------|--------|-------------|
| 2025-12-11 | AI Agent | Initial decision and implementation |

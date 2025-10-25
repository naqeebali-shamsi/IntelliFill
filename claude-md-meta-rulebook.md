# The Complete CLAUDE.md Writing Rulebook
## Meta-Instructions for Creating Perfect AI-Readable Documentation Every Time

---

## Part I: Pre-Writing Analysis

### 1. Project Assessment Checklist
Before writing a single line, complete this assessment:

#### Project Complexity Analysis
- [ ] **Size**: Is this a microservice (<1000 LOC), small project (1K-10K LOC), medium (10K-100K LOC), or large (100K+ LOC)?
- [ ] **Domain**: Is this web app, CLI tool, data pipeline, API service, or infrastructure?
- [ ] **Team Size**: Solo developer, small team (2-5), medium (6-20), or large (20+)?
- [ ] **Maturity**: Prototype, MVP, production, or legacy system?
- [ ] **Integration Points**: How many external services/APIs does it connect to?

#### Documentation Scope Determination
Based on assessment above:
- **Microservice/Solo**: 1-2 page CLAUDE.md focusing on setup and conventions
- **Small/Small Team**: 2-4 pages with workflow and architecture sections
- **Medium/Medium Team**: 4-8 pages with detailed subsystem documentation
- **Large/Large Team**: Modular CLAUDE.md with @file imports to separate concerns

### 2. Audience & Context Mapping

#### Primary User Identification
Document WHO will use this CLAUDE.md:
```markdown
## Target Users
- [ ] AI Assistant (Claude Code) - PRIMARY
- [ ] New team members onboarding
- [ ] Future you (6 months later)
- [ ] External contributors
- [ ] DevOps/SRE teams
```

#### Context Requirements Matrix
| User Type | Needs | Priority | Section Focus |
|-----------|-------|----------|---------------|
| AI Assistant | Clear commands, file paths, constraints | CRITICAL | All sections |
| New Developer | Setup, architecture, workflow | HIGH | Setup, Overview |
| Future Maintainer | Decisions, gotchas, history | MEDIUM | Constraints, Notes |
| External Contributor | Standards, testing, PR process | LOW | Conventions, Workflow |

### 3. Information Inventory

#### Essential Information Gathering
Create a raw dump of ALL project information before organizing:

```markdown
## Information Dump (Pre-Organization)
### Technical Facts
- Languages: [List all]
- Frameworks: [List with versions]
- Databases: [Type, version, location]
- APIs: [Internal and external]
- Dependencies: [Critical ones only]

### Operational Facts
- Deployment: [Where and how]
- Environments: [Dev, staging, prod details]
- Access: [Who has what permissions]
- Monitoring: [Tools and dashboards]

### Process Facts
- Version Control: [Branching strategy]
- Testing: [Types and tools]
- Review: [PR process]
- Release: [Deployment pipeline]

### Historical Facts
- Major Decisions: [Why X over Y]
- Known Issues: [Bugs, tech debt]
- Future Plans: [Roadmap items]
```

---

## Part II: Structural Rules

### 4. The Seven Sacred Sections
Every CLAUDE.md MUST have these sections in THIS order:

```markdown
# Project Name - Purpose Statement

## 1. Project Overview
[2-4 sentences max. What it does, why it exists, who uses it]

## 2. Tech Stack
[Bulleted list, grouped by category]

## 3. Project Structure
[File tree or module description]

## 4. Development Environment
[Setup and configuration]

## 5. Development Workflow
[How to actually work on this]

## 6. Conventions & Standards
[Code style, commit format, etc.]

## 7. API/Integration Reference
[If applicable - endpoints, messages, schemas]
```

### 5. Section-Specific Rules

#### Project Overview (2-4 sentences ONLY)
```markdown
## Project Overview
[Sentence 1: WHAT] This is a/an [type] that [primary function].
[Sentence 2: WHY] It solves [problem] for [users].
[Sentence 3: HOW] It works by [high-level mechanism].
[Sentence 4: WHERE] It runs on [infrastructure] and integrates with [key services].
```

#### Tech Stack (Hierarchical Grouping)
```markdown
## Tech Stack
### Core
- **Runtime**: [Language + Version]
- **Framework**: [Name + Version]
- **Database**: [Type + Version]

### Infrastructure
- **Hosting**: [Platform]
- **Storage**: [Service]
- **Queue**: [Service]

### Development Tools
- **Build**: [Tool]
- **Test**: [Framework]
- **Lint**: [Linter]
```

#### Project Structure (Choose ONE format)
```markdown
## Project Structure

### Option A: Tree Format (for <20 items)
```
project/
├── src/
│   ├── core/       # Business logic
│   ├── api/        # API endpoints
│   └── utils/      # Helper functions
├── tests/          # Test suites
├── config/         # Configuration files
└── docs/           # Documentation
```

### Option B: Module Description (for complex projects)
- **core/**: Contains [description]
- **api/**: Handles [description]
- **utils/**: Provides [description]
```

#### Development Environment (Executable Instructions)
```markdown
## Development Environment

### Prerequisites
- [Tool 1] version X.X or higher
- [Tool 2] with [specific configuration]
- Access to [service/credential]

### Setup Instructions
1. **Clone Repository**
   ```bash
   git clone [repository-url]
   cd [project-name]
   ```

2. **Install Dependencies**
   ```bash
   [exact command]
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values:
   # - API_KEY: Get from [where]
   # - DB_URL: Format: [example]
   ```

4. **Verify Setup**
   ```bash
   [command to verify]
   # Expected output: [what success looks like]
   ```

### Time Estimate: ~[X] minutes
```

#### Development Workflow (Task-Based Organization)
```markdown
## Development Workflow

### Making Changes
1. **Start from correct branch**
   ```bash
   git checkout [branch]
   git pull origin [branch]
   ```

2. **Create feature branch** (if applicable)
   ```bash
   git checkout -b [naming-convention]
   ```

3. **Make changes**
   - [Specific instruction 1]
   - [Specific instruction 2]

4. **Test changes**
   ```bash
   [test command]
   ```

5. **Commit changes**
   ```bash
   [pre-commit checks]
   git add [files]
   git commit -m "[format]"
   ```

### Testing Locally
[Specific steps for local testing]

### Deploying Changes
[Specific deployment process]
```

### 6. The Cognitive Load Rules

#### Rule of Seven
No section should have more than 7±2 items at the same level:

```markdown
## BAD Example - Too Many Items
### Configuration Options
- Option 1
- Option 2
- Option 3
- Option 4
- Option 5
- Option 6
- Option 7
- Option 8  ← Cognitive overload
- Option 9
- Option 10

## GOOD Example - Grouped Items
### Configuration Options
#### Database Settings (4 items)
- Connection string
- Pool size
- Timeout
- Retry policy

#### Cache Settings (3 items)
- TTL
- Max size
- Eviction policy

#### Logging Settings (3 items)
- Level
- Output format
- Destination
```

#### Progressive Disclosure Pattern
Information should flow from general to specific:

```markdown
## Deployment

### Quick Deploy (Most Common)
```bash
npm run deploy
```

### Custom Deploy Options
<details>
<summary>Advanced deployment configurations</summary>

#### Deploy to Specific Environment
```bash
npm run deploy -- --env=staging
```

#### Deploy with Debug Logging
```bash
npm run deploy -- --verbose
```

#### Deploy with Custom Configuration
```bash
npm run deploy -- --config=custom.json
```

</details>
```

---

## Part III: Language & Style Rules

### 7. The Clarity Commandments

#### Use Imperative Mood for Instructions
```markdown
## BAD
- You should install dependencies
- The developer needs to run tests
- It's recommended to use linting

## GOOD
- Install dependencies
- Run tests
- Use linting
```

#### Eliminate Ambiguous Terms
```markdown
## Forbidden Words → Required Replacements
- "some" → specify exact items
- "probably" → remove uncertainty
- "should work" → "works" or "requires X to work"
- "mostly" → specify exceptions
- "usually" → specify exact conditions
- "etc." → list all items or use "including but not limited to"
- "various" → list specific items
- "several" → specify exact number
```

#### Provide Explicit Context
```markdown
## BAD
Click on Settings and change the configuration.

## GOOD
Click on Settings (gear icon in top-right corner) and change the configuration by:
1. Navigate to Settings > Project > Advanced
2. Locate "Build Configuration" section
3. Modify the "Build Command" field
```

### 8. The Consistency Constitution

#### Terminology Standardization
Create and maintain a terminology glossary:

```markdown
## Project Terminology
<!-- Define once, use everywhere -->
- **Worker**: Background job processor (not "job", "task", or "process")
- **Report**: Generated PDF document (not "document", "file", or "output")
- **Queue**: SQS message queue (not "pipeline", "stream", or "channel")
- **Deploy**: Push to production (not "release", "ship", or "publish")
```

#### Format Standardization
```markdown
## Formatting Rules

### Commands
Always use code blocks with language specification:
```bash
command here
```

### File Paths
Always use backticks: `src/components/Header.jsx`

### Environment Variables
Always use caps with underscore: `DATABASE_URL`

### Placeholders
Always use brackets: `[your-value-here]`

### Optional Parameters
Always use square brackets in commands: `npm run build [--prod]`
```

### 9. The Anti-Pattern Avoidance Act

#### Never Create Circular References
```markdown
## BAD - Circular Reference
### Section A
See Section B for configuration details.

### Section B
Refer to Section A for setup instructions.

## GOOD - Linear Flow
### Setup Instructions
1. Install dependencies (see prerequisites below)
2. Configure environment
3. Run application

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
```

#### Never Duplicate Information
```markdown
## BAD - Duplication
### Development Setup
Database URL format: postgresql://user:pass@host:5432/db

### Testing Setup
Database URL format: postgresql://user:pass@host:5432/db

## GOOD - Single Source of Truth
### Environment Variables
`DATABASE_URL`: postgresql://user:pass@host:5432/db
- Used in: Development, Testing, Production
- Format: postgresql://[user]:[password]@[host]:[port]/[database]
```

---

## Part IV: Quality Assurance Rules

### 10. The Validation Protocol

#### Pre-Publication Checklist
```markdown
## Quality Checklist
### Structure
- [ ] All 7 sacred sections present
- [ ] Sections in correct order
- [ ] Headers use proper hierarchy (# ## ###)
- [ ] No section exceeds 7±2 items

### Content
- [ ] All commands are copy-pasteable
- [ ] All paths are accurate
- [ ] All versions are specified
- [ ] All placeholders use [brackets]

### Clarity
- [ ] No ambiguous terms used
- [ ] No circular references
- [ ] No unexplained acronyms
- [ ] No assumptions about prior knowledge

### Completeness
- [ ] Setup instructions tested on clean machine
- [ ] All error scenarios addressed
- [ ] All workflows documented
- [ ] All constraints explicitly stated
```

#### The AI Assistant Test
Run this mental simulation:
```markdown
## AI Readability Test
Imagine Claude Code reading this line-by-line:

1. Can it understand what to do without human clarification?
2. Are all commands explicit and complete?
3. Are all decision points clearly marked?
4. Are all constraints and limitations stated?
5. Can it detect when something goes wrong?

If ANY answer is "no", revise that section.
```

### 11. The Maintenance Mandate

#### Version Control Integration
```markdown
## Documentation Maintenance Rules

### When to Update CLAUDE.md
- [ ] BEFORE merging any PR that changes:
  - Project structure
  - Dependencies
  - Build/deploy process
  - Environment variables
  - API contracts

### Update Template
```markdown
## Change Log Entry
### [Date] - [Version] - [Author]
#### Changed
- [What changed]
- [Why it changed]
#### Impact
- [How this affects development workflow]
```
```

#### Deprecation Protocol
```markdown
## Handling Deprecated Information

### Mark Deprecation
~~[Old Method]~~ **DEPRECATED as of [date]**
Use [New Method] instead:
```bash
[new command]
```

### Removal Timeline
1. Mark as deprecated → Wait 1 sprint
2. Move to "Deprecated" section → Wait 1 sprint
3. Remove entirely → Archive in history
```

---

## Part V: Special Situations

### 12. Complex Project Adaptations

#### Monorepo Documentation
```markdown
# Monorepo Root CLAUDE.md

## Structure
- `/packages/api/` - [See ./packages/api/CLAUDE.md]
- `/packages/web/` - [See ./packages/web/CLAUDE.md]
- `/packages/shared/` - [See ./packages/shared/CLAUDE.md]

## Cross-Package Operations
[Document only what spans multiple packages]
```

#### Microservices Documentation
```markdown
## Service Communication Map
```mermaid
graph LR
    A[API Gateway] --> B[Auth Service]
    A --> C[User Service]
    C --> D[Database]
    B --> D
```

## Inter-Service Contracts
[Link to OpenAPI specs or Protocol Buffers]
```

#### Legacy System Documentation
```markdown
## ⚠️ Legacy Constraints
### Do NOT Modify
- `src/legacy/` - Contains [reason why untouchable]
- Database table `old_users` - [Migration planned Q3]

### Known Issues (Won't Fix)
- [Issue 1] - Workaround: [specific steps]
- [Issue 2] - Workaround: [specific steps]
```

### 13. The Emergency Procedures

#### When Documentation Fails
```markdown
## Break Glass Procedures

### If Setup Fails
1. Check [troubleshooting guide]
2. Verify [prerequisites]
3. Contact: [person/channel]
4. Fallback: [alternative method]

### If Deployment Fails
1. Rollback: [exact command]
2. Logs: [where to find them]
3. Escalate: [to whom]
```

---

## Part VI: Meta-Rules for Rule Writers

### 14. The Documentation Philosophy

#### Core Principles Hierarchy
1. **Accuracy** > Completeness > Brevity
2. **Clarity** > Elegance > Conciseness  
3. **Practicality** > Theory > Best Practices
4. **Explicit** > Implicit > Assumed

#### The Golden Questions
Before finalizing any section, ask:
1. Would a new developer understand this in 6 months?
2. Would an AI assistant execute this correctly?
3. Would you understand this if you had amnesia?
4. Would this work on a fresh machine?
5. Would this survive a critical production incident?

### 15. The Final Validation

#### The CLAUDE.md Score Card
Rate each section 1-5:

```markdown
## Scoring Rubric
### Clarity (Can someone understand it?)
- 5: Crystal clear to anyone
- 4: Clear with minimal context
- 3: Requires some prior knowledge
- 2: Confusing without help
- 1: Incomprehensible

### Completeness (Is everything there?)
- 5: Exhaustive coverage
- 4: All essentials covered
- 3: Most things covered
- 2: Missing critical info
- 1: Skeleton only

### Correctness (Does it work?)
- 5: Tested and verified
- 4: Should work as written
- 3: Mostly correct
- 2: Contains errors
- 1: Fundamentally wrong

### Consistency (Is it uniform?)
- 5: Perfect consistency
- 4: Minor variations
- 3: Some inconsistencies
- 2: Many inconsistencies
- 1: Chaotic

### Conciseness (Is it efficient?)
- 5: Perfectly balanced
- 4: Slightly verbose
- 3: Acceptable length
- 2: Too long/short
- 1: Extremely unbalanced

Target: All sections ≥4, total ≥20/25
```

---

## Appendix A: Templates

### Minimal CLAUDE.md Template
```markdown
# [Project Name]

## Project Overview
[2-4 sentences]

## Tech Stack
- **Language**: [X]
- **Framework**: [Y]
- **Database**: [Z]

## Setup
```bash
[setup commands]
```

## Development
```bash
[common commands]
```

## Deployment
```bash
[deploy command]
```
```

### Standard CLAUDE.md Template
[Use the structure from Part II, Section 4]

### Enterprise CLAUDE.md Template
[Standard + Security, Compliance, Monitoring sections]

---

## Appendix B: Common Patterns Library

### Pattern: Multi-Environment Configuration
```markdown
## Environments
### Development
- URL: http://localhost:3000
- Database: local PostgreSQL
- Queue: local Redis

### Staging
- URL: https://staging.example.com
- Database: RDS staging instance
- Queue: SQS staging queue

### Production
- URL: https://api.example.com
- Database: RDS production cluster
- Queue: SQS production queue
```

### Pattern: Error Handling Documentation
```markdown
## Error Handling
### Common Errors
| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Database down | Check DB status |
| `TIMEOUT` | Slow query | Optimize query |
| `AUTH_FAILED` | Bad credentials | Verify env vars |
```

### Pattern: Debugging Guide
```markdown
## Debugging
### Enable Debug Mode
```bash
DEBUG=* npm start
```

### Check Logs
- Application: `logs/app.log`
- Errors: `logs/error.log`
- Access: CloudWatch group `/aws/lambda/[name]`
```

---

## Appendix C: Anti-Pattern Recognition Guide

### Red Flags Checklist
- [ ] Using "etc." without full list
- [ ] Saying "just" or "simply" (minimizes complexity)
- [ ] Missing error handling docs
- [ ] No time estimates for long processes
- [ ] Circular section references
- [ ] Untested setup instructions
- [ ] Version numbers missing
- [ ] No troubleshooting section
- [ ] Assumes specific OS without stating
- [ ] No rollback procedures

---

## Final Meta-Rule

**The Documentation Paradox**: The moment you think your documentation is complete, it's already outdated. Therefore:

1. **Date everything**: Add timestamps to time-sensitive information
2. **Version everything**: Include version numbers for all tools
3. **Review everything**: Schedule quarterly documentation reviews
4. **Question everything**: If you're unsure, be explicit about uncertainty

Remember: **Perfect documentation doesn't exist, but terrible documentation is everywhere. Aim for "good enough to prevent disasters" and iterate from there.**
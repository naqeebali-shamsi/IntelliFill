# Contributing to QuikAdmin Web

Thank you for your interest in contributing to QuikAdmin Web! This guide will help you get started.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/quikadmin-web.git
   cd quikadmin-web
   ```
3. **Install dependencies**:
   ```bash
   bun install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### 1. Make Your Changes

- Follow our [Coding Standards](./standards/README.md)
- Write tests for new features
- Update documentation as needed
- Keep commits focused and atomic

### 2. Test Your Changes

```bash
# Run unit tests
bun run test

# Run E2E tests
bun run test:e2e

# Type check
bun run typecheck

# Build to verify
bun run build
```

### 3. Commit Your Changes

We use conventional commits:

```bash
# Format: <type>(<scope>): <subject>

git commit -m "feat(upload): add drag and drop support"
git commit -m "fix(auth): resolve token refresh issue"
git commit -m "docs(readme): update installation steps"
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Standards

- **TypeScript**: Use strict typing
- **Components**: Functional components with hooks
- **Styling**: TailwindCSS utility classes
- **Testing**: Write tests for all features
- **Documentation**: Update docs for public APIs

## Pull Request Guidelines

### PR Title
Use conventional commit format:
```
feat(component): add new upload component
```

### PR Description
Include:
- **What**: Description of changes
- **Why**: Reason for changes
- **How**: Implementation approach
- **Testing**: How to test the changes
- **Screenshots**: For UI changes

### Checklist
- [ ] Tests pass
- [ ] TypeScript check passes
- [ ] Documentation updated
- [ ] No console errors
- [ ] Follows coding standards

## Review Process

1. **Automated checks** run on all PRs
2. **Code review** by maintainers
3. **Changes requested** (if needed)
4. **Approval** and merge

## Questions?

- Check [Documentation](../README.md)
- Review [Troubleshooting](../reference/troubleshooting/README.md)
- Ask in team chat
- Open a discussion on GitHub

---

[Back to Development](./README.md)

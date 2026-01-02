#!/usr/bin/env python3
"""
Security Audit Checklist Generator
Scans codebase for security-relevant patterns and generates audit checklist.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Set

AUDIT_FILE = Path(".taskmaster/docs/security-audit.md")


def scan_for_patterns(directory: str = ".") -> Dict[str, List[str]]:
    """Scan codebase for security-relevant patterns."""
    patterns = {
        "authentication": [
            r"(bcrypt|argon2|scrypt)",
            r"(password|passwd)\s*[:=]",
            r"(jwt|token)\.sign",
            r"(session|cookie)\.set"
        ],
        "oauth": [
            r"oauth",
            r"(access_token|refresh_token)",
            r"authorization.*code"
        ],
        "database": [
            r"(SELECT|INSERT|UPDATE|DELETE).*FROM",
            r"\.query\(",
            r"\.execute\(",
            r"prisma\."
        ],
        "encryption": [
            r"crypto\.",
            r"encrypt|decrypt",
            r"(aes|rsa|hmac)"
        ],
        "http": [
            r"https?://",
            r"cors\(",
            r"helmet\(",
            r"(csrf|xsrf)"
        ],
        "secrets": [
            r"(api_key|secret|password|token)\s*[:=]\s*['\"]",
            r"\.env",
            r"process\.env\."
        ]
    }

    findings = {category: [] for category in patterns.keys()}
    file_count = 0

    # Search through source files
    for root, dirs, files in os.walk(directory):
        # Skip node_modules, .git, etc.
        dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', 'dist', 'build', '.taskmaster'}]

        for file in files:
            if not file.endswith(('.ts', '.js', '.tsx', '.jsx', '.py')):
                continue

            file_path = os.path.join(root, file)
            file_count += 1

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                    for category, pattern_list in patterns.items():
                        for pattern in pattern_list:
                            if re.search(pattern, content, re.IGNORECASE):
                                rel_path = os.path.relpath(file_path, directory)
                                if rel_path not in findings[category]:
                                    findings[category].append(rel_path)
                                break  # One match per category per file

            except Exception:
                continue

    return findings


def generate_checklist(findings: Dict[str, List[str]]) -> str:
    """Generate security audit checklist based on findings."""
    checklist = []

    checklist.append("# Security Audit Checklist\n")
    checklist.append(f"Generated: {subprocess.check_output(['date', '-u']).decode().strip()}\n")
    checklist.append("---\n\n")

    # Authentication
    if findings["authentication"]:
        checklist.append("## Authentication\n\n")
        checklist.append("### Password Security\n")
        checklist.append("- [ ] Passwords hashed with bcrypt (cost ≥ 10) or argon2\n")
        checklist.append("- [ ] No plaintext passwords in database\n")
        checklist.append("- [ ] Password reset tokens cryptographically secure\n")
        checklist.append("- [ ] Password reset tokens expire (< 1 hour)\n\n")

        checklist.append("### Session Security\n")
        checklist.append("- [ ] Session tokens cryptographically random (≥ 128 bits entropy)\n")
        checklist.append("- [ ] Session cookies have `HttpOnly` flag\n")
        checklist.append("- [ ] Session cookies have `Secure` flag (HTTPS only)\n")
        checklist.append("- [ ] Session cookies have `SameSite=Strict` or `SameSite=Lax`\n")
        checklist.append("- [ ] Sessions expire after reasonable timeout\n\n")

        checklist.append(f"**Files to review**: {', '.join(findings['authentication'][:5])}\n\n")

    # OAuth
    if findings["oauth"]:
        checklist.append("## OAuth / Token Security\n\n")
        checklist.append("- [ ] OAuth tokens encrypted at rest\n")
        checklist.append("- [ ] OAuth state parameter prevents CSRF\n")
        checklist.append("- [ ] Refresh tokens stored in httpOnly cookies (not localStorage)\n")
        checklist.append("- [ ] Access tokens have short expiration (≤ 1 hour)\n")
        checklist.append("- [ ] Token refresh implements rate limiting\n\n")

        checklist.append(f"**Files to review**: {', '.join(findings['oauth'][:5])}\n\n")

    # Database
    if findings["database"]:
        checklist.append("## Database Security\n\n")
        checklist.append("- [ ] All queries use parameterized statements (no string concatenation)\n")
        checklist.append("- [ ] No SQL injection vulnerabilities\n")
        checklist.append("- [ ] Row-Level Security (RLS) enabled on sensitive tables\n")
        checklist.append("- [ ] Database credentials not hardcoded\n")
        checklist.append("- [ ] Database access uses principle of least privilege\n\n")

        checklist.append(f"**Files to review**: {', '.join(findings['database'][:5])}\n\n")

    # Encryption
    if findings["encryption"]:
        checklist.append("## Encryption\n\n")
        checklist.append("- [ ] Sensitive data encrypted at rest\n")
        checklist.append("- [ ] Strong encryption algorithms used (AES-256, RSA-2048+)\n")
        checklist.append("- [ ] Encryption keys rotated periodically\n")
        checklist.append("- [ ] No hardcoded encryption keys\n\n")

        checklist.append(f"**Files to review**: {', '.join(findings['encryption'][:5])}\n\n")

    # HTTP Security
    if findings["http"]:
        checklist.append("## HTTP Security\n\n")
        checklist.append("- [ ] HTTPS enforced in production (no HTTP)\n")
        checklist.append("- [ ] CORS configured properly (not `*` in production)\n")
        checklist.append("- [ ] Security headers set:\n")
        checklist.append("  - [ ] `X-Frame-Options: DENY` or `SAMEORIGIN`\n")
        checklist.append("  - [ ] `X-Content-Type-Options: nosniff`\n")
        checklist.append("  - [ ] `Content-Security-Policy` configured\n")
        checklist.append("  - [ ] `Strict-Transport-Security` (HSTS)\n")
        checklist.append("- [ ] CSRF protection enabled\n")
        checklist.append("- [ ] Rate limiting on auth endpoints\n\n")

        checklist.append(f"**Files to review**: {', '.join(findings['http'][:5])}\n\n")

    # Secrets Management
    if findings["secrets"]:
        checklist.append("## Secrets Management\n\n")
        checklist.append("- [ ] No secrets hardcoded in source code\n")
        checklist.append("- [ ] All secrets in `.env` file (gitignored)\n")
        checklist.append("- [ ] `.env.example` provides template without real values\n")
        checklist.append("- [ ] Secrets validation at startup (fail if missing)\n")
        checklist.append("- [ ] Production secrets rotated regularly\n\n")

        checklist.append(f"**Files to review**: {', '.join(findings['secrets'][:5])}\n\n")

    # General Security
    checklist.append("## General Security\n\n")
    checklist.append("- [ ] Dependencies up to date (run `npm audit`)\n")
    checklist.append("- [ ] No known vulnerabilities in dependencies\n")
    checklist.append("- [ ] Error messages don't leak sensitive info\n")
    checklist.append("- [ ] Logging doesn't include sensitive data\n")
    checklist.append("- [ ] File uploads validated (type, size, content)\n")
    checklist.append("- [ ] User input sanitized/validated\n\n")

    checklist.append("---\n\n")
    checklist.append("## Automated Scans\n\n")
    checklist.append("Run these automated security scans:\n\n")
    checklist.append("```bash\n")
    checklist.append("# Dependency vulnerabilities\n")
    checklist.append("npm audit\n\n")
    checklist.append("# Git secrets scanning\n")
    checklist.append("git log -p | grep -i 'password\\|secret\\|api[_-]key' || echo 'No secrets found in git history'\n\n")
    checklist.append("# Check for hardcoded secrets in code\n")
    checklist.append("grep -r \"password.*=.*['\\\"]\" --include=\"*.ts\" --include=\"*.js\" . || echo 'No hardcoded passwords'\n")
    checklist.append("```\n")

    return "".join(checklist)


def run_automated_scans() -> None:
    """Run automated security scans."""
    print("🔍 Running automated security scans...\n")

    # NPM audit
    print("1. Dependency Vulnerabilities (npm audit):")
    try:
        result = subprocess.run(["npm", "audit"], capture_output=True, text=True, cwd="quikadmin")
        if "0 vulnerabilities" in result.stdout:
            print("   ✅ No vulnerabilities found")
        else:
            print("   ⚠️  Vulnerabilities found - review output:")
            print(result.stdout[:500])
    except Exception as e:
        print(f"   ⚠️  Could not run npm audit: {e}")

    print()

    # Check for secrets in git history
    print("2. Git History Secrets Scan:")
    try:
        result = subprocess.run(
            ["git", "log", "-p", "--all"],
            capture_output=True,
            text=True
        )
        secret_patterns = re.findall(
            r'(password|secret|api[_-]?key)\s*[:=]\s*[\'"][^\'"]{8,}',
            result.stdout,
            re.IGNORECASE
        )
        if secret_patterns:
            print(f"   ⚠️  Found {len(secret_patterns)} potential secrets in git history")
            print("   ⚠️  Review git history for exposed secrets")
        else:
            print("   ✅ No obvious secrets found in git history")
    except Exception as e:
        print(f"   ⚠️  Could not scan git history: {e}")

    print()


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 security-audit.py generate")
        print("  python3 security-audit.py scan")
        print("  python3 security-audit.py full")
        sys.exit(1)

    command = sys.argv[1]

    if command == "generate":
        print("🔒 Generating security audit checklist...")
        findings = scan_for_patterns(".")
        checklist = generate_checklist(findings)

        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_FILE, 'w') as f:
            f.write(checklist)

        print(f"✅ Checklist generated: {AUDIT_FILE}")
        print()
        print("Categories found:")
        for category, files in findings.items():
            if files:
                print(f"  - {category}: {len(files)} files")

    elif command == "scan":
        run_automated_scans()

    elif command == "full":
        print("🔒 Full Security Audit\n")
        print("Step 1: Generating checklist...")
        findings = scan_for_patterns(".")
        checklist = generate_checklist(findings)

        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_FILE, 'w') as f:
            f.write(checklist)

        print(f"✅ Checklist: {AUDIT_FILE}\n")

        print("Step 2: Running automated scans...")
        run_automated_scans()

        print("\n✅ Security audit complete!")
        print(f"   Review: {AUDIT_FILE}")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()

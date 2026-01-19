// Phase 4: Runtime Validation Script for Batch 1 (Auth & Security)
import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:8080';

async function validatePage(page, route, elementChecks) {
  const url = `${BASE_URL}${route}`;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VALIDATING: ${route}`);
  console.log(`${'='.repeat(60)}`);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
  await page.waitForTimeout(1000); // Allow React to render

  const results = {
    route,
    url,
    timestamp: new Date().toISOString(),
    elements: []
  };

  for (const check of elementChecks) {
    const result = await validateElement(page, check);
    results.elements.push(result);
    console.log(`  ${result.found ? '✓' : '✗'} ${check.name}: ${result.found ? result.details : 'NOT FOUND'}`);
  }

  // Screenshot for evidence
  const screenshotPath = `N:/IntelliFill/.taskmaster/docs/ui-discovery/screenshots/auth${route.replace(/\//g, '-')}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  📸 Screenshot saved: ${screenshotPath}`);

  return results;
}

async function validateElement(page, check) {
  const { name, selectors, type, expectedText } = check;

  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const details = await page.evaluate((el, expectedType) => {
          const tagName = el.tagName.toLowerCase();
          const inputType = el.getAttribute('type') || '';
          const text = el.textContent?.trim() || '';
          const placeholder = el.getAttribute('placeholder') || '';
          const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
          const checked = el.checked;
          const dataTestId = el.getAttribute('data-testid') || '';
          const name = el.getAttribute('name') || '';
          const id = el.id || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const role = el.getAttribute('role') || '';

          return {
            tagName,
            inputType,
            text: text.substring(0, 50),
            placeholder,
            disabled,
            checked,
            dataTestId,
            name,
            id,
            ariaLabel,
            role,
            visible: el.offsetParent !== null
          };
        }, element, type);

        return {
          name,
          found: true,
          selector,
          details: JSON.stringify(details)
        };
      }
    } catch (e) {
      // Selector didn't work, try next
    }
  }

  return { name, found: false, selectors };
}

async function main() {
  console.log('Phase 4: Runtime Validation - Batch 1 (Auth & Security)');
  console.log('Connecting to Chrome...');

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Create screenshots directory
  const fs = await import('fs');
  const screenshotDir = 'N:/IntelliFill/.taskmaster/docs/ui-discovery/screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const allResults = [];

  // 1. LOGIN PAGE
  const loginResults = await validatePage(page, '/login', [
    {
      name: 'auth-login-form',
      selectors: ['form', '[data-testid="login-form"]', '.login-form'],
      type: 'form'
    },
    {
      name: 'login-email-input',
      selectors: ['input[name="email"]', 'input[type="email"]', '#email', '[data-testid="email-input"]'],
      type: 'input'
    },
    {
      name: 'login-password-input',
      selectors: ['input[name="password"]', 'input[type="password"]', '#password', '[data-testid="password-input"]'],
      type: 'input'
    },
    {
      name: 'auth-login-submit',
      selectors: ['button[type="submit"]', '[data-testid="login-button"]', 'button:has-text("Sign in")', 'button:has-text("Login")'],
      type: 'button'
    },
    {
      name: 'auth-remember-me-toggle',
      selectors: ['input[name="rememberMe"]', '[data-testid="remember-me"]', '#rememberMe', 'input[type="checkbox"]'],
      type: 'checkbox'
    },
    {
      name: 'auth-password-visibility-toggle',
      selectors: ['button[aria-label*="password"]', '[data-testid="toggle-password"]', '.password-toggle', 'button:has(svg)'],
      type: 'button'
    },
    {
      name: 'auth-demo-login',
      selectors: ['[data-testid="demo-login"]', 'button:has-text("Demo")', 'button:has-text("demo")', '.demo-login'],
      type: 'button'
    },
    {
      name: 'forgot-password-link',
      selectors: ['a[href*="forgot"]', '[data-testid="forgot-password-link"]', 'a:has-text("Forgot")'],
      type: 'link'
    },
    {
      name: 'register-link',
      selectors: ['a[href*="register"]', '[data-testid="register-link"]', 'a:has-text("Sign up")', 'a:has-text("Register")'],
      type: 'link'
    }
  ]);
  allResults.push(loginResults);

  // 2. REGISTER PAGE
  const registerResults = await validatePage(page, '/register', [
    {
      name: 'auth-register-form',
      selectors: ['form', '[data-testid="register-form"]', '.register-form'],
      type: 'form'
    },
    {
      name: 'register-email-input',
      selectors: ['input[name="email"]', 'input[type="email"]', '#email'],
      type: 'input'
    },
    {
      name: 'register-password-input',
      selectors: ['input[name="password"]', 'input[type="password"]:first-of-type', '#password'],
      type: 'input'
    },
    {
      name: 'register-confirm-password-input',
      selectors: ['input[name="confirmPassword"]', 'input[name="passwordConfirm"]', '#confirmPassword'],
      type: 'input'
    },
    {
      name: 'auth-register-submit',
      selectors: ['button[type="submit"]', '[data-testid="register-button"]'],
      type: 'button'
    },
    {
      name: 'auth-terms-toggle',
      selectors: ['input[name="terms"]', '[data-testid="terms-checkbox"]', '#terms', 'input[type="checkbox"]'],
      type: 'checkbox'
    },
    {
      name: 'auth-marketing-toggle',
      selectors: ['input[name="marketing"]', '[data-testid="marketing-checkbox"]', '#marketing'],
      type: 'checkbox'
    },
    {
      name: 'auth-password-visibility-toggle',
      selectors: ['button[aria-label*="password"]', '[data-testid="toggle-password"]', 'button:has(svg)'],
      type: 'button'
    },
    {
      name: 'login-link',
      selectors: ['a[href*="login"]', '[data-testid="login-link"]', 'a:has-text("Sign in")'],
      type: 'link'
    }
  ]);
  allResults.push(registerResults);

  // 3. FORGOT PASSWORD PAGE
  const forgotResults = await validatePage(page, '/forgot-password', [
    {
      name: 'auth-forgot-password-form',
      selectors: ['form', '[data-testid="forgot-password-form"]'],
      type: 'form'
    },
    {
      name: 'forgot-email-input',
      selectors: ['input[name="email"]', 'input[type="email"]', '#email'],
      type: 'input'
    },
    {
      name: 'auth-forgot-password-submit',
      selectors: ['button[type="submit"]', '[data-testid="forgot-password-button"]'],
      type: 'button'
    },
    {
      name: 'back-to-login-link',
      selectors: ['a[href*="login"]', '[data-testid="back-to-login"]', 'a:has-text("Back")'],
      type: 'link'
    }
  ]);
  allResults.push(forgotResults);

  // 4. RESET PASSWORD PAGE (needs token, will likely redirect or show error)
  const resetResults = await validatePage(page, '/reset-password', [
    {
      name: 'auth-reset-password-form',
      selectors: ['form', '[data-testid="reset-password-form"]'],
      type: 'form'
    },
    {
      name: 'reset-password-input',
      selectors: ['input[name="password"]', 'input[type="password"]', '#password'],
      type: 'input'
    },
    {
      name: 'reset-confirm-password-input',
      selectors: ['input[name="confirmPassword"]', '#confirmPassword'],
      type: 'input'
    },
    {
      name: 'auth-reset-password-submit',
      selectors: ['button[type="submit"]', '[data-testid="reset-password-button"]'],
      type: 'button'
    }
  ]);
  allResults.push(resetResults);

  // 5. VERIFY EMAIL PAGE
  const verifyResults = await validatePage(page, '/verify-email', [
    {
      name: 'auth-verify-email-form',
      selectors: ['form', '[data-testid="verify-email-form"]'],
      type: 'form'
    },
    {
      name: 'auth-resend-verification',
      selectors: ['button:has-text("Resend")', '[data-testid="resend-verification"]', 'button:has-text("resend")'],
      type: 'button'
    },
    {
      name: 'verify-code-input',
      selectors: ['input[name="code"]', 'input[name="token"]', '#code', 'input[type="text"]'],
      type: 'input'
    }
  ]);
  allResults.push(verifyResults);

  // 6. ACCEPT INVITE PAGE
  const inviteResults = await validatePage(page, '/accept-invite', [
    {
      name: 'invite-accept-mutation',
      selectors: ['button:has-text("Accept")', '[data-testid="accept-invite"]', 'button[type="submit"]'],
      type: 'button'
    },
    {
      name: 'invite-decline-link',
      selectors: ['a:has-text("Decline")', 'button:has-text("Decline")', '[data-testid="decline-invite"]'],
      type: 'button'
    }
  ]);
  allResults.push(inviteResults);

  // Write results to file
  const outputPath = 'N:/IntelliFill/.taskmaster/docs/ui-discovery/phase4-runtime-validation-batch1.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results written to: ${outputPath}`);
  console.log(`${'='.repeat(60)}`);

  // Generate summary
  let totalElements = 0;
  let foundElements = 0;
  for (const result of allResults) {
    for (const el of result.elements) {
      totalElements++;
      if (el.found) foundElements++;
    }
  }

  console.log(`\nSUMMARY:`);
  console.log(`  Total elements checked: ${totalElements}`);
  console.log(`  Found: ${foundElements}`);
  console.log(`  Missing: ${totalElements - foundElements}`);
  console.log(`  Coverage: ${((foundElements / totalElements) * 100).toFixed(1)}%`);

  await page.close();
  console.log('\nValidation complete!');
}

main().catch(console.error);

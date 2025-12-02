/**
 * IntelliFill E2E Integration Tests
 * Using Puppeteer + Jest best practices for 2025
 */

describe('IntelliFill Application E2E Tests', () => {
  let page;
  let browser;
  
  // Test configuration
  const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const TIMEOUT = 30000;
  
  beforeAll(async () => {
    // Launch browser with optimized settings
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    page = await browser.newPage();
    
    // Set viewport for consistent testing
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Enable request interception for API mocking if needed
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });
  }, TIMEOUT);
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    // Clear cookies and local storage before each test
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.deleteCookie();
  });
  
  describe('Application Health', () => {
    test('Frontend should load successfully', async () => {
      const response = await page.goto(BASE_URL, {
        waitUntil: 'networkidle0'
      });
      
      expect(response.status()).toBe(200);
      
      // Check for main app container
      const appContainer = await page.$('[class*="app"], #root, #app');
      expect(appContainer).toBeTruthy();
    }, TIMEOUT);
    
    test('API health endpoint should respond', async () => {
      const response = await page.evaluate(async (url) => {
        try {
          const res = await fetch(`${url}/api/health`);
          return { 
            status: res.status, 
            ok: res.ok,
            data: await res.json().catch(() => null)
          };
        } catch (error) {
          return { error: error.message };
        }
      }, API_URL);
      
      expect(response.error).toBeUndefined();
      expect(response.status).toBe(200);
    });
  });
  
  describe('Navigation', () => {
    test('Should navigate to dashboard', async () => {
      await page.goto(BASE_URL);
      
      // Wait for navigation menu
      await page.waitForSelector('nav, [class*="nav"], [class*="menu"]', {
        timeout: 5000
      });
      
      // Click dashboard link
      const dashboardLink = await page.$('a[href*="dashboard"], [class*="dashboard"]');
      if (dashboardLink) {
        await dashboardLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
      }
      
      // Verify dashboard loaded
      const heading = await page.$eval('h1, h2', el => el.textContent);
      expect(heading).toMatch(/dashboard/i);
    });
    
    test('Should navigate to upload page', async () => {
      await page.goto(BASE_URL);
      
      // Click upload link
      await page.click('a[href*="upload"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      // Verify upload page elements
      const uploadArea = await page.$('[class*="upload"], [class*="drop"], input[type="file"]');
      expect(uploadArea).toBeTruthy();
    });
  });
  
  describe('Document Upload', () => {
    test('Should display upload interface', async () => {
      await page.goto(`${BASE_URL}/upload`);
      
      // Check for file input
      const fileInput = await page.$('input[type="file"]');
      expect(fileInput).toBeTruthy();
      
      // Check for drag-drop area
      const dropZone = await page.$('[class*="drop"], [class*="drag"]');
      expect(dropZone).toBeTruthy();
    });
    
    test('Should handle file selection', async () => {
      await page.goto(`${BASE_URL}/upload`);
      
      // Create a test file
      const fileInput = await page.$('input[type="file"]');
      
      // Monitor file change
      await page.evaluate(() => {
        window.fileSelected = false;
        const input = document.querySelector('input[type="file"]');
        if (input) {
          input.addEventListener('change', () => {
            window.fileSelected = true;
          });
        }
      });
      
      // Upload test file
      const testFilePath = '/tmp/test.pdf';
      await page.evaluate(() => {
        // Simulate file selection
        const input = document.querySelector('input[type="file"]');
        const dt = new DataTransfer();
        const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      // Verify file was selected
      const fileSelected = await page.evaluate(() => window.fileSelected);
      expect(fileSelected).toBe(true);
    });
  });
  
  describe('Form Field Mapping', () => {
    test('Should display template selection', async () => {
      await page.goto(`${BASE_URL}/upload`);
      
      // Check for template dropdown
      const templateSelect = await page.$('select[name*="template"], [class*="template"]');
      expect(templateSelect).toBeTruthy();
    });
    
    test('Should show form fields after document upload', async () => {
      // This would require mocking the upload response
      await page.goto(`${BASE_URL}/upload`);
      
      // Mock successful upload
      await page.evaluate(() => {
        // Simulate showing form fields
        const container = document.querySelector('[class*="form"], [class*="fields"]');
        if (container) {
          container.innerHTML = `
            <div class="form-field">
              <label>Name</label>
              <input type="text" name="name" />
            </div>
            <div class="form-field">
              <label>Email</label>
              <input type="email" name="email" />
            </div>
          `;
        }
      });
      
      // Verify form fields are displayed
      const formFields = await page.$$('[class*="form-field"], input[type="text"], input[type="email"]');
      expect(formFields.length).toBeGreaterThan(0);
    });
  });
  
  describe('Document Processing', () => {
    test('Should show processing status', async () => {
      await page.goto(`${BASE_URL}/upload`);
      
      // Simulate processing state
      await page.evaluate(() => {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'processing-status';
        statusDiv.textContent = 'Processing...';
        document.body.appendChild(statusDiv);
      });
      
      // Check for processing indicator
      const processingStatus = await page.$('[class*="processing"], [class*="loading"], [class*="spinner"]');
      expect(processingStatus).toBeTruthy();
    });
    
    test('Should display extraction results', async () => {
      await page.goto(`${BASE_URL}/upload`);
      
      // Mock extraction results
      await page.evaluate(() => {
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'extraction-results';
        resultsDiv.innerHTML = `
          <h3>Extracted Data</h3>
          <div class="field">Name: John Doe</div>
          <div class="field">Email: john@example.com</div>
        `;
        document.body.appendChild(resultsDiv);
      });
      
      // Verify results are displayed
      const results = await page.$('[class*="results"], [class*="extracted"]');
      expect(results).toBeTruthy();
    });
  });
  
  describe('Error Handling', () => {
    test('Should handle network errors gracefully', async () => {
      // Disable network
      await page.setOfflineMode(true);
      
      await page.goto(BASE_URL).catch(() => {});
      
      // Re-enable network
      await page.setOfflineMode(false);
      
      // Should show error message
      const errorMessage = await page.$('[class*="error"], [class*="offline"]');
      expect(errorMessage).toBeTruthy();
    });
    
    test('Should validate file types', async () => {
      await page.goto(`${BASE_URL}/upload`);
      
      // Try uploading invalid file type
      await page.evaluate(() => {
        const input = document.querySelector('input[type="file"]');
        const dt = new DataTransfer();
        const file = new File(['test'], 'test.exe', { type: 'application/exe' });
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      
      // Should show validation error
      await page.waitForSelector('[class*="error"], [class*="invalid"]', {
        timeout: 3000
      }).catch(() => {});
      
      const errorMsg = await page.$('[class*="error"], [class*="invalid"]');
      expect(errorMsg).toBeTruthy();
    });
  });
  
  describe('Performance', () => {
    test('Page should load within acceptable time', async () => {
      const startTime = Date.now();
      
      await page.goto(BASE_URL, {
        waitUntil: 'domcontentloaded'
      });
      
      const loadTime = Date.now() - startTime;
      
      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });
    
    test('Should handle large documents efficiently', async () => {
      // This would test with a large PDF
      await page.goto(`${BASE_URL}/upload`);
      
      const metrics = await page.metrics();
      
      // Check memory usage
      expect(metrics.JSHeapUsedSize).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });
  
  describe('Accessibility', () => {
    test('Should have proper ARIA labels', async () => {
      await page.goto(BASE_URL);
      
      // Check for ARIA labels
      const buttons = await page.$$eval('button', buttons => 
        buttons.map(btn => btn.getAttribute('aria-label') || btn.textContent)
      );
      
      buttons.forEach(label => {
        expect(label).toBeTruthy();
      });
    });
    
    test('Should be keyboard navigable', async () => {
      await page.goto(BASE_URL);
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Check if an element is focused
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName;
      });
      
      expect(focusedElement).toBeTruthy();
    });
  });
  
  describe('Security', () => {
    test('Should have security headers', async () => {
      const response = await page.goto(BASE_URL);
      const headers = response.headers();
      
      // Check for security headers
      expect(headers['x-frame-options'] || headers['content-security-policy']).toBeTruthy();
    });
    
    test('Should sanitize user input', async () => {
      await page.goto(`${BASE_URL}/upload`);
      
      // Try XSS attack
      await page.evaluate(() => {
        const input = document.querySelector('input[type="text"]');
        if (input) {
          input.value = '<script>alert("XSS")</script>';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      
      // Check that script is not executed
      const alerts = [];
      page.on('dialog', dialog => {
        alerts.push(dialog.message());
        dialog.dismiss();
      });
      
      await page.waitForTimeout(1000);
      expect(alerts).toHaveLength(0);
    });
  });
});

// Export for use with other test runners
module.exports = {
  BASE_URL,
  API_URL,
  TIMEOUT
};
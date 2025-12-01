# Running OCR E2E Tests

## Quick Start

The OCR E2E test suite is ready to run. Here's how:

### Prerequisites

1. **Backend must be running** on `http://localhost:3002`
   ```bash
   cd quikadmin
   npm run dev
   ```

2. **Sample files must exist** in `sample-pdfs/` directory:
   - `passport-sample.pdf`
   - `passport-sample-form.pdf`
   - `emirated-id-sample.jpeg`
   - `ejari.pdf`

### Running Tests

```bash
cd quikadmin

# Option 1: Using npm script
npm run test:ocr-e2e

# Option 2: Direct execution
npx ts-node tests/ocr-e2e-test.ts

# Option 3: With custom API URL
API_URL=http://localhost:3002 npx ts-node tests/ocr-e2e-test.ts
```

### Simple Connectivity Test

Before running full tests, verify setup:

```bash
cd quikadmin
node tests/test-ocr-simple.js
```

This will check:
- ✅ Backend is running
- ✅ Authentication works
- ✅ Ready for full tests

### Expected Output

The test suite will output:
- 🔐 Authentication status
- 📤 Upload test results
- 📊 Status check results
- ⚙️ Processing results
- 🔄 Reprocessing results
- ❌ Error scenario results
- 🧹 Cleanup results
- 📊 Final summary with pass/fail counts

### Troubleshooting

**No output shown?**
- Check if backend is running: `curl http://localhost:3002/health`
- Verify Node.js version: `node --version` (should be >= 18)
- Check TypeScript: `npx ts-node --version`

**Tests fail immediately?**
- Backend not running → Start with `npm run dev`
- Authentication fails → Check Supabase configuration
- Sample files missing → Verify `sample-pdfs/` directory exists

**Processing timeout?**
- OCR processing can take 30s - 2min per document
- Increase timeout in test code if needed
- Check queue workers are running

### Test Files Created

- `tests/ocr-e2e-test.ts` - Main test suite (636 lines)
- `tests/test-ocr-simple.js` - Simple connectivity check
- `tests/run-ocr-tests.js` - Test runner with logging
- `tests/OCR_E2E_TEST_README.md` - Full documentation
- `tests/OCR_E2E_TEST_SUMMARY.md` - Quick reference

### Next Steps

1. ✅ Test suite created
2. ✅ Documentation added  
3. ✅ npm scripts configured
4. ⏭️ **Run tests to verify** ← You are here
5. ⏭️ Review results
6. ⏭️ Add to CI/CD if needed


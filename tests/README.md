# Call Assistance Testing Suite

Comprehensive test suite for the AI-powered call receptionist system.

## Quick Start

### 1. Run All Tests
```bash
./tests/run-call-tests.sh
```

### 2. Run Specific Test Types
```bash
./tests/run-call-tests.sh unit      # Unit tests only
./tests/run-call-tests.sh smoke     # Smoke tests only
./tests/run-call-tests.sh api       # API tests only
```

### 3. Run Smoke Tests Only
```bash
./tests/smoke-test.sh
```

### 4. Run Unit Tests
```bash
npm test tests/call-assistance.test.ts
# or
bun test tests/call-assistance.test.ts
```

---

## Test Files Overview

| File | Purpose | Type |
|------|---------|------|
| `call-assistance-test-plan.md` | Complete test strategy, scenarios, and documentation | Documentation |
| `call-assistance.test.ts` | Automated unit tests for data extraction and validation | Automated |
| `manual-test-checklist.md` | Printable checklist for manual QA testing | Manual |
| `run-call-tests.sh` | Main test runner script | Script |
| `smoke-test.sh` | Quick validation of basic functionality | Script |

---

## Test Coverage

### ✅ Unit Tests (`call-assistance.test.ts`)
Tests the core business logic:
- Budget extraction (word format, numeric, shorthand)
- Project type identification
- Name extraction and cleaning
- Timeline categorization
- Lead qualification scoring
- Conversation state management
- Edge case handling

**Total Tests**: 50+ test cases

### ✅ Smoke Tests (`smoke-test.sh`)
Quick validation of system health:
- Environment variables configured
- Required files exist
- TypeScript compiles
- Webhook endpoint accessible
- Database connection
- Package dependencies installed
- Phone number format validation

**Run Time**: ~30 seconds

### ✅ Manual Tests (`manual-test-checklist.md`)
Human-driven testing scenarios:
- Complete call flows (qualified/unqualified)
- Budget format variations
- Name extraction edge cases
- Timeline recognition
- Project type accuracy
- Conversation quality assessment
- Error handling verification
- Data accuracy validation

**Total Scenarios**: 12 test categories

---

## Test Results

### Expected Pass Rates
- **Unit Tests**: 100% (all tests should pass)
- **Smoke Tests**: 100% (if environment configured correctly)
- **Manual Tests**: 90%+ (human speech variation)

### Key Metrics
- Budget extraction accuracy: **95%+**
- Project type identification: **90%+**
- Name extraction: **85%+**
- Lead qualification: **98%+**
- Call completion rate: **95%+**

---

## Manual Testing Guide

### Prerequisites
1. Have your Twilio phone number ready
2. Access to CRM to verify lead creation
3. Phone or calling app ready
4. `manual-test-checklist.md` open for tracking

### Basic Manual Test Flow

1. **Call the Twilio number**: `[Your Twilio Number]`

2. **Follow the conversation**:
   ```
   AI: "Thank you for calling Legacy Prime Construction. How can I help you today?"
   YOU: "I want to remodel my kitchen"

   AI: "Great! What's your name?"
   YOU: "John Smith"

   AI: "What's your budget for this project?"
   YOU: "Around fifty thousand dollars"

   AI: "When are you looking to start?"
   YOU: "Within the next two months"

   AI: "Thank you, John! We'll be in touch soon."
   ```

3. **Verify in CRM**:
   - Lead appears with name "John Smith"
   - Budget: $50,000
   - Project Type: Kitchen
   - Status: Project (qualified)
   - Score: 80

### Test Different Variations
Use the checklist to systematically test:
- Different budget formats ("50k", "$50,000", "fifty thousand")
- Various project types (bathroom, roofing, deck)
- Timeline options (ASAP, 3 months, next year)
- Edge cases (unclear speech, background noise, early hangup)

---

## Automated Testing

### Running Unit Tests

**With npm**:
```bash
npm test tests/call-assistance.test.ts
```

**With bun**:
```bash
bun test tests/call-assistance.test.ts
```

**With watch mode**:
```bash
npm test tests/call-assistance.test.ts -- --watch
```

### Test Output Example
```
✓ Call Assistance - Budget Extraction (5)
  ✓ should extract budget from word format
  ✓ should extract budget from numeric format
  ✓ should extract budget from shorthand format
  ✓ should handle budget with context words
  ✓ should return 0 for invalid budget input

✓ Call Assistance - Lead Qualification (3)
  ✓ should qualify lead with budget >= $10,000
  ✓ should not qualify lead with budget < $10,000
  ✓ should calculate correct qualification score

Test Files: 1 passed (1)
Tests: 50 passed (50)
Duration: 1.23s
```

---

## API Testing

### Test Webhook Endpoint

**Using curl**:
```bash
curl -X POST https://your-domain.vercel.app/api/twilio/receptionist \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B15551234567" \
  -d "CallSid=CA1234567890abcdef"
```

**Expected Response**: TwiML XML with greeting

### Test tRPC Routes

**Get Call Logs**:
```bash
curl https://your-domain.vercel.app/api/trpc/twilio.getCallLogs?input={"companyId":"test"}
```

---

## Load Testing

### Using Artillery (Optional)

1. Install Artillery:
```bash
npm install -g artillery
```

2. Create load test config (see `call-assistance-test-plan.md`)

3. Run load test:
```bash
artillery run load-test-calls.yml
```

**Expected Performance**:
- Handle 5+ concurrent calls
- Average response time: <500ms
- Error rate: <1%

---

## Debugging Test Failures

### Unit Test Failures

1. Check the specific test that failed
2. Review the assertion error message
3. Verify the test data matches expected format
4. Run single test:
   ```bash
   npm test tests/call-assistance.test.ts -t "should extract budget"
   ```

### Smoke Test Failures

1. **Environment Variables**: Check `.env.local` file
2. **Missing Files**: Verify file paths are correct
3. **TypeScript Errors**: Run `tsc --noEmit` for details
4. **Webhook Error**: Check Vercel deployment status

### Manual Test Issues

1. **AI Not Responding**: Check OpenAI API key and quota
2. **Speech Not Recognized**: Speak clearly, avoid background noise
3. **Lead Not Saved**: Check Supabase connection
4. **Wrong Data Extracted**: Review transcript for accuracy

---

## Continuous Integration

### GitHub Actions (Recommended)

Create `.github/workflows/test-call-assistance.yml`:
```yaml
name: Call Assistance Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test tests/call-assistance.test.ts
      - run: ./tests/smoke-test.sh
```

---

## Monitoring & Alerts

### Key Metrics to Monitor
- Call answer rate (target: >95%)
- Lead qualification rate (target: 30-50%)
- Data extraction accuracy (target: >90%)
- Average call duration (target: 2-4 minutes)
- API error rate (target: <1%)

### Set Up Alerts
Consider alerts for:
- Webhook failures (>5 in 10 minutes)
- Database connection errors
- OpenAI API rate limits
- Twilio service disruptions

---

## Test Data Fixtures

### Sample Test Callers
```typescript
// Located in: tests/fixtures/call-test-data.ts
{
  phone: '+15551111111',
  name: 'John Smith',
  projectType: 'Kitchen',
  budget: '$50,000',
  expectedQualified: true
}
```

Use these fixtures for consistent testing across environments.

---

## Reporting Issues

When reporting bugs, include:
1. **Call SID** from Twilio dashboard
2. **Full transcript** from call_logs table
3. **Expected vs Actual** data extraction
4. **Server logs** with timestamps
5. **Conversation state** at failure point

File issues at: `[Your Issue Tracker URL]`

---

## Best Practices

### Before Each Release
- [ ] Run full automated test suite (100% pass)
- [ ] Complete manual checklist (90%+ pass)
- [ ] Test with at least 3 different phone numbers
- [ ] Verify data in staging database
- [ ] Check Twilio webhook logs for errors

### Weekly Testing
- [ ] Run smoke tests after deployments
- [ ] Spot-check manual scenarios
- [ ] Review call log metrics

### Monthly Testing
- [ ] Full regression test
- [ ] Update test data for new scenarios
- [ ] Review and update test documentation

---

## Resources

- **Test Plan**: `call-assistance-test-plan.md` - Complete testing strategy
- **Checklist**: `manual-test-checklist.md` - Print-friendly QA guide
- **Unit Tests**: `call-assistance.test.ts` - Automated test suite
- **Twilio Docs**: https://www.twilio.com/docs
- **OpenAI Docs**: https://platform.openai.com/docs

---

## Contributing

When adding new features to call assistance:
1. Add unit tests to `call-assistance.test.ts`
2. Update manual test checklist
3. Document new test scenarios in test plan
4. Update expected metrics in this README

---

## FAQ

**Q: How long does the full test suite take?**
A: ~2-3 minutes for automated tests, 30-45 minutes for complete manual testing

**Q: Do I need a real Twilio number to run tests?**
A: Unit tests don't require it. Smoke tests check configuration. Manual tests require a working number.

**Q: Can I test locally without deploying?**
A: Yes, use ngrok to tunnel to localhost for webhook testing

**Q: What if speech recognition is inaccurate?**
A: This is expected ~10% of the time. Test in quiet environment with clear speech.

**Q: How do I test multi-company support?**
A: See Test 12 in manual checklist. Requires multiple company records in database.

---

## Support

For questions about testing:
1. Review the test plan documentation
2. Check manual test checklist
3. Review unit test examples
4. File an issue with details

---

**Last Updated**: 2026-02-10
**Test Suite Version**: 1.0
**Coverage**: Budget extraction, Lead qualification, Project types, Name extraction, Timeline handling, Error handling

#!/bin/bash

# Smoke Tests for Call Assistance
# Quick validation that basic functionality is working

set -e

echo "🔥 Running Call Assistance Smoke Tests"
echo "======================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

# Test counter
TESTS_RUN=0
TESTS_PASSED=0

run_test() {
    local test_name=$1
    local test_command=$2

    TESTS_RUN=$((TESTS_RUN + 1))
    echo ""
    echo "Test $TESTS_RUN: $test_name"

    if eval "$test_command" > /dev/null 2>&1; then
        echo "${GREEN}✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "${RED}❌ FAIL${NC}"
        FAILED=1
    fi
}

# ============================================================================
# TEST 1: Check if Twilio environment variables are set
# ============================================================================
echo ""
echo "Test 1: Checking Twilio environment variables..."

if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo "${YELLOW}⚠️  Warning: No .env file found${NC}"
fi

check_env_var() {
    local var_name=$1

    if [ -z "${!var_name}" ]; then
        # Try to load from .env.local
        if [ -f ".env.local" ]; then
            source .env.local
        fi

        # Check again
        if [ -z "${!var_name}" ]; then
            echo "${RED}❌ $var_name not set${NC}"
            return 1
        fi
    fi

    echo "${GREEN}✅ $var_name is configured${NC}"
    return 0
}

check_env_var "EXPO_PUBLIC_TWILIO_ACCOUNT_SID" || FAILED=1
check_env_var "EXPO_PUBLIC_TWILIO_AUTH_TOKEN" || FAILED=1
check_env_var "EXPO_PUBLIC_TWILIO_PHONE_NUMBER" || FAILED=1
check_env_var "OPENAI_API_KEY" || FAILED=1

TESTS_RUN=$((TESTS_RUN + 1))
if [ $FAILED -eq 0 ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# ============================================================================
# TEST 2: Check if required files exist
# ============================================================================
echo ""
echo "Test 2: Checking if call assistance files exist..."

FILES=(
    "backend/trpc/routes/twilio/handle-receptionist-call/route.ts"
    "backend/trpc/routes/twilio/make-call/route.ts"
    "backend/trpc/routes/twilio/send-sms/route.ts"
    "components/TwilioIntegration.tsx"
)

ALL_FILES_EXIST=1
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "${GREEN}✅ $file${NC}"
    else
        echo "${RED}❌ Missing: $file${NC}"
        ALL_FILES_EXIST=0
        FAILED=1
    fi
done

TESTS_RUN=$((TESTS_RUN + 1))
if [ $ALL_FILES_EXIST -eq 1 ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# ============================================================================
# TEST 3: Check TypeScript compilation
# ============================================================================
echo ""
echo "Test 3: Checking TypeScript compilation..."

if command -v tsc &> /dev/null; then
    if tsc --noEmit --skipLibCheck 2>&1 | grep -i "error" > /dev/null; then
        echo "${RED}❌ TypeScript compilation errors found${NC}"
        FAILED=1
    else
        echo "${GREEN}✅ TypeScript compiles without errors${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
else
    echo "${YELLOW}⚠️  TypeScript not installed, skipping${NC}"
fi

# ============================================================================
# TEST 4: Check if webhook endpoint is accessible (if deployed)
# ============================================================================
echo ""
echo "Test 4: Checking webhook endpoint accessibility..."

# Try to determine the deployment URL
if [ -f ".vercel/project.json" ]; then
    DOMAIN=$(cat .vercel/project.json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
    WEBHOOK_URL="https://${DOMAIN}.vercel.app/api/twilio/receptionist"

    echo "Testing: $WEBHOOK_URL"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL" || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "405" ]; then
        echo "${GREEN}✅ Webhook endpoint is accessible (HTTP $HTTP_CODE)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "${YELLOW}⚠️  Webhook returned HTTP $HTTP_CODE (expected 200 or 405)${NC}"
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
else
    echo "${YELLOW}⚠️  Not deployed to Vercel, skipping endpoint check${NC}"
fi

# ============================================================================
# TEST 5: Check database connection (if Supabase configured)
# ============================================================================
echo ""
echo "Test 5: Checking database configuration..."

if [ -n "$EXPO_PUBLIC_SUPABASE_URL" ] && [ -n "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "${GREEN}✅ Supabase configuration found${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo "${YELLOW}⚠️  Supabase not configured${NC}"
fi
TESTS_RUN=$((TESTS_RUN + 1))

# ============================================================================
# TEST 6: Check package dependencies
# ============================================================================
echo ""
echo "Test 6: Checking required npm packages..."

REQUIRED_PACKAGES=("twilio" "@trpc/server" "openai")
PACKAGES_OK=1

for package in "${REQUIRED_PACKAGES[@]}"; do
    if grep -q "\"$package\"" package.json; then
        echo "${GREEN}✅ $package${NC}"
    else
        echo "${RED}❌ Missing package: $package${NC}"
        PACKAGES_OK=0
        FAILED=1
    fi
done

TESTS_RUN=$((TESTS_RUN + 1))
if [ $PACKAGES_OK -eq 1 ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

# ============================================================================
# TEST 7: Validate Twilio phone number format
# ============================================================================
echo ""
echo "Test 7: Validating Twilio phone number format..."

if [ -n "$EXPO_PUBLIC_TWILIO_PHONE_NUMBER" ]; then
    if [[ "$EXPO_PUBLIC_TWILIO_PHONE_NUMBER" =~ ^\+1[0-9]{10}$ ]]; then
        echo "${GREEN}✅ Phone number format is valid${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "${YELLOW}⚠️  Phone number format may be incorrect (expected: +1XXXXXXXXXX)${NC}"
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
else
    echo "${YELLOW}⚠️  Phone number not set, skipping validation${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "======================================="
echo "📊 Test Summary"
echo "======================================="
echo "Tests run: $TESTS_RUN"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $((TESTS_RUN - TESTS_PASSED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "${GREEN}✅ All smoke tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run unit tests: npm test tests/call-assistance.test.ts"
    echo "  2. Test manually by calling: $EXPO_PUBLIC_TWILIO_PHONE_NUMBER"
    echo "  3. Review call logs in CRM after test calls"
    exit 0
else
    echo "${RED}❌ Some smoke tests failed${NC}"
    echo ""
    echo "Please fix the issues above before proceeding."
    exit 1
fi

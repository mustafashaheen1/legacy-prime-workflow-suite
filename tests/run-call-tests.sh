#!/bin/bash

# Call Assistance Test Runner
# Makes it easy to run all call-related tests

set -e

echo "🧪 Call Assistance Test Suite"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# Function to run a test category
run_test() {
    local test_name=$1
    local test_command=$2

    echo ""
    echo "${YELLOW}Running: $test_name${NC}"
    echo "----------------------------------------"

    if eval "$test_command"; then
        echo "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# Parse command line arguments
TEST_TYPE=${1:-all}

case $TEST_TYPE in
    unit)
        echo "Running unit tests only..."
        run_test "Unit Tests" "npm test tests/call-assistance.test.ts"
        ;;

    smoke)
        echo "Running smoke tests only..."
        run_test "Smoke Tests" "./tests/smoke-test.sh"
        ;;

    api)
        echo "Running API tests only..."
        run_test "API Tests" "curl -s -o /dev/null -w '%{http_code}' https://your-domain.vercel.app/api/twilio/receptionist"
        ;;

    all|*)
        echo "Running all test categories..."

        # 1. Smoke tests (fast, basic checks)
        if [ -f "./tests/smoke-test.sh" ]; then
            run_test "Smoke Tests" "bash ./tests/smoke-test.sh"
        else
            echo "${YELLOW}⚠️  Smoke test script not found, skipping${NC}"
        fi

        # 2. Unit tests (logic validation)
        run_test "Unit Tests" "npm test tests/call-assistance.test.ts"

        # 3. Type checking
        run_test "Type Check" "npm run type-check || tsc --noEmit"

        # Summary
        echo ""
        echo "=============================="
        echo "${GREEN}✅ All tests completed${NC}"
        echo ""
        ;;
esac

# Display helpful commands
echo ""
echo "📚 Available test commands:"
echo "  ./tests/run-call-tests.sh          - Run all tests"
echo "  ./tests/run-call-tests.sh unit     - Run unit tests only"
echo "  ./tests/run-call-tests.sh smoke    - Run smoke tests only"
echo "  ./tests/run-call-tests.sh api      - Test API endpoints"
echo ""
echo "📖 Full test documentation: tests/call-assistance-test-plan.md"
echo ""

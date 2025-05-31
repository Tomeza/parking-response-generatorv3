# テストドキュメント / Testing Documentation
このディレクトリには、Parking Response Generator システムのテストスイートが含まれています。

This directory contains the test suite for the Parking Response Generator system.

## Test Structure

```
tests/
├── unit/                    # Unit tests with mocked dependencies
│   └── hybrid-retriever.test.ts
├── integration/             # Integration tests
│   └── basic.test.ts
├── setup.ts                 # Global test configuration
└── README.md               # This file
```

## Test Types

### Unit Tests (`tests/unit/`)
- Test individual components in isolation
- Use mocked dependencies for CI-friendly execution
- Focus on core business logic and error handling
- Current coverage: ~85% for HybridRetriever

### Integration Tests (`tests/integration/`)
- Test component interactions without external dependencies
- Verify module imports and basic functionality
- Ensure CI pipeline compatibility

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run tests with coverage report
npm run test:unit:coverage

# Legacy search tests (requires database)
npm run test:legacy
```

## Test Configuration

- **Framework**: Jest with ts-jest preset
- **Environment**: Node.js
- **Timeout**: 30 seconds
- **Coverage**: Enabled for `src/` directory
- **Setup**: Global configuration in `tests/setup.ts`

## CI/CD Integration

Tests are automatically run in GitHub Actions CI pipeline:
- Unit tests run on every PR and push
- Coverage reports are generated
- Quality gates enforce minimum standards
- No external dependencies required for CI tests

## Writing Tests

### Unit Test Guidelines
1. Mock all external dependencies (database, APIs, etc.)
2. Test both success and error scenarios
3. Use descriptive test names
4. Group related tests with `describe` blocks
5. Reset mocks between tests with `beforeEach`

### Example Test Structure
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Setup default mocks
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Test implementation
    });

    it('should handle error case', async () => {
      // Test implementation
    });
  });
});
```

## Coverage Targets

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 85%

Current coverage for core components exceeds these targets. 
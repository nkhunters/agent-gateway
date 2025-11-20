# Testing Guide

This project uses **Jest** with **ts-jest** for unit and integration testing.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests in watch mode
```bash
npx jest --watch
```

### Run specific test file
```bash
npx jest tests/unit/logger.test.ts
```

## Test Structure

Tests are organized in the `/tests` directory:

```
tests/
├── unit/           # Unit tests for individual modules
│   ├── logger.test.ts
│   └── sample.test.ts
└── integration/    # Integration tests for API endpoints and workflows
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, test, expect } from '@jest/globals';

describe('Feature Name', () => {
  test('should do something expected', () => {
    const result = someFunction();
    expect(result).toBe(expectedValue);
  });

  test('should handle edge case', () => {
    // Test edge case
  });

  test('should throw error on invalid input', () => {
    expect(() => someFunction(invalidInput)).toThrow();
  });
});
```

### Testing Guidelines

1. **Test Coverage**: Each feature should have:
   - At least 1 test for expected behavior
   - At least 1 test for edge cases
   - At least 1 test for failure cases

2. **Test Naming**: Use descriptive test names that explain what is being tested:
   - ✅ `should return user when valid ID is provided`
   - ❌ `test1`

3. **Test Organization**: Group related tests using `describe` blocks

4. **Mocking**: Use Jest's built-in mocking capabilities for external dependencies:
   ```typescript
   import { jest } from '@jest/globals';

   const mockFunction = jest.fn();
   ```

## Configuration

Jest configuration is in `jest.config.js`. Key settings:

- **Test Environment**: Node.js
- **Test Patterns**: `**/*.test.ts` and `**/*.spec.ts`
- **Coverage Directory**: `./coverage`
- **Transform**: Uses `ts-jest` for TypeScript support

## Common Jest Matchers

```typescript
// Equality
expect(value).toBe(expected);           // Strict equality (===)
expect(value).toEqual(expected);        // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeDefined();
expect(value).toBeUndefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3);

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Exceptions
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(Error);
expect(() => fn()).toThrow('error message');
```

## Tips

1. Run tests before committing code
2. Keep tests focused and isolated
3. Use descriptive test names
4. Mock external dependencies
5. Test both success and failure paths
6. Aim for high coverage but prioritize meaningful tests over coverage metrics

## Troubleshooting

### Tests not running
- Ensure all dependencies are installed: `npm install`
- Check that test files follow naming convention: `*.test.ts` or `*.spec.ts`

### TypeScript errors in tests
- Verify `ts-jest` is installed
- Check `tsconfig.json` configuration
- Ensure imports use correct paths

### Coverage not being collected
- Verify files are in `src/` directory
- Check `collectCoverageFrom` patterns in `jest.config.js`

## Resources

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://testingjavascript.com/)

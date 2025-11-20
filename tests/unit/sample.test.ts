import { describe, test, expect } from '@jest/globals';

/**
 * Sample test suite to verify Jest configuration
 * This demonstrates basic test patterns for unit testing
 */

// Simple utility functions for testing
function add(a: number, b: number): number {
  return a + b;
}

function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Cannot divide by zero');
  }
  return a / b;
}

describe('Sample Test Suite', () => {
  describe('add function', () => {
    test('should add two positive numbers correctly', () => {
      const result = add(2, 3);
      expect(result).toBe(5);
    });

    test('should handle negative numbers', () => {
      const result = add(-2, -3);
      expect(result).toBe(-5);
    });

    test('should handle zero', () => {
      const result = add(5, 0);
      expect(result).toBe(5);
    });
  });

  describe('divide function', () => {
    test('should divide two numbers correctly', () => {
      const result = divide(10, 2);
      expect(result).toBe(5);
    });

    test('should handle decimal results', () => {
      const result = divide(5, 2);
      expect(result).toBe(2.5);
    });

    test('should throw error when dividing by zero', () => {
      expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
    });
  });
});

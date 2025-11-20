import { describe, test, expect, beforeEach } from '@jest/globals';
import { logger } from '../../src/utils/logger';

/**
 * Unit tests for logger utility
 * Tests the pino logger configuration
 */

describe('Logger', () => {
  test('should be defined', () => {
    expect(logger).toBeDefined();
  });

  test('should have info method', () => {
    expect(logger.info).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  test('should have error method', () => {
    expect(logger.error).toBeDefined();
    expect(typeof logger.error).toBe('function');
  });

  test('should have warn method', () => {
    expect(logger.warn).toBeDefined();
    expect(typeof logger.warn).toBe('function');
  });

  test('should have debug method', () => {
    expect(logger.debug).toBeDefined();
    expect(typeof logger.debug).toBe('function');
  });

  test('should have level property set to info', () => {
    expect(logger.level).toBe('info');
  });
});

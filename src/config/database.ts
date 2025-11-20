import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { env } from './env';

/**
 * Connect to MongoDB with retry logic
 *
 * Implements exponential backoff for connection failures:
 * - 1st retry: 1 second
 * - 2nd retry: 2 seconds
 * - 3rd retry: 4 seconds
 * - 4th retry: 8 seconds
 * - 5th retry: 16 seconds (max)
 */
export async function connectDatabase(
  retries: number = 5,
  delay: number = 1000
): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    logger.info(
      {
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      'MongoDB connected successfully'
    );

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    if (retries > 0) {
      logger.warn(
        {
          error: (error as Error).message,
          retriesLeft: retries,
          retryDelay: delay
        },
        'MongoDB connection failed, retrying...'
      );

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry with exponential backoff (max delay: 16 seconds)
      return connectDatabase(retries - 1, Math.min(delay * 2, 16000));
    }

    logger.error(
      { error: (error as Error).message },
      'Failed to connect to MongoDB after all retries'
    );
    process.exit(1); // Exit if database unavailable
  }
}

/**
 * Gracefully close database connection
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error({ error }, 'Error closing MongoDB connection');
  }
}

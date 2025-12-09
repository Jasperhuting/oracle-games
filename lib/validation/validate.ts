/**
 * Validation helper functions for API endpoints
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiErrorResponse } from '../types';

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: NextResponse<ApiErrorResponse> };

/**
 * Validate request body against a Zod schema
 * Returns validated data or error response
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into a readable message
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
      });

      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            details: errorMessages.join(', '),
          },
          { status: 400 }
        ),
      };
    }

    // Unexpected error
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Validation error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Async version of validateRequest for async schemas
 */
export async function validateRequestAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
      });

      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            details: errorMessages.join(', '),
          },
          { status: 400 }
        ),
      };
    }

    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Validation error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Safe parse that returns the result without throwing
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): z.SafeParseReturnType<unknown, T> {
  return schema.safeParse(data);
}

/**
 * Validate and extract data from request body
 * Throws NextResponse error if validation fails
 */
export async function getValidatedBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  const body = await request.json();
  const result = validateRequest(schema, body);
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.data;
}

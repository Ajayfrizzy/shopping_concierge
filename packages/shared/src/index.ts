import { z } from 'zod';
export * from './domain.ts';

export const healthSchema = z
  .object({ status: z.literal('ok'), service: z.literal('youcam-api'), mode: z.literal('mock') })
  .strict();
export type Health = z.infer<typeof healthSchema>;
export const foundationRequestSchema = z
  .object({ message: z.string().trim().min(1).max(2000) })
  .strict();
export const foundationResponseSchema = z
  .object({
    message: z.string(),
    mode: z.literal('mock'),
    readyForShopping: z.literal(false),
  })
  .strict();
export type FoundationResponse = z.infer<typeof foundationResponseSchema>;
export const providerErrorSchema = z
  .object({
    code: z.enum(['MOCK_FAILURE', 'NOT_IMPLEMENTED']),
    message: z.string(),
    recoverable: z.boolean(),
  })
  .strict();
export type ProviderError = z.infer<typeof providerErrorSchema>;
export type ProviderResult<T> = { ok: true; data: T } | { ok: false; error: ProviderError };
export * from './catalog.ts';
export * from './comparison.ts';
export * from './agent.ts';
export * from './persistence.ts';
export * from './visual.ts';

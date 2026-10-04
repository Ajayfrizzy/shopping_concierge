import { z } from 'zod';
import type { Category, VisualAsset } from '@youcam/shared';

export const requiredImage = {
  earrings: 'portrait',
  necklaces: 'portrait',
  rings: 'hand',
  watches: 'wrist',
} as const;
export const operationPath = {
  earrings: '2d-vto/earring',
  necklaces: '2d-vto/necklace',
  rings: '2d-vto/ring',
  watches: '2d-vto/watch',
} as const;
export const visualFailureSchema = z
  .object({
    code: z.enum([
      'IMAGE_REQUIRED',
      'INVALID_IMAGE',
      'PRODUCT_ASSET_MISSING',
      'PROVIDER_UNAVAILABLE',
      'PROVIDER_AUTH',
      'PROVIDER_RATE_LIMIT',
      'PROVIDER_TIMEOUT',
      'PROVIDER_INVALID_RESPONSE',
      'RENDER_FAILED',
      'ANALYSIS_UNAVAILABLE',
    ]),
    message: z.string(),
    recoverable: z.literal(true),
  })
  .strict();
export class VisualError extends Error {
  constructor(
    readonly code: z.infer<typeof visualFailureSchema>['code'],
    message: string,
  ) {
    super(message);
  }
  normalized() {
    return visualFailureSchema.parse({ code: this.code, message: this.message, recoverable: true });
  }
}
export const faceShapeSchema = z.enum([
  'Triangle',
  'Diamond',
  'Heart',
  'InvTriangle',
  'Oblong',
  'Oval',
  'Round',
  'Square',
  'Unknown',
]);
export type ProviderPoll =
  | { status: 'processing' }
  | { status: 'completed'; outputUrl: string }
  | { status: 'completed'; mock: true }
  | { status: 'failed'; error: z.infer<typeof visualFailureSchema> };
export interface TryOnInput {
  category: Category;
  asset: VisualAsset;
  bytes: Uint8Array;
  productAssetUrl: string | null;
}
export interface YouCamProvider {
  readonly mode: 'mock' | 'live';
  start(input: TryOnInput): Promise<string>;
  analyzeFace?(asset: VisualAsset): Promise<{ faceShape: string | null }>;
  poll(category: Category, taskId: string): Promise<ProviderPoll>;
}
export function validateImageType(category: Category, asset: VisualAsset) {
  if (asset.type !== requiredImage[category])
    throw new VisualError(
      'IMAGE_REQUIRED',
      `Provide a ${requiredImage[category]} image for ${category}.`,
    );
}
/** File validity and declared operation type are checked locally; provider detection validates anatomy/pose. */
export function renderFailure(): VisualError {
  return new VisualError(
    'RENDER_FAILED',
    'Rendering failed. Try a clear, unobstructed image of the required area. This is a technical failure, not a judgment about the product or your appearance.',
  );
}

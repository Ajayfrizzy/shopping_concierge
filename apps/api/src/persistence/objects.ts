import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  S3Client,
  HeadBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
export interface ObjectStore {
  ready?(): Promise<void>;
  signGet?(key: string, expiresIn?: number): Promise<string>;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  close(): void;
}
export function createMemoryObjectStore(): ObjectStore {
  const objects = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) {
      objects.set(key, Uint8Array.from(bytes));
    },
    async get(key) {
      const bytes = objects.get(key);
      if (!bytes) throw new Error('Object missing');
      return Uint8Array.from(bytes);
    },
    close() {},
  };
}
export function createS3ObjectStore(config: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  assetPrefix?: string;
}): ObjectStore & {
  listAssets(group: string): Promise<string[]>;
  signGet(key: string, expiresIn?: number): Promise<string>;
} {
  const { bucket, ...settings } = config;
  const client = new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: settings.forcePathStyle,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 10000 },
  });
  return {
    async ready() {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },
    async signGet(key, expiresIn = 900) {
      if (!key || !Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600)
        throw new Error('Temporary asset access requires a key and expiry of 1–3600 seconds.');
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn,
      });
    },
    /** Approved asset discovery only; existing persisted upload keys remain unchanged. */
    async listAssets(group: string): Promise<string[]> {
      if (
        ![
          'vto-products/earrings/',
          'vto-products/necklaces/',
          'vto-products/rings/',
          'vto-products/watches/',
          'vto-inputs/portrait/',
          'vto-inputs/hand/',
          'vto-inputs/wrist/',
        ].includes(group)
      )
        throw new Error('Unsupported approved asset group.');
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: (config.assetPrefix ?? '') + group,
            MaxKeys: 100,
            ContinuationToken: cursor,
          }),
        );
        for (const item of result.Contents ?? [])
          if (item.Key && (item.Size ?? 0) > 0) keys.push(item.Key);
        cursor = result.IsTruncated ? result.NextContinuationToken : undefined;
        if (result.IsTruncated && !cursor) throw new Error('Incomplete object listing.');
        if (keys.length > 1000) throw new Error('Approved asset group exceeds discovery limit.');
      } while (cursor);
      return keys.sort();
    },
    async put(key, bytes, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }),
      );
    },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) throw new Error('Object missing');
      return result.Body.transformToByteArray();
    },
    close() {
      client.destroy();
    },
  };
}

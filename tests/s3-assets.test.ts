import { expect, it, vi } from 'vitest';
const { send, sign } = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: sign }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send;
    destroy() {}
  },
  ListObjectsV2Command: class {
    constructor(readonly input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(readonly input: unknown) {}
  },
  PutObjectCommand: class {
    constructor(readonly input: unknown) {}
  },
}));
import { createS3ObjectStore } from '../apps/api/src/persistence/objects.js';
const store = () =>
  createS3ObjectStore({
    endpoint: 'https://storage.example',
    region: 'test',
    bucket: 'demo',
    accessKeyId: 'test',
    secretAccessKey: 'test',
    forcePathStyle: true,
    assetPrefix: 'projects/example/',
  });
it('paginates approved project assets and returns exact keys', async () => {
  send.mockReset();
  send
    .mockResolvedValueOnce({
      Contents: [{ Key: 'projects/example/vto-inputs/hand/b.png', Size: 5 }],
      IsTruncated: true,
      NextContinuationToken: 'next',
    })
    .mockResolvedValueOnce({
      Contents: [
        { Key: 'projects/example/vto-inputs/hand/a.png', Size: 5 },
        { Key: 'folder/', Size: 0 },
      ],
    });
  expect(await store().listAssets('vto-inputs/hand/')).toEqual([
    'projects/example/vto-inputs/hand/a.png',
    'projects/example/vto-inputs/hand/b.png',
  ]);
  expect(send.mock.calls[0]![0].input.Prefix).toBe('projects/example/vto-inputs/hand/');
  expect(send.mock.calls[1]![0].input.ContinuationToken).toBe('next');
});
it('rejects unrelated discovery and preserves direct stored keys', async () => {
  send.mockReset();
  await expect(store().listAssets('../')).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
  send.mockResolvedValue({ Body: { transformToByteArray: async () => new Uint8Array([1]) } });
  await store().get('existing/upload.png');
  expect(send.mock.calls[0]![0].input.Key).toBe('existing/upload.png');
});
it('surfaces permission failures instead of treating them as an empty group', async () => {
  send.mockReset();
  send.mockRejectedValue(new Error('Access denied'));
  await expect(store().listAssets('vto-products/watches/')).rejects.toThrow('Access denied');
});

it('signs only bounded temporary GET access with the exact private key', async () => {
  sign.mockReset();
  sign.mockResolvedValue('https://storage.example/temporary');
  expect(await store().signGet('projects/example/vto-products/rings/a.png', 900)).toBe(
    'https://storage.example/temporary',
  );
  expect(sign.mock.calls[0]![1].input).toEqual({
    Bucket: 'demo',
    Key: 'projects/example/vto-products/rings/a.png',
  });
  expect(sign.mock.calls[0]![2]).toEqual({ expiresIn: 900 });
  await expect(store().signGet('key', 3601)).rejects.toThrow('expiry');
  await expect(store().signGet('key', 0)).rejects.toThrow('expiry');
  expect(sign).toHaveBeenCalledTimes(1);
});

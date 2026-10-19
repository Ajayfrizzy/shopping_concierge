import { expect, it, vi } from 'vitest';
import { calibrationApp } from '../scripts/recording/mock-server.js';
it('prepares one owned labeled image fixture without outbound calls or repeated creation', async () => {
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('Network forbidden'));
  const app = await calibrationApp();
  try {
    const headers = { authorization: `Bearer ${'7'.repeat(64)}` };
    const s = (
      await app.inject({ method: 'POST', url: '/v1/sessions', headers, payload: {} })
    ).json();
    const url = `/v1/sessions/${s.state.id}/vto`;
    const first = await app.inject({ url, headers });
    expect(first.statusCode).toBe(200);
    expect(first.json().jobs).toHaveLength(1);
    expect(first.json().jobs[0]).toMatchObject({
      productId: 'E01',
      status: 'completed',
      result: { kind: 'image', url: 'http://127.0.0.1:4000/calibration/image.png' },
    });
    await app.inject({ url, headers });
    const stranger = await app.inject({
      url,
      headers: { authorization: `Bearer ${'6'.repeat(64)}` },
    });
    expect(stranger.statusCode).not.toBe(200);
    expect((await app.inject('/calibration/status')).json()).toMatchObject({
      starts: 1,
      polls: 1,
      actualProviderRequests: 0,
    });
    expect(network).not.toHaveBeenCalled();
  } finally {
    await app.close();
    network.mockRestore();
  }
});

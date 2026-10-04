import type { VisualState } from '../youcam/state.js';
import type { AgentResponse, Product, VisualAsset } from '@youcam/shared';
import type { AgentSessionRecord } from '@youcam/agent';
export interface StoredAsset {
  asset: VisualAsset;
  key: string;
}
export interface EmailChallenge {
  hash: string;
  owner: string;
  email: string;
  expiresAt: number;
}
export interface ShoppingRepository {
  create(owner: string, record: AgentSessionRecord): Promise<void>;
  read(owner: string, id: string): Promise<AgentSessionRecord>;
  list(owner: string): Promise<string[]>;
  products(): Promise<Product[]>;
  update(
    owner: string,
    id: string,
    operation: (
      record: AgentSessionRecord,
      products: Product[],
    ) => Promise<{ record: AgentSessionRecord; response: AgentResponse }>,
  ): Promise<AgentResponse>;
  saveAsset(owner: string, value: StoredAsset): Promise<StoredAsset>;
  asset(owner: string, sessionId: string, id: string): Promise<StoredAsset>;
  email(owner: string): Promise<string | null>;
  challenge(value: EmailChallenge): Promise<void>;
  verify(owner: string, hash: string, now: number): Promise<string>;
  visual(
    owner: string,
    sessionId: string,
    operation: (state: VisualState) => VisualState,
  ): Promise<VisualState>;
  close(): Promise<void>;
}

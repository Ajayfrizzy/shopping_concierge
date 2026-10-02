import { fixtureProducts } from '../../../fixtures/catalog.ts';
import { createCatalog } from './index.ts';

export function createFixtureCatalog() { return createCatalog(fixtureProducts); }

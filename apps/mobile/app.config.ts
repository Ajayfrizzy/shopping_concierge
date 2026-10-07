import process from 'node:process';
import type { ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext) =>
  process.env.CONCIERGE_DEMO_APP === '1'
    ? {
        ...config,
        name: 'Concierge Demo',
        slug: 'shopping-concierge-demo',
        scheme: 'shopping-concierge-demo',
        android: { ...config.android, package: 'com.youcam.shoppingconcierge.demo' },
      }
    : config;

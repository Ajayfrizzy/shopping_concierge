import {readFileSync} from 'node:fs';import {parseEnv} from 'node:util';
import {postgresPool} from '../apps/api/src/persistence/postgres.ts';
const e=parseEnv(readFileSync('apps/api/.env','utf8'));
const p=postgresPool(e.DATABASE_URL!,e.DATABASE_SSL_REJECT_UNAUTHORIZED);
try{const r=await p.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid=pg_backend_pid()');console.log(JSON.stringify({check:'postgres-query-and-encryption',passed:r.rows[0]?.ssl===true,tlsVersion:r.rows[0]?.version}));}catch(x){console.log(JSON.stringify({check:'postgres',passed:false,code:typeof x.code==='string'&&/^[A-Z0-9_]+$/.test(x.code)?x.code:'CONNECTION_ERROR'}));}finally{await p.end();}

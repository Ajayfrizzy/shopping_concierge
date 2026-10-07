import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
function failure(e:unknown){const x=e as {code?:string;name?:string;$metadata?:{httpStatusCode?:number};cause?:unknown};return {code:typeof x.code==='string' && /^[A-Z0-9_]+$/.test(x.code)?x.code:undefined,name:['TimeoutError','CredentialsProviderError','NotFound','Forbidden','AccessDenied','InvalidAccessKeyId','SignatureDoesNotMatch'].includes(x.name??'')?x.name:undefined,status:x.$metadata?.httpStatusCode,...(x.cause?{cause:failure(x.cause)}:{})};}
const env=parseEnv(readFileSync('apps/api/.env','utf8'));
const pool=new Pool({connectionString:env.DATABASE_URL,connectionTimeoutMillis:8000,statement_timeout:8000,max:1});
pool.on('error',()=>{});
try { const r=await pool.query('SELECT 1 AS ok'); console.log(JSON.stringify({check:'postgres-connectivity',passed:r.rows[0]?.ok===1})); } catch (error) {console.log(JSON.stringify({diagnostic:failure(error),check:'postgres-connectivity',passed:false,detail:'Connection/query failed; configuration values and provider error withheld.'}));} finally{await pool.end();}
const client=new S3Client({endpoint:env.S3_ENDPOINT,region:env.S3_REGION,forcePathStyle:env.S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:env.S3_ACCESS_KEY_ID!,secretAccessKey:env.S3_SECRET_ACCESS_KEY!},maxAttempts:1,requestHandler:{connectionTimeout:8000,requestTimeout:10000}});
const Bucket=env.S3_BUCKET!,Key=`validation/youcam-preflight/${randomUUID()}.txt`, Body=Buffer.from('Shopping Concierge private storage connectivity probe');
let wrote=false;
try {
 await client.send(new HeadBucketCommand({Bucket}));console.log(JSON.stringify({check:'s3-bucket-access',passed:true}));
 await client.send(new PutObjectCommand({Bucket,Key,Body,ContentType:'text/plain'}));wrote=true;
 const r=await client.send(new GetObjectCommand({Bucket,Key}));const bytes=await r.Body?.transformToByteArray();
 console.log(JSON.stringify({check:'s3-private-put-get',passed:bytes!==undefined && Buffer.from(bytes).equals(Body)}));
} catch (error) {console.log(JSON.stringify({diagnostic:failure(error),check:'s3-access',passed:false,detail:'Storage operation failed; provider error/configuration withheld.'}));}
finally {if(wrote)try{await client.send(new DeleteObjectCommand({Bucket,Key}));console.log(JSON.stringify({check:'s3-probe-cleanup',passed:true}));}catch{console.log(JSON.stringify({check:'s3-probe-cleanup',passed:false}));}client.destroy();}
console.log(JSON.stringify({liveYouCamRequests:0,liveOpenAIRequests:0}));

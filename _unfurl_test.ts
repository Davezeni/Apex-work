import { unfurl } from './apps/api/src/services/chat.service.ts';
async function main() {
  const r = await unfurl('https://example.com');
  console.log('EXAMPLE:', JSON.stringify(r));
  try { await unfurl('http://127.0.0.1/x'); console.log('SSRF NOT BLOCKED'); }
  catch (e:any) { console.log('SSRF blocked ok:', e?.message); }
  try { await unfurl('ftp://x'); console.log('SCHEME NOT BLOCKED'); }
  catch (e:any) { console.log('SCHEME blocked ok:', e?.message); }
  const r2 = await unfurl('https://github.com');
  console.log('GITHUB:', JSON.stringify({title:r2.title,desc:(r2.description||'').slice(0,50),domain:r2.domain,hasImg:!!r2.image,site:r2.siteName}));
}
main().catch(e=>{console.log('ERR',e.message)});

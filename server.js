import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { makeFallbackProfiles, normalizeProfiles } from './shared/profiles.js';

const BASE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(BASE, 'public');
const PORT = Number(process.env.PORT) || 3000;
const CONTENT_TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8', '.ico':'image/x-icon' };
const hits = new Map();

const json = (res, status, data) => {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
};
const readBody = async (req) => {
  let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 25000) throw new Error('request too large'); }
  return JSON.parse(body);
};
const requestAI = async (people, seed) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = `You are creating a synthetic population for a behavioral research *simulation*, not describing real persons. For each supplied fictional resident create nuanced, varied but plausible initial personality traits. Preserve id. Respond with ONLY JSON: {"profiles":[{"id":"p0","sociability":0.5,"curiosity":0.5,"conscientiousness":0.5,"empathy":0.5,"stressTolerance":0.5,"likesCats":0.5,"chronotype":"morning","description":"日本語20〜45文字"}]}. Numeric traits in [0,1], chronotype morning/evening/neutral. Avoid stereotyped occupational traits and avoid real biographical claims. Fictional population: ${JSON.stringify(people)}. World seed: ${seed}.`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method:'POST', signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json', temperature:0.8}})
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('') || '';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.profiles)) throw new Error('missing profiles');
    return normalizeProfiles(people,parsed.profiles,seed);
  } finally { clearTimeout(timer); }
};
const server = http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res,200,{ok:true,name:'OBSERVED WORLD',aiConfigured:Boolean(process.env.GEMINI_API_KEY)});
  if (req.method === 'POST' && url.pathname === '/api/personalities') {
    try {
      const ip = (req.socket.remoteAddress || 'local').slice(0,70);
      const now=Date.now(), rate=hits.get(ip)||{start:now,count:0};
      if(now-rate.start>60000){rate.start=now;rate.count=0;}
      rate.count++;hits.set(ip,rate);
      if(rate.count>15) return json(res,429,{error:'1分あたりの生成回数を超えました'});
      const input=await readBody(req);
      const people=input.people;
      if (!Array.isArray(people)||people.length<1||people.length>40 || !people.every(p=> typeof p.id==='string' && p.id.length<20 && typeof p.name==='string' && p.name.length<40 && typeof p.job==='string' && p.job.length<40 && Number.isFinite(p.age))) return json(res,400,{error:'invalid residents'});
      const seed=Number.isSafeInteger(input.seed)?input.seed:1;
      let profiles, mode='procedural', detail='';
      try { profiles=await requestAI(people,seed); if(profiles) mode='gemini'; }
      catch(error) {detail='AIサービス未使用: 規則ベースに切り替えました'; console.error('personality generation fallback:',error.message);}
      profiles ||= makeFallbackProfiles(people,seed);
      return json(res,200,{profiles,mode,detail});
    } catch(error) { return json(res,400,{error:'人物生成リクエストを処理できませんでした'}); }
  }
  if(req.method !== 'GET' && req.method !== 'HEAD'){res.writeHead(405);return res.end();}
  let target = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  if(target.includes('\0')) {res.writeHead(400);return res.end();}
  const file=resolve(PUBLIC,'.'+target);
  if(!(file===PUBLIC || file.startsWith(PUBLIC+sep))){res.writeHead(403);return res.end();}
  try {
    const s=await stat(file);
    if (!s.isFile()) throw new Error('not file');
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type': CONTENT_TYPES[extname(file)] || 'application/octet-stream','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=900'});
    if(req.method==='HEAD')res.end(); else res.end(content);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('404 Not Found');}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`OBSERVED WORLD http://localhost:${PORT}`));

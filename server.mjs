import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {openDatabase,state,book,options} from './database.mjs';
import {edit} from './admin-actions.mjs';
import {toCsv,getResponses} from './csv.mjs';
const db=openDatabase();const port=Number(process.env.PORT||3000);const configured=process.env.PUBLIC_URL?new URL(process.env.PUBLIC_URL).origin:null;
const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/styles.css',['styles.css','text/css; charset=utf-8']]].map(([url,[file,type]])=>[url,{body:readFileSync(new URL('./public/'+file,import.meta.url)),type}]));
async function readJson(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>16384)throw Error('Too large');chunks.push(c)}const d=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid');return d}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;
if(req.method==='GET'&&path==='/healthz'){db.prepare('SELECT 1').get();return json(res,200,{ok:true})}
if(req.method==='GET'&&path==='/api/state')return json(res,200,state(db));
if(req.method==='POST'&&path==='/api/lookup'){let data;try{data=await readJson(req)}catch{return json(res,400,{error:'Некорректный запрос'})}const normalize=v=>v.trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');if(typeof data.name!=='string'||data.name.trim().length>200||data.name.trim().split(/\s+/).length<2)return json(res,400,{error:'Введите ФИО полностью'});const rows=getResponses(db).filter(r=>normalize(r.name)===normalize(data.name)).map(({name,format,topic,created_at})=>({name,format,topic,created_at}));return json(res,200,{responses:rows})}
if(req.method==='POST'&&path==='/api/responses'){
const origin=req.headers.origin,expected=configured||'http://'+req.headers.host;if(origin!==expected)return json(res,403,{error:'Недопустимый запрос'});
if(!(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'Ожидается JSON'});
const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>16384)return json(res,413,{error:'Слишком большой запрос'});chunks.push(chunk)}
let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error()}catch{return json(res,400,{error:'Некорректные данные'})}
const result=book(db,data);return json(res,result.status,result)}
const asset=assets.get(path);if(req.method==='GET'&&asset){res.writeHead(200,{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"});return res.end(asset.body)}
return json(res,404,{error:'Не найдено'});
}catch(err){console.error('Request failed:',err.message);if(!res.headersSent)json(res,500,{error:'Не удалось сохранить ответ. Попробуйте ещё раз.'});else res.end()}});
server.listen(port,'0.0.0.0',()=>console.log(`Survey listening on port ${port}`));
const adminPort=Number(process.env.ADMIN_PORT||3001);
const adminAssets=new Map([['/',['index.html','text/html; charset=utf-8']],['/admin.js',['admin.js','text/javascript; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']]].map(([url,[file,type]])=>[url,{body:readFileSync(new URL('./admin/'+file,import.meta.url)),type}]));
const adminServer=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(['PATCH','DELETE'].includes(req.method)&&/^\/api\/responses\/[^/]+$/.test(path)){const expected=configured||'http://'+req.headers.host;if(req.headers.origin!==expected)return json(res,403,{error:'Недопустимый запрос'});const id=decodeURIComponent(path.split('/').pop());if(req.method==='DELETE'){const result=db.prepare('DELETE FROM responses WHERE id=?').run(id);return json(res,result.changes?200:404,result.changes?{ok:true}:{error:'Запись не найдена'})}let d;try{d=await readJson(req)}catch{return json(res,400,{error:'Некорректные данные'})}const result=edit(db,id,d);return json(res,result.status,result)}
if(req.method!=='GET')return json(res,405,{error:'Метод не поддерживается'});
if(path==='/api/responses')return json(res,200,{responses:getResponses(db),formats:options.formats});
if(path==='/export.csv'||path==='/export.json'){const rows=getResponses(db);res.writeHead(200,{'Content-Type':path.endsWith('.csv')?'text/csv; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Disposition':`attachment; filename="responses.${path.endsWith('.csv')?'csv':'json'}"`,'X-Content-Type-Options':'nosniff'});return res.end(path.endsWith('.csv')?toCsv(rows):JSON.stringify(rows,null,2))}
const asset=adminAssets.get(path);if(asset){res.writeHead(200,{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"});return res.end(asset.body)}return json(res,404,{error:'Не найдено'});
}catch{if(!res.headersSent)json(res,500,{error:'Ошибка загрузки ответов'});else res.end()}});
adminServer.listen(adminPort,'0.0.0.0',()=>console.log(`Admin listening on port ${adminPort}`));
function stop(){let remaining=2;const finished=()=>{if(--remaining===0){db.close();process.exit(0)}};server.close(finished);adminServer.close(finished);setTimeout(()=>process.exit(1),10000).unref()}process.on('SIGTERM',stop);process.on('SIGINT',stop);

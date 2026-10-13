import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {openDatabase,options} from '../database.mjs';
test('HTTP: seats, duplicate topic, rollover, persistence, UTF-8, export privacy',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'survey-'));const dbPath=join(dir,'db.sqlite');const port=31897;const origin=`http://127.0.0.1:${port}`;let child;
 async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),ADMIN_PORT:String(port+1),DB_PATH:dbPath,PUBLIC_URL:origin},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',code=>reject(Error('Server exit '+code)))});}
 async function stop(){if(!child||child.exitCode!==null)return;const exit=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exit}
 const submit=(topic,format=options.formats[0],round=0)=>fetch(origin+'/api/responses',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Ирина Берлизова',format,topic,mode:'list',round})});
 try{await start();assert.equal((await fetch(origin+'/')).status,200);assert.equal((await fetch(origin+'/app.js')).status,200);assert.equal((await fetch(origin+'/api/responses')).status,404);
 const results=await Promise.all(options.topics.slice(0,10).map(t=>submit(t)));assert.equal(results.filter(r=>r.status===200).length,8);assert.equal(results.filter(r=>r.status===409).length,2);
 const same=await Promise.all(Array.from({length:5},()=>submit(options.topics[11],options.formats[3])));assert.equal(same.filter(r=>r.status===200).length,1);
 let state=await (await fetch(origin+'/api/state')).json();assert.equal(state.remaining[0],0);assert.equal(state.topics.length,61);
 for(const t of state.topics)assert.equal((await submit(t.text,options.formats[3])).status,200);
 state=await (await fetch(origin+'/api/state')).json();assert.equal(state.round,1);assert.equal(state.topics.length,70);assert.equal((await submit(options.topics[0],options.formats[3],0)).status,409);assert.equal((await submit(options.topics[0],options.formats[3],1)).status,200);
 const bad=await fetch(origin+'/api/responses',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
 const admin=`http://127.0.0.1:${port+1}`;
 assert.equal((await fetch(origin+'/export.csv')).status,404);
 assert.equal((await fetch(origin+'/admin.js')).status,404);
 const adminRows=await (await fetch(admin+'/api/responses')).json();assert.equal(adminRows.responses.length,71);
 const lookup=await fetch(origin+'/api/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'  Ирина   Берлизова '})});const found=await lookup.json();assert.equal(found.responses.length,71);assert.equal('id' in found.responses[0],false);
 const row=adminRows.responses.find(r=>r.format===options.formats[0]);const request=(method,id,body)=>fetch(admin+'/api/responses/'+id,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await request('PATCH',row.id,{name:'Исправленный студент',format:options.formats[3],topic:row.topic})).status,200);
 assert.equal((await (await fetch(origin+'/api/state')).json()).remaining[0],1);
 assert.equal((await request('PATCH',row.id,{name:'Исправленный студент',format:options.formats[0],topic:row.topic})).status,200);
 const other=adminRows.responses.find(r=>r.format===options.formats[3]);assert.equal((await request('PATCH',other.id,{name:other.name,format:options.formats[0],topic:other.topic})).status,409);
 const victim=adminRows.responses.find(r=>r.topic_round===1);assert.equal((await request('DELETE',victim.id)).status,200);assert.equal((await request('DELETE',victim.id)).status,404);
 assert.equal((await fetch(origin+'/api/responses/'+row.id,{method:'DELETE'})).status,404);
 assert.equal((await submit(victim.topic,options.formats[3],1)).status,200);

 const csv=await fetch(admin+'/export.csv');assert.equal(csv.status,200);assert.match(await csv.text(),/Ирина Берлизова/);
 assert.equal((await fetch(admin+'/')).status,200);assert.equal((await fetch(admin+'/export.json')).status,200);
 await stop();await start();state=await (await fetch(origin+'/api/state')).json();assert.equal(state.topics.length,69);assert.equal(state.remaining[0],0);await stop();const db=openDatabase(dbPath);assert.equal(db.prepare('SELECT name FROM responses LIMIT 1').get().name,'Ирина Берлизова');assert.equal(db.prepare('SELECT COUNT(*) n FROM responses').get().n,71);db.close();
 }finally{await stop();rmSync(dir,{recursive:true,force:true})}
});

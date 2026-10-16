import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDatabase,options} from '../database.mjs';
import {getResponses,toCsv} from '../csv.mjs';
test('Existing answers, edits, CSV and command-line JSON consistently identify custom topics',()=>{
 const dir=mkdtempSync(join(tmpdir(),'topic-source-'));const path=join(dir,'survey.sqlite');const db=openDatabase(path);
 try{const insert=db.prepare('INSERT INTO responses(id,name,format,topic,created_at,topic_round) VALUES(?,?,?,?,?,0)');
 insert.run('list','Студент Один',options.formats[3],options.topics[0],'2026-10-16T00:00:00Z');
 insert.run('own','Студент Два',options.formats[3],'Моя самостоятельная тема','2026-10-16T01:00:00Z');
 let rows=getResponses(db);assert.equal(rows.find(r=>r.id==='list').topic_source,'Из списка');assert.equal(rows.find(r=>r.id==='own').topic_source,'Своя тема');
 let csv=toCsv(rows);assert.match(csv.split('\r\n')[0],/"Тип темы"/);assert.match(csv,/"Моя самостоятельная тема".*"Своя тема"/);assert.match(csv,/"Из списка"/);
 const json=JSON.parse(execFileSync(process.execPath,['export.mjs','--json'],{env:{...process.env,DB_PATH:path},encoding:'utf8'}));assert.equal(json.find(r=>r.name==='Студент Два').topic_source,'Своя тема');
 const cliCsv=execFileSync(process.execPath,['export.mjs'],{env:{...process.env,DB_PATH:path},encoding:'utf8'});assert.match(cliCsv,/"Тип темы"/);assert.match(cliCsv,/"Своя тема"/);
 db.prepare('UPDATE responses SET topic=? WHERE id=?').run(options.topics[1],'own');assert.equal(getResponses(db).find(r=>r.id==='own').topic_source,'Из списка');
 db.prepare('UPDATE responses SET topic=? WHERE id=?').run('Другая тема','list');assert.equal(getResponses(db).find(r=>r.id==='list').topic_source,'Своя тема');
 }finally{db.close();rmSync(dir,{recursive:true,force:true})}
});

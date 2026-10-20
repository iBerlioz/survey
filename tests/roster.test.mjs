import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase,options,book} from '../database.mjs';
import {parseStudentCsv,importStudents,getStudents,setSubmitted,studentsCsv} from '../roster.mjs';
test('CSV parsing supports BOM, delimiters, quoted names, boolean statuses and rejects invalid rows',()=>{
 const parsed=parseStudentCsv('\uFEFFФИО;Работа сдана\r\n"Иванов Иван Иванович";TRUE\r\nПетров Пётр Петрович;0\r\n');assert.equal(parsed.students.length,2);assert.equal(parsed.students[0].submitted,true);assert.equal(parsed.students[1].submitted,false);
 assert.equal(parseStudentCsv('ФИО,Работа сдана\n"Имя, Фамилия",Да').students[0].name,'Имя, Фамилия');
 assert.equal(parseStudentCsv('ФИО\nИванов Иван').students[0].submitted,null);
 assert.equal(parseStudentCsv('ФИО;Работа сдана\nИванов Иван;1\n иванов   Иван ;').duplicates,1);
 for(const csv of ['Имя;Статус\nИванов Иван;1','ФИО;Работа сдана\nИванов Иван;может быть','ФИО;Работа сдана\nИванов Иван;1\nИВАНОВ ИВАН;0','ФИО;Работа сдана\n"Иванов Иван;1','ФИО;Работа сдана\nИванов Иван;1;лишнее'])assert.throws(()=>parseStudentCsv(csv));
});
test('Import preserves existing answers and omitted statuses; matching, edits, persistence and CSV round trip',()=>{
 const dir=mkdtempSync(join(tmpdir(),'roster-')),path=join(dir,'db.sqlite');let db;
 try{const old=new DatabaseSync(path);old.exec('CREATE TABLE responses(id TEXT PRIMARY KEY,name TEXT NOT NULL,format TEXT NOT NULL,topic TEXT NOT NULL,created_at TEXT NOT NULL,reserved_topic TEXT,topic_round INTEGER NOT NULL DEFAULT 0)');old.close();db=openDatabase(path);
 assert.equal(book(db,{name:'  ИВАНОВ   Иван Иванович ',format:options.formats[3],topic:options.topics[0],mode:'list',round:0}).status,200);
 assert.equal(importStudents(db,'ФИО;Работа сдана\nИванов Иван Иванович;Да\nПетров Пётр Петрович;Нет').added,2);
 let students=getStudents(db);assert.equal(students.find(s=>s.name.startsWith('Иванов')).choices.length,1);assert.equal(students.find(s=>s.name.startsWith('Петров')).choices.length,0);
 const ivan=students.find(s=>s.name.startsWith('Иванов'));assert.equal(ivan.submitted,true);
 importStudents(db,'ФИО;Работа сдана\nиванов Иван Иванович;');assert.equal(getStudents(db).find(s=>s.key===ivan.key).submitted,true);assert.equal(getStudents(db).length,2);
 importStudents(db,'ФИО\nИванов Иван Иванович');assert.equal(getStudents(db).find(s=>s.key===ivan.key).submitted,true);
 importStudents(db,'ФИО;Работа сдана\nИванов Иван Иванович;Нет');assert.equal(getStudents(db).find(s=>s.key===ivan.key).submitted,false);
 assert.equal(setSubmitted(db,ivan.key,true),true);assert.equal(setSubmitted(db,'unknown',true),false);assert.throws(()=>setSubmitted(db,ivan.key,'false'));
 const csv=studentsCsv(getStudents(db));assert.match(csv,/"Работа сдана"/);assert.match(csv,/"Тема выбрана"/);assert.equal(parseStudentCsv(csv).students.find(s=>s.key===ivan.key).submitted,true);
 assert.throws(()=>importStudents(db,'ФИО;Работа сдана\nНовый Студент;Да\nОшибка Студент;???'));assert.equal(getStudents(db).length,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM responses').get().n,1);
 db.close();db=openDatabase(path);assert.equal(getStudents(db).find(s=>s.key===ivan.key).submitted,true);
 }finally{db?.close();rmSync(dir,{recursive:true,force:true})}
});
test('Roster HTTP routes are admin-only and enforce Origin; submitted flag survives restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'roster-http-')),path=join(dir,'db.sqlite'),port=31917,origin=`http://127.0.0.1:${port}`,admin=`http://127.0.0.1:${port+1}`;let child;
 async function start(){child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DB_PATH:path,PORT:String(port),ADMIN_PORT:String(port+1),PUBLIC_URL:origin},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',code=>reject(Error('Server exit '+code)))});await fetch(admin+'/api/students')}
 async function stop(){if(!child||child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done}
 const request=(url,method,body,from=origin)=>fetch(url,{method,headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{await start();assert.equal((await fetch(origin+'/api/students')).status,404);assert.equal((await fetch(origin+'/students.csv')).status,404);assert.equal((await request(origin+'/api/students/import','POST',{csv:'ФИО\nИванов Иван'})).status,404);
 assert.equal((await request(admin+'/api/students/import','POST',{csv:'ФИО\nИванов Иван'},'https://evil.example')).status,403);
 let result=await request(admin+'/api/students/import','POST',{csv:'ФИО;Работа сдана\nИванов Иван;Нет'});assert.equal(result.status,200);assert.equal((await result.json()).added,1);
 const row=(await (await fetch(admin+'/api/students')).json()).students[0];assert.equal(row.choices.length,0);
 assert.equal((await request(admin+'/api/students/submitted','PATCH',{key:row.key,submitted:true})).status,200);
 assert.equal((await request(admin+'/api/students/submitted','PATCH',{key:row.key,submitted:'true'})).status,400);
 assert.match(await (await fetch(admin+'/students.csv')).text(),/"Иванов Иван";"Да";"Нет"/);assert.equal((await fetch(admin+'/roster.js')).status,200);
 await stop();await start();assert.equal((await (await fetch(admin+'/api/students')).json()).students[0].submitted,true);
 }finally{await stop();rmSync(dir,{recursive:true,force:true})}
});

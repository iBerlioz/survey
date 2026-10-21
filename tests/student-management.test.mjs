import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase,book,options} from '../database.mjs';
import {getStudents,importStudents,editStudent,deleteStudent,parseStudentCsv,studentsCsv} from '../roster.mjs';
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'student-edit-')),path=join(dir,'survey.sqlite');let db;try{db=openDatabase(path);return fn(db,path)}finally{db?.close();rmSync(dir,{recursive:true,force:true})}}
test('Grade migration retains existing roster and is safe to repeat',()=>{const dir=mkdtempSync(join(tmpdir(),'student-migrate-')),path=join(dir,'db.sqlite');let db;try{db=new DatabaseSync(path);db.exec("CREATE TABLE students(name_key TEXT PRIMARY KEY,name TEXT NOT NULL,submitted INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);INSERT INTO students VALUES('иванов иван','Иванов Иван',1,'now')");db.close();db=openDatabase(path);assert.equal(getStudents(db)[0].grade,'');assert.equal(getStudents(db)[0].submitted,true);editStudent(db,'иванов иван',{grade:'0'});db.close();db=openDatabase(path);assert.equal(getStudents(db)[0].grade,'0');assert.equal(db.prepare('PRAGMA table_info(students)').all().filter(c=>c.name==='grade').length,1)}finally{db?.close();rmSync(dir,{recursive:true,force:true})}});
test('Grades import/export, blank preservation, explicit clearing and invalid input',()=>fixture(db=>{
 importStudents(db,'ФИО;Работа сдана;Оценка\nИванов Иван;Да;8\nПетров Пётр;Нет;');assert.equal(getStudents(db).find(s=>s.key==='иванов иван').grade,'8');
 importStudents(db,'ФИО;Оценка\nИванов Иван;');assert.equal(getStudents(db).find(s=>s.key==='иванов иван').grade,'8');
 importStudents(db,'ФИО\nИванов Иван');assert.equal(getStudents(db).find(s=>s.key==='иванов иван').submitted,true);
 importStudents(db,'ФИО;Оценка\nИванов Иван;Отлично');assert.equal(getStudents(db).find(s=>s.key==='иванов иван').grade,'Отлично');
 const roundTrip=parseStudentCsv(studentsCsv(getStudents(db)));assert.equal(roundTrip.students.find(s=>s.key==='иванов иван').grade,'Отлично');
 assert.throws(()=>importStudents(db,'ФИО;Оценка\nНовый Студент;8\nИванов Иван;'+ 'x'.repeat(33)));assert.equal(getStudents(db).length,2);
 assert.throws(()=>parseStudentCsv('ФИО;Оценка\nИванов Иван;8\nИВАНОВ ИВАН;9'));
 assert.equal(editStudent(db,'иванов иван',{grade:''}),true);assert.equal(getStudents(db).find(s=>s.key==='иванов иван').grade,'');assert.throws(()=>editStudent(db,'иванов иван',{grade:{bad:true}}));assert.throws(()=>editStudent(db,'иванов иван',{submitted:'true'}));
}));
test('Roster edits preserve topic links; conflicting names roll back; deleting roster preserves answers and slots',()=>fixture(db=>{
 importStudents(db,'ФИО;Работа сдана;Оценка\nИванов Иван;Да;8\nПетров Пётр;Нет;');assert.equal(book(db,{name:' ИВАНОВ   Иван ',format:options.formats[0],topic:options.topics[0],mode:'list',round:0}).status,200);
 assert.equal(editStudent(db,'иванов иван',{name:'Сидоров Сидор',grade:9}),true);const renamed=getStudents(db).find(s=>s.key==='сидоров сидор');assert.equal(renamed.grade,'9');assert.equal(renamed.submitted,true);assert.equal(renamed.choices.length,1);assert.equal(db.prepare('SELECT name FROM responses').get().name,'Сидоров Сидор');
 assert.throws(()=>editStudent(db,'сидоров сидор',{name:'Петров Пётр',grade:'3'}),e=>e.status===409);assert.equal(getStudents(db).find(s=>s.key==='сидоров сидор').grade,'9');assert.equal(db.prepare('SELECT name FROM responses').get().name,'Сидоров Сидор');
 assert.equal(deleteStudent(db,'сидоров сидор'),true);assert.equal(deleteStudent(db,'сидоров сидор'),false);assert.equal(getStudents(db).length,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM responses').get().n,1);assert.equal(editStudent(db,'unknown',{grade:'7'}),false);
}));

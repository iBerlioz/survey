import {options} from './database.mjs';
export function withTopicSource(row){return {...row,topic_source:options.topics.includes(row.topic)?'Из списка':'Своя тема'}}
export function toCsv(rows){const safe=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};return '\uFEFF'+[['ФИО','Форма экзаменационной работы','Тема','Дата (UTC)','Круг','Тип темы'],...rows.map(r=>[r.name,r.format,r.topic,r.created_at,r.topic_round+1,withTopicSource(r).topic_source])].map(r=>r.map(safe).join(';')).join('\r\n')+'\r\n'}
export function getResponses(db){return db.prepare('SELECT id,name,format,topic,created_at,topic_round FROM responses ORDER BY created_at DESC').all().map(withTopicSource)}


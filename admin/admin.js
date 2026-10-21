let data={responses:[],formats:[]};const el=id=>document.getElementById(id);
function normalizeName(name){return name.trim().replace(/\s+/g,' ').toLocaleLowerCase('ru')}
function groupResponses(responses){const groups=new Map();for(const row of responses){const key=normalizeName(row.name);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}return groups}
function render(){
 const query=el('search').value.toLocaleLowerCase('ru'),format=el('format').value;
 const allGroups=groupResponses(data.responses);
 const duplicates=[...allGroups.values()].filter(rows=>rows.length>1);
 const extra=duplicates.reduce((n,rows)=>n+rows.length-1,0);
 el('duplicates-summary').textContent=`ФИО с повторами: ${duplicates.length}. Повторных записей сверх первой: ${extra}.`;
 const rows=data.responses.filter(r=>(!el('custom-topics-only').checked||r.topic_source==='Своя тема')&&(!format||r.format===format)&&(!query||(r.name+' '+r.topic).toLocaleLowerCase('ru').includes(query))&&(!el('duplicates-only').checked||allGroups.get(normalizeName(r.name)).length>1));
 const visibleGroups=[...groupResponses(rows).entries()].sort(([a],[b])=>Number(allGroups.get(b).length>1)-Number(allGroups.get(a).length>1));
 el('rows').replaceChildren();
 for(const [key,group] of visibleGroups){
  const total=allGroups.get(key).length;
  if(total>1){const heading=document.createElement('tr');heading.className='duplicate-heading';const cell=document.createElement('th');cell.colSpan=6;cell.scope='rowgroup';cell.textContent=`${group[0].name.trim()} — ${total} записей, повторных: ${total-1}${group.length<total?` (по фильтру показано ${group.length})`:''}`;heading.append(cell);el('rows').append(heading)}
  for(const row of group){const tr=document.createElement('tr');if(total>1)tr.className='duplicate-row';for(const [column,value] of [row.name,row.format,row.topic,new Date(row.created_at).toLocaleString('ru-RU'),row.topic_round+1].entries()){const td=document.createElement('td');td.textContent=String(value);if(column===2&&row.topic_source==='Своя тема'){td.className='custom-topic';const badge=document.createElement('span');badge.className='custom-topic-badge';badge.textContent='Своя тема';td.append(badge)}tr.append(td)}const actions=document.createElement('td');for(const [title,fn] of [['Исправить',()=>openEdit(row)],['Удалить',()=>remove(row)]]){const b=document.createElement('button');b.textContent=title;b.addEventListener('click',fn);actions.append(b)}tr.append(actions);el('rows').append(tr)}
 }
 if(!rows.length){const tr=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.textContent='Нет записей по выбранным условиям';tr.append(cell);el('rows').append(tr)}
 el('count').textContent=`Показано ${rows.length} из ${data.responses.length}. Даты — в часовом поясе вашего браузера.`;
 el('stats').replaceChildren();for(let i=0;i<data.formats.length;i++){const n=data.responses.filter(r=>r.format===data.formats[i]).length;const card=document.createElement('div');card.className='card';const strong=document.createElement('strong');strong.textContent=i<3?`${n} / 8`:String(n);const span=document.createElement('span');span.textContent=data.formats[i];card.append(strong,span);el('stats').append(card)}
}
async function load(){el('refresh').disabled=true;try{const r=await fetch('./api/responses',{cache:'no-store'});if(!r.ok)throw Error();data=await r.json();if(el('format').options.length===1)for(const f of data.formats){const o=document.createElement('option');o.value=f;o.textContent=f;el('format').append(o)}render();if(window.refreshRoster)window.refreshRoster();el('status').textContent=`Всего ответов: ${data.responses.length}. Обновлено ${new Date().toLocaleTimeString('ru-RU')}`;el('status').className=''}catch{el('status').textContent='Не удалось загрузить ответы. Нажмите «Обновить».';el('status').className='error'}finally{el('refresh').disabled=false}}
window.refreshResponses=load;
el('duplicates-only').addEventListener('change',render);
el('custom-topics-only').addEventListener('change',render);
el('refresh').addEventListener('click',load);el('search').addEventListener('input',render);el('format').addEventListener('change',render);load();setInterval(load,15000);

let editing=null;
function openEdit(row){editing=row.id;el('edit-name').value=row.name;el('edit-topic').value=row.topic;el('edit-error').textContent='';el('edit-format').replaceChildren();for(const f of data.formats){const o=document.createElement('option');o.textContent=f;o.value=f;el('edit-format').append(o)}el('edit-format').value=row.format;el('editor').showModal()}
el('cancel').onclick=()=>el('editor').close();
el('edit-form').onsubmit=async e=>{e.preventDefault();try{const r=await fetch('./api/responses/'+encodeURIComponent(editing),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:el('edit-name').value,format:el('edit-format').value,topic:el('edit-topic').value})});const d=await r.json();if(!r.ok)throw Error(d.error);el('editor').close();await load()}catch(e){el('edit-error').textContent=e.message}};
async function remove(row){if(!confirm('Удалить запись полностью?\n'+row.name+'\n'+row.format+'\n'+row.topic))return;try{const r=await fetch('./api/responses/'+encodeURIComponent(row.id),{method:'DELETE'});const d=await r.json();if(!r.ok)throw Error(d.error);await load()}catch(e){alert(e.message)}}



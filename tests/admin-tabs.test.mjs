import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
test('Admin tabs isolate panels and response exports; keyboard navigation selects and focuses a tab',()=>{
 class Node{constructor(id,controls){this.id=id;this.attrs={'aria-controls':controls};this.handlers={};this.hidden=false}getAttribute(k){return this.attrs[k]}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.handlers[k]=fn}focus(){this.focused=true}}
 const tabs=[new Node('tab-roster','panel-roster'),new Node('tab-topics','panel-topics')],panels={'panel-roster':new Node(),'panel-topics':new Node()},links=[new Node(),new Node()];const document={querySelectorAll:selector=>selector==='[role="tab"]'?tabs:links,getElementById:id=>panels[id]};
 runInNewContext(readFileSync(new URL('../admin/tabs.js',import.meta.url),'utf8'),{document});assert.equal(panels['panel-roster'].hidden,false);assert.equal(panels['panel-topics'].hidden,true);assert(links.every(l=>l.hidden));
 tabs[1].handlers.click();assert.equal(panels['panel-roster'].hidden,true);assert.equal(panels['panel-topics'].hidden,false);assert(links.every(l=>!l.hidden));assert.equal(tabs[1].attrs['aria-selected'],'true');
 let prevented=false;tabs[1].handlers.keydown({key:'ArrowRight',preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(panels['panel-roster'].hidden,false);assert.equal(tabs[0].focused,true);assert.equal(tabs[1].tabIndex,-1);
});

import {openDatabase} from './database.mjs';
import {getResponses,toCsv} from './csv.mjs';
const db=openDatabase();const rows=getResponses(db).reverse().map(({id,...row})=>row);db.close();
process.stdout.write(process.argv.includes('--json')?JSON.stringify(rows,null,2)+'\n':toCsv(rows));

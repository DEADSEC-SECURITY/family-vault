import { createRequire } from 'node:module';
const require=createRequire('/app/package.json');
const {Hono}=require('hono');
const {validator}=require('hono/validator');
const app=new Hono();
app.post('/',validator('json',(v,c)=>v.admin?c.json({rejected:true},400):v),c=>c.json({accepted:true}));
let failures=0;
for(const ct of ['application/json','application/json ; charset=utf-8','application/json;','application/json; unusual_name=utf-8']) {
 const r=await app.request('/',{method:'POST',headers:{'Content-Type':ct},body:JSON.stringify({admin:true})});
 console.log(ct,r.status); if(r.status!==400)failures++;
}
process.exit(failures?1:0);

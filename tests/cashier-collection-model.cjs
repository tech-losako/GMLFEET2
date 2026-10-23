const assert=require('node:assert/strict'),cal=require('../payment-calendar.js');
const c={id:'a'},s=[{id:1,contract_id:'a',due_on:'2026-10-20',lolc_due:60,gml_due:10},{id:2,contract_id:'a',due_on:'2026-10-21',lolc_due:60,gml_due:10},{id:3,contract_id:'a',due_on:'2026-10-22',lolc_due:60,gml_due:10}];
let a=[];assert.deepEqual(cal.collection(c,s,a,'2026-10-21').due.map(x=>x.amount),[70,70]);assert.equal(cal.collection(c,s,a,'2026-10-21').total,140);assert.deepEqual(cal.split(c,s,a,140),{lolc:120,gml:20,unallocated:0});
a=[{schedule_id:1,amount:70,lolc_amount:60}];assert.equal(cal.collection(c,s,a,'2026-10-21').total,70);assert.equal(cal.collection(c,s,a,'2026-10-21').arrears,0);
a.push({schedule_id:2,amount:70,lolc_amount:60});assert.equal(cal.collection(c,s,a,'2026-10-21').total,0);assert.equal(cal.collection(c,s,a,'2026-10-22').total,70);
a.push({schedule_id:2,amount:-70,lolc_amount:-60});assert.equal(cal.collection(c,s,a,'2026-10-21').total,70);assert.deepEqual(cal.split(c,s,[{schedule_id:1,amount:35,lolc_amount:30}],35),{lolc:30,gml:5,unallocated:0});
const w={id:'w',payment_frequency:'weekly'},ws=Array.from({length:6},(_,i)=>({id:i+20,contract_id:'w',due_on:'2026-10-'+(19+i),lolc_due:27,gml_due:2.5}));assert.equal(cal.collection(w,ws,[],'2026-10-23').total,0);assert.equal(cal.collection(w,ws,[],'2026-10-23').next.amount,177);assert.equal(cal.collection(w,ws,[],'2026-10-25').today,177);assert.equal(cal.collection(w,ws,[],'2026-10-26').arrears,177);
console.log('PASS collection terms, partials, reversals, split and weekly boundaries');

assert.equal(cal.addMonths('2024-02-29',24),'2026-02-28');assert.equal(cal.addMonths('2026-01-31',1),'2026-02-28');

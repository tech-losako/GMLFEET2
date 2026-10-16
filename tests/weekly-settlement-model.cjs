const assert=require('node:assert/strict'),{summarize}=require('../dashboard.js'),{settlementDate}=require('../payment-calendar.js');
const data={contracts:[{id:'aziz',status:'active',currency:'USD',payment_frequency:'weekly'}],drivers:[],vehicles:[],payments:[],payment_allocations:[],lolc_deposit_items:[],araka_attempts:[],repayment_schedules:Array.from({length:6},(_,i)=>({id:i+1,contract_id:'aziz',due_on:'2026-10-'+(12+i),lolc_due:27,gml_due:2.5}))};
for(const date of ['2026-10-16','2026-10-17']){const m=summarize(data,date);assert.equal(m.buckets.USD.arrears,0);assert.equal(m.buckets.USD.due,0);assert.equal(m.late.length,0);}
assert.equal(settlementDate('2026-10-12',data.contracts[0]),'2026-10-18');assert.equal(settlementDate('2026-10-18',data.contracts[0]),'2026-10-18');assert.equal(settlementDate('2026-12-31',data.contracts[0]),'2027-01-03');
assert.equal(summarize(data,'2026-10-18').buckets.USD.due,17700);assert.equal(summarize(data,'2026-10-18').buckets.USD.arrears,0);assert.equal(summarize(data,'2026-10-19').buckets.USD.arrears,17700);
data.payment_allocations=[{schedule_id:1,amount:20}];assert.equal(summarize(data,'2026-10-19').buckets.USD.arrears,15700);
data.payment_allocations.push({schedule_id:1,amount:-20});assert.equal(summarize(data,'2026-10-19').buckets.USD.arrears,17700);
data.payment_allocations=data.repayment_schedules.map(s=>({schedule_id:s.id,amount:29.5}));assert.equal(summarize(data,'2026-10-19').buckets.USD.arrears,0);
data.contracts[0].payment_frequency='daily';data.payment_allocations=[];assert.equal(summarize(data,'2026-10-16').buckets.USD.arrears,11800);assert.equal(summarize(data,'2026-10-16').buckets.USD.due,2950);
console.log('PASS weekly Friday/Saturday/Sunday/Monday, year boundary, partial/reversed/full payments and daily-contract compatibility.');

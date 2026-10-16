/* Settlement dates are separate from the daily allocation ledger. */
(function(root){
 'use strict';
 function settlementDate(date,contract){
  if(contract?.payment_frequency!=='weekly')return date;
  const d=new Date(date+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+((7-d.getUTCDay())%7));
  return d.toISOString().slice(0,10);
 }
 const api={settlementDate};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.GMFleetPaymentCalendar=api;
})(typeof window==='object'?window:globalThis);

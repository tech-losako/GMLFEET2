/* Shared cashier/driver PDF. Amounts come from recorded payments. */
window.GMFleetReceipt=(()=>{
 const COMPANY={name:'George Michael Logistics',rccm:'KNG/RCCM/24-B-03334',idnat:'01-F4300-N61874P',address:'1, avenue Ngongo-Lutete, Gombe, Kinshasa',phone:'+243 851 686 846',website:'gmfleet.georgemichaellogistics.cd'};
 const C={ink:[20,40,56],muted:[100,117,130],line:[219,227,232],soft:[245,248,250],red:[211,61,54]};
 let assetsPromise,logo,stamp;
 function asset(src,label){return new Promise((resolve,reject)=>{const img=new Image(),timer=setTimeout(()=>{img.onload=img.onerror=null;reject(Error(label+' indisponible. Réessayez le téléchargement.'));},15000);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error(label+' indisponible. Réessayez le téléchargement.'));};img.src=src;});}
 function ready(){if(!assetsPromise)assetsPromise=Promise.all([asset('/img/logogml-Photoroom.png','Logo'),asset('/img/gml-receipt-stamp.png','Cachet')]).then(([l,s])=>{logo=l;stamp=s;}).catch(error=>{assetsPromise=null;throw error;});return assetsPromise;}
 const clean=v=>String(v??'').normalize('NFC').replace(/[\u0000-\u001f]/g,' ').replace(/[\u202f\u00a0]/g,' ').replace(/[\u2011\u2013\u2014]/g,'-').trim();
 function number(r){const year=String(r.paid_on||r.confirmed_at||new Date().toISOString()).slice(0,4),id=r.kind==='equipment'?String(r.id).replace(/[^a-z0-9]/gi,'').slice(0,10).toUpperCase():String(r.id??'0').replace(/[^0-9]/g,'').padStart(5,'0');return 'GML-'+(r.kind==='equipment'?'EQP':'PAY')+'-'+year+'-'+id;}
 function create(r){
  if(r.status!=='confirmed')throw Error('Paiement non confirmé.');
  if(!window.jspdf?.jsPDF)throw Error('Téléchargement indisponible. Actualisez la page.');
  if(!stamp?.complete||!stamp.naturalWidth)throw Error('Le cachet GML doit être chargé avant de créer le reçu. Réessayez le téléchargement.');
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),L=18,R=192,W=174,code=number(r),cancelled=r.entry_kind==='reversal'||r.reversed;
  const money=v=>Number(v||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).replace(/[\u202f\u00a0]/g,' ')+' '+clean(r.currency||'USD');
  const date=(v,time=false)=>{if(!v)return '-';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?v+'T12:00:00Z':v);return Number.isNaN(d.getTime())?clean(v):clean(new Intl.DateTimeFormat('fr-FR',time?{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Kinshasa'}:{dateStyle:'long',timeZone:'Africa/Kinshasa'}).format(d));};
  const text=(v,x,y,o={})=>doc.text(Array.isArray(v)?v.map(clean):clean(v),x,y,o);
  const font=(size,bold=false,color=C.ink)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);};
  function addLogo(){const img=logo||document.querySelector('.brand img');if(img?.complete&&img.naturalWidth){doc.addImage(img,'PNG',L,15,27,27,undefined,'FAST');return;}font(22,true);text('GM',L,27);font(10,true,C.red);text('FLEET',L,35);}
  function page(){doc.addPage();font(11,true);text(code,L,20);font(8,false,C.muted);text('Détail du versement - suite',R,20,{align:'right'});doc.setDrawColor(...C.line);doc.line(L,26,R,26);return 36;}
  function space(y,h){return y+h>258?page():y;}
  doc.setFillColor(...C.ink);doc.rect(0,0,210,4,'F');doc.setFillColor(...C.red);doc.rect(L,0,25,4,'F');
  addLogo();font(13,true);text(COMPANY.name,51,21);font(9,true,C.red);text('GM FLEET',51,28);font(8,false,C.muted);text(COMPANY.address,51,34);text(COMPANY.phone,51,39);font(7,false,C.muted);text('RCCM : '+COMPANY.rccm+'     IDNAT : '+COMPANY.idnat,L,49);
  font(17,true);text(r.entry_kind==='reversal'?'ANNULATION':'REÇU',R,20,{align:'right'});font(8,true,C.muted);text(r.kind==='equipment'?'RÈGLEMENT ÉQUIPEMENTS':'DE VERSEMENT',R,27,{align:'right'});font(9,true);text(code,R,35,{align:'right'});font(7,false,C.muted);text('Émis le '+date(r.confirmed_at,true),R,42,{align:'right'});
  doc.setDrawColor(...C.line);doc.line(L,55,R,55);
  doc.setFillColor(...(cancelled?C.red:C.ink));doc.roundedRect(L,65,W,32,2,2,'F');font(8,true,[220,230,235]);text(r.entry_kind==='reversal'?'MONTANT ANNULÉ':'MONTANT ENCAISSÉ',L+6,75);font(23,true,[255,255,255]);text(money(r.total_charged??r.amount),L+6,89);font(9,true,[255,255,255]);text(cancelled?'ANNULÉ':'PAIEMENT CONFIRMÉ',R-6,76,{align:'right'});font(8,false,[235,241,244]);text(date(r.paid_on),R-6,89,{align:'right'});
  let y=105;
  const rows=[[[r.kind==='equipment'?'DOSSIER CLIENT':'CHAUFFEUR',r.driver_name],['CONTRAT / DOSSIER',r.contract_reference]],[['VÉHICULE',clean(r.vehicle?.model)+' · '+clean(r.vehicle?.plate)],['MODE DE PAIEMENT',clean(r.method).replace(/Araka/gi,'Mobile Money')]],[['RÉFÉRENCE DU VERSEMENT',r.reference],['ENCAISSEMENT CONFIRMÉ PAR',r.confirmed_by||'GM Fleet']]];
  for(const row of rows){font(9);const values=row.map(([,v])=>doc.splitTextToSize(clean(v)||'-',80)),height=Math.max(...values.map(a=>a.length))*4.5+9.5;y=space(y,height);row.forEach(([label],i)=>{const x=L+i*90;font(7,true,C.muted);text(label,x,y);font(9);text(values[i],x,y+6);});y+=height;}
  y+=3;y=space(y,65);font(8,true,C.muted);text('DÉTAIL DU PAIEMENT',L,y);y+=6;
  const items=r.kind==='equipment'?[['Règlement équipements GML',r.amount]]:[['Part GM Fleet',r.gml_amount??Number(r.amount)-Number(r.lolc_amount||0)],['Part LOLC encaissée pour son compte',r.lolc_amount||0],['Frais de transaction',r.transaction_fee||0]];
  for(const [label,amount] of items){doc.setFillColor(...C.soft);doc.rect(L,y,W,10,'F');font(9);text(label,L+4,y+6.5);font(10,true);text(money(amount),R-4,y+6.5,{align:'right'});y+=11;}
  doc.setDrawColor(...C.ink);doc.line(L,y,R,y);font(10,true);text(r.entry_kind==='reversal'?'TOTAL ANNULÉ':'TOTAL ENCAISSÉ',L+4,y+8);font(12,true);text(money(r.total_charged??r.amount),R-4,y+8,{align:'right'});y+=20;
  if(r.kind==='equipment'){y=space(y,16);font(8,false,C.muted);text(doc.splitTextToSize('Forfait de référence : tracker 130 USD + installation 20 USD + services 7,50 USD x 12 = 90 USD. Le total encaissé ci-dessus correspond au règlement effectivement reçu.',W),L,y);y+=15;}
  if(r.reversed){y=space(y,12);font(9,true,C.red);text('Ce versement a été annulé par une contre-écriture.',L,y);y+=10;}
  if(r.covered_dates?.length){y=space(y,18);font(8,true,C.muted);text('ÉCHÉANCES COUVERTES',L,y);y+=8;for(let i=0;i<r.covered_dates.length;i+=2){y=space(y,8);r.covered_dates.slice(i,i+2).forEach((d,n)=>{font(8);text(date(d.date),L+n*90,y);font(8,true);text(money(d.amount),L+n*90+81,y,{align:'right'});});y+=7;}y+=5;}
  if(y+32>275)y=page();
  doc.addImage(stamp,'PNG',L,y,32,32,undefined,'FAST');
  for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);doc.setDrawColor(...C.line);doc.line(L,278,R,278);font(7,false,C.muted);text('GM Fleet · Une marque de George Michael Logistics',L,284);text(COMPANY.website,L,289);text('Page '+p+' / '+doc.getNumberOfPages(),R,284,{align:'right'});}
  doc.setProperties({title:code+' - Reçu GM Fleet',author:COMPANY.name,subject:'Paiement GM Fleet enregistré'});return doc;
 }
 async function createAsync(r){await ready();return create(r);}
 return {COMPANY,create,createAsync,number,ready,download:async r=>(await createAsync(r)).save(number(r)+'.pdf')};
})();

/* PDF receipts use server-confirmed payment data. jsPDF is pinned and served locally. */
window.GMFleetReceipt = (() => {
 const COMPANY = {
  name: 'George Michael Logistics',
  rccm: 'KNG/RCCM/24-B-03334',
  idnat: '01-F4300-N61874P',
  address: '1 Ngongo-Lutete, Kinshasa'
 };
 const COLORS = {
  ink: [20, 40, 56],
  muted: [103, 122, 139],
  line: [214, 222, 229],
  soft: [247, 249, 251],
  red: [211, 61, 54]
 };

 function create(receipt){
  if(receipt.status!=='confirmed')throw new Error('Paiement non confirmé.');
  if(!window.jspdf?.jsPDF)throw new Error('Téléchargement indisponible. Actualisez la page.');

  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'});
  const clean=value=>String(value??'').normalize('NFC').replace(/[\u0000-\u001f]/g,' ').replace(/[\u202f\u00a0]/g,' ').trim();
  const money=value=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0).replace(/[\u202f\u00a0]/g,' ')+' '+clean(receipt.currency);
  const paymentDate=parseDate(receipt.paid_on);
  const confirmedDate=parseDate(receipt.confirmed_at,true);
  const receiptCode=number(receipt);
  const left=18;
  const right=192;

  function parseDate(value,withTime=false){
   if(!value)return '—';
   const bare=/^\d{4}-\d{2}-\d{2}$/.test(value);
   const parsed=new Date(bare?value+'T12:00:00Z':value);
   if(Number.isNaN(parsed.getTime()))return clean(value);
   const options=withTime
    ?{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Kinshasa'}
    :{day:'2-digit',month:'long',year:'numeric',timeZone:'Africa/Kinshasa'};
   return new Intl.DateTimeFormat('fr-FR',options).format(parsed).replace(/[\u202f\u00a0]/g,' ');
  }
  function text(value,x,y,options={}){
   const content=Array.isArray(value)?value.map(clean):clean(value);
   doc.text(content,x,y,options);
  }
  function addLogo(){
   const image=document.querySelector('.brand img');
   if(image?.complete&&image.naturalWidth){
    try{
     const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;
     const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,240,240);context.drawImage(image,0,0,240,240);
     doc.addImage(canvas.toDataURL('image/jpeg',.9),'JPEG',left,15,25,25,undefined,'FAST');return;
    }catch{}
   }
   doc.setDrawColor(...COLORS.red);doc.setLineWidth(1);doc.circle(left+12.5,27.5,11.5);
   doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...COLORS.red);text('GML',left+12.5,30,{align:'center'});
  }
  function drawHeader(){
   addLogo();
   doc.setTextColor(...COLORS.ink);doc.setFont('helvetica','bold');doc.setFontSize(14);text(COMPANY.name,48,20.5);
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);
   text('RCCM: '+COMPANY.rccm,48,27);
   text('IDNAT: '+COMPANY.idnat,48,32.5);
   text(COMPANY.address,48,38);

   doc.setFont('helvetica','bold');doc.setFontSize(16);text('REÇU',right,20.5,{align:'right'});
   doc.setFontSize(10);text('DE PAIEMENT',right,26,{align:'right'});
   doc.setFontSize(9.5);text(receiptCode,right,32.5,{align:'right'});
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...COLORS.muted);
   text('Date : '+paymentDate,right,38,{align:'right'});
   doc.setTextColor(...COLORS.ink);doc.setFont('helvetica','bold');text('Confirmé le : '+confirmedDate,right,44,{align:'right'});

   doc.setDrawColor(...COLORS.ink);doc.setLineWidth(.55);doc.line(left,51,right,51);
   doc.setDrawColor(...COLORS.red);doc.setLineWidth(1.4);doc.line(left,51,left+21,51);
  }
  function drawCustomer(){
   doc.setDrawColor(...COLORS.line);doc.setLineWidth(.25);doc.roundedRect(left,60,174,37,2,2);
   doc.setTextColor(...COLORS.muted);doc.setFont('helvetica','bold');doc.setFontSize(8.5);text('CHAUFFEUR',left+5,68);
   doc.setTextColor(...COLORS.ink);doc.setFontSize(12);text(receipt.driver_name||'—',left+5,76);
   doc.setFont('helvetica','normal');doc.setFontSize(8.8);
   doc.setTextColor(...COLORS.muted);text('Véhicule :',left+5,84);doc.setTextColor(...COLORS.ink);text(receipt.vehicle?.model||'—',left+23,84);
   doc.setTextColor(...COLORS.muted);text('Contrat :',112,68);doc.setTextColor(...COLORS.ink);text(receipt.contract_reference||'—',128,68);
   doc.setTextColor(...COLORS.muted);text('Plaque :',112,76);doc.setTextColor(...COLORS.ink);text(receipt.vehicle?.plate||'—',128,76);
   doc.setTextColor(...COLORS.muted);text('Méthode :',112,84);doc.setTextColor(...COLORS.ink);text(clean(receipt.method||'').replace(/Araka/gi,'Mobile Money')||'—',132,84);
   doc.setTextColor(...COLORS.muted);text('Référence :',left+5,92);doc.setTextColor(...COLORS.ink);doc.setFont('courier','normal');doc.setFontSize(8);text(receipt.reference||'—',left+26,92);
  }
  function drawPaymentTable(){
   const top=108;
   const columns=[left,left+9,left+70,left+123,left+148,right];
   doc.setFillColor(...COLORS.soft);doc.rect(left,top,174,14,'F');
   doc.setDrawColor(...COLORS.line);doc.setLineWidth(.3);doc.line(left,top,right,top);doc.line(left,top+14,right,top+14);
   doc.setTextColor(...COLORS.ink);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
   text('#',left+3,top+8.5);text('Description',columns[1]+2,top+8.5);text('Référence',columns[2]+2,top+8.5);text('Plaque',columns[3]+2,top+8.5);text('Montant',right-2,top+8.5,{align:'right'});

   const description=['Versement au contrat',paymentDate];
   doc.setFont('courier','normal');doc.setFontSize(7.2);
   const reference=doc.splitTextToSize(clean(receipt.reference||'—'),49);
   const rowHeight=Math.max(22,Math.max(description.length,reference.length)*5+7);
   doc.setFont('helvetica','normal');doc.setFontSize(8.7);doc.setTextColor(...COLORS.ink);
   text('1',left+3,top+21);
   text(description,columns[1]+2,top+21);
   doc.setFont('courier','normal');doc.setFontSize(7.2);text(reference,columns[2]+2,top+21);
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);text(receipt.vehicle?.plate||'—',columns[3]+2,top+21);
   doc.setFont('helvetica','bold');doc.setFontSize(9);text(money(receipt.total_charged??receipt.amount),right-2,top+21,{align:'right'});
   doc.setDrawColor(...COLORS.line);doc.setLineWidth(.2);doc.line(left,top+14+rowHeight,right,top+14+rowHeight);
   return top+14+rowHeight;
  }
  function drawTotal(y){
   y+=10;
   doc.setTextColor(...COLORS.ink);doc.setFont('helvetica','bold');doc.setFontSize(11.5);text('TOTAL REÇU',left,y+7);
   doc.setFontSize(12);text(money(receipt.total_charged??receipt.amount),right,y+7,{align:'right'});
   doc.setDrawColor(...COLORS.ink);doc.setLineWidth(.55);doc.line(left,y-3,right,y-3);
   doc.setDrawColor(...COLORS.red);doc.setLineWidth(1.4);doc.line(right-30,y+11,right,y+11);
   return y+20;
  }
  function drawBreakdown(y){
   const items=[
    ['Versement au contrat',money(receipt.amount)],
    ['Frais de transaction',money(receipt.transaction_fee)],
    ['Part LOLC',receipt.lolc_amount===undefined?'—':money(receipt.lolc_amount)],
    ['Part GML',receipt.gml_amount===undefined?'—':money(receipt.gml_amount)]
   ];
   doc.setFillColor(...COLORS.soft);doc.roundedRect(left,y,174,28,1.5,1.5,'F');
   doc.setTextColor(...COLORS.muted);doc.setFont('helvetica','bold');doc.setFontSize(7.5);text('DÉTAIL DU VERSEMENT',left+5,y+7);
   items.forEach(([label,value],index)=>{
    const x=left+5+index*42.25;
    doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(...COLORS.muted);text(label,x,y+15);
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...COLORS.ink);text(value,x,y+22);
   });
   return y+36;
  }
  function continuationPage(){
   doc.addPage();
   doc.setTextColor(...COLORS.ink);doc.setFont('helvetica','bold');doc.setFontSize(11);text('REÇU '+receiptCode,left,20);
   doc.setDrawColor(...COLORS.ink);doc.setLineWidth(.4);doc.line(left,25,right,25);
   return 35;
  }
  function drawCoveredDates(y){
   const dates=Array.isArray(receipt.covered_dates)?receipt.covered_dates:[];
   if(!dates.length)return y;
   if(y+23>244)y=continuationPage();
   doc.setTextColor(...COLORS.muted);doc.setFont('helvetica','bold');doc.setFontSize(8);text('ÉCHÉANCES COUVERTES ('+dates.length+')',left,y);
   y+=8;
   for(let index=0;index<dates.length;index+=3){
    if(y+8>244){y=continuationPage();doc.setTextColor(...COLORS.muted);doc.setFont('helvetica','bold');doc.setFontSize(8);text('ÉCHÉANCES COUVERTES - SUITE',left,y);y+=8;}
    dates.slice(index,index+3).forEach((item,column)=>{
     const x=left+column*58;
     doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...COLORS.ink);text(parseDate(item.date),x,y);
     doc.setFont('helvetica','bold');text(money(item.amount),x+54,y,{align:'right'});
    });
    y+=8;
   }
   return y+3;
  }
  function drawSignatures(y){
   if(y+25>270)y=continuationPage();
   y=Math.max(y+8,232);
   doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...COLORS.muted);text('Signature & cachet GML',left,y);text('Signature chauffeur',113,y);
   doc.setDrawColor(...COLORS.line);doc.setLineWidth(.25);doc.line(left,y+15,89,y+15);doc.line(113,y+15,right,y+15);
  }
  function drawFooters(){
   const pages=doc.getNumberOfPages();
   for(let page=1;page<=pages;page++){
    doc.setPage(page);doc.setDrawColor(...COLORS.line);doc.setLineWidth(.2);doc.line(left,278,right,278);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...COLORS.muted);
    text('GM Fleet · Une marque de George Michael Logistics',left,284);
    text('gmfleet.georgemichaellogistics.cd',105,284,{align:'center'});
    text('Page '+page+' / '+pages,right,284,{align:'right'});
   }
  }

  drawHeader();
  drawCustomer();
  let y=drawPaymentTable();
  y=drawTotal(y);
  y=drawBreakdown(y);
  y=drawCoveredDates(y);
  drawSignatures(y);
  drawFooters();
  doc.setProperties({title:receiptCode+' - Reçu de paiement',author:'George Michael Logistics',subject:'Versement GM Fleet confirmé'});
  return doc;
 }

 function number(receipt){
  const value=String(receipt.id??'').replace(/[^0-9]/g,'')||'0';
  const source=receipt.paid_on||receipt.confirmed_at||new Date().toISOString();
  const year=String(source).slice(0,4).replace(/[^0-9]/g,'')||String(new Date().getFullYear());
  return 'GML-PAY-'+year+'-'+value.padStart(3,'0');
 }

 return {create,number,download:receipt=>create(receipt).save(number(receipt)+'.pdf')};
})();

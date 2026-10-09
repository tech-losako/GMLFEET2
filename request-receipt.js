/* Downloadable acknowledgement for public applications and equipment orders. */
window.GMFleetRequestReceipt = (() => {
 const COMPANY={name:'George Michael Logistics',rccm:'KNG/RCCM/24-B-03334',idnat:'01-F4300-N61874P',address:'1 Ngongo-Lutete, Kinshasa'};
 const C={ink:[20,40,56],muted:[103,122,139],line:[214,222,229],soft:[247,249,251],red:[211,61,54]};
 const clean=value=>String(value??'').normalize('NFC').replace(/[\u0000-\u001f]/g,' ').replace(/[\u202f\u00a0]/g,' ').trim();
 const safeReference=value=>clean(value||'GML-DEMANDE').replace(/[^A-Z0-9-]/gi,'-');
 const excludedLabels=new Set(['Total du plan','Acompte initial','Caution','Coût total','Coût total du véhicule','Prix total du véhicule','Dépôt de garantie'].map(label=>label.toLocaleLowerCase('fr')));

 function create(data){
  if(!window.jspdf?.jsPDF)throw new Error('Téléchargement indisponible. Actualisez la page.');
  const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),left=18,right=192,reference=safeReference(data.reference);
  const fields=(Array.isArray(data.fields)?data.fields:[]).filter(item=>item&&clean(item.value)&&!excludedLabels.has(clean(item.label).toLocaleLowerCase('fr')));
  const text=(value,x,y,options={})=>doc.text(Array.isArray(value)?value.map(clean):clean(value),x,y,options);
  const date=value=>{
   const parsed=value?new Date(value):new Date();
   return Number.isNaN(parsed.getTime())?clean(value):new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Africa/Kinshasa'}).format(parsed).replace(/[\u202f\u00a0]/g,' ');
  };
  function logo(){
   const image=document.querySelector('.pub-logo img,.brand img');
   if(image?.complete&&image.naturalWidth){try{const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,240,240);context.save();context.beginPath();context.arc(120,120,116,0,Math.PI*2);context.clip();context.drawImage(image,0,0,240,240);context.restore();doc.addImage(canvas.toDataURL('image/jpeg',.9),'JPEG',left,15,25,25,undefined,'FAST');return;}catch{}}
   doc.setDrawColor(...C.red);doc.setLineWidth(1);doc.circle(left+12.5,27.5,11.5);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...C.red);text('GML',left+12.5,30,{align:'center'});
  }
  function header(){
   logo();doc.setTextColor(...C.ink);doc.setFont('helvetica','bold');doc.setFontSize(14);text(COMPANY.name,48,20.5);
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);text('RCCM: '+COMPANY.rccm,48,27);text('IDNAT: '+COMPANY.idnat,48,32.5);text(COMPANY.address,48,38);
   doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...C.red);text('GM FLEET',right,21,{align:'right'});
   doc.setDrawColor(...C.ink);doc.setLineWidth(.55);doc.line(left,51,right,51);doc.setDrawColor(...C.red);doc.setLineWidth(1.4);doc.line(left,51,left+21,51);
   doc.setTextColor(...C.ink);doc.setFont('helvetica','bold');doc.setFontSize(15);
   const title=doc.splitTextToSize(clean(data.title||'Récépissé de candidature'),174);text(title,left,63);
   const metaY=63+(title.length-1)*6+11;
   doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...C.muted);text('Référence',left,metaY);text('Date de réception · Kinshasa',112,metaY);
   doc.setTextColor(...C.ink);doc.setFontSize(9);const received=doc.splitTextToSize(date(data.submittedAt),80);text(received,112,metaY+6);
   doc.setFont('helvetica','bold');const ref=doc.splitTextToSize(reference,86);text(ref,left,metaY+6);
   return metaY+6+Math.max(ref.length,received.length)*4.2+9;
  }
  function continuation(){
   doc.addPage();doc.setTextColor(...C.ink);doc.setFont('helvetica','bold');doc.setFontSize(11);text('RÉCÉPISSÉ '+reference,left,20);doc.setDrawColor(...C.ink);doc.setLineWidth(.4);doc.line(left,25,right,25);return 35;
  }
  let y=header();
  for(const item of fields){
   doc.setFont('helvetica','normal');doc.setFontSize(8.5);const label=doc.splitTextToSize(clean(item.label),59);
   doc.setFontSize(9.5);const value=doc.splitTextToSize(clean(item.value),106),lines=Math.max(label.length,value.length);
   // Split oversized rows across pages instead of clipping a long submitted value.
   for(let offset=0;offset<lines;){
    if(y+10>267)y=continuation();
    const count=Math.min(lines-offset,Math.floor((267-y-5)/4.2)),height=Math.max(10,count*4.2+5);
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...C.muted);if(offset<label.length)text(label.slice(offset,offset+count),left,y+5.2,{lineHeightFactor:4.2/(8.5/2.834645669)});
    doc.setFontSize(9.5);doc.setTextColor(...C.ink);if(offset<value.length)text(value.slice(offset,offset+count),86,y+5.2,{lineHeightFactor:4.2/(9.5/2.834645669)});
    doc.setDrawColor(...C.line);doc.setLineWidth(.15);doc.line(left,y+height,right,y+height);y+=height;offset+=count;
    if(offset<lines)y=continuation();
   }
  }
  const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setDrawColor(...C.line);doc.setLineWidth(.2);doc.line(left,278,right,278);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...C.muted);text('GM Fleet · Une marque de George Michael Logistics',left,284);text('gmfleet.georgemichaellogistics.cd',105,284,{align:'center'});text('Page '+page+' / '+pages,right,284,{align:'right'});}
  doc.setProperties({title:reference+' - Récépissé',author:COMPANY.name,subject:clean(data.category||'Demande GM Fleet')});return doc;
 }
 function download(data){const reference=safeReference(data.reference);create(data).save(reference+'.pdf');}
 function present(container,data){
  if(!container||!data?.reference)return;
  const host=container.matches('dialog')?container:container.querySelector('.relative')||container;
  host.querySelector('.request-confirmation')?.remove();
  const panel=document.createElement('div');panel.className='request-confirmation';
  const sms=data.smsStatus==='sent'?'Un SMS de confirmation a été envoyé au numéro indiqué.':'Votre demande est enregistrée. Conservez ce récépissé.';
  panel.innerHTML='<strong>Référence : '+clean(data.reference)+'</strong><p>'+sms+'</p><button type="button" class="pub-button primary">Télécharger mon récépissé PDF</button>';
  panel.querySelector('button').onclick=()=>download(data);
  const anchor=host.querySelector('a[href],.equipment-quote-close');
  if(anchor?.classList.contains('equipment-quote-close'))host.append(panel);else if(anchor)anchor.before(panel);else host.append(panel);
 }
 return {create,download,present};
})();

"use strict";
/**
 * Movida PSST — prototipo local fase 1.
 * IMPORTANTE: no hay backend, usuarios ni validación externa. No utilizar con datos sensibles.
 */
const KEY="movida_constructor_psst_demo_v1";
const DB_NAME="movida_psst_demo_files_v1";
const STEPS=[
  {id:"entidad",label:"Entidad de trabajo",ref:"NT-04-2023 · Art. 14",desc:"Identifica la entidad y su organización. El Programa no puede ser genérico: debe corresponder a actividades y centros de trabajo concretos."},
  {id:"procesos",label:"Procesos de trabajo",ref:"NT-04-2023 · Art. 14.1 y 14.2",desc:"Describe las etapas reales, el objeto, los medios y la organización del trabajo. No sustituyas la observación y la consulta a los trabajadores."},
  {id:"peligros",label:"Peligros y riesgos",ref:"NT-04-2023 · Art. 14.2",desc:"Registra las condiciones peligrosas, las personas expuestas, controles existentes y metodología de evaluación. La app organiza información, no realiza mediciones de campo."},
  {id:"planes",label:"Planes preventivos",ref:"NT-04-2023 · Arts. 17 y 18",desc:"Cada actividad debe responder a los procesos peligrosos identificados. Define objetivos, metas, frecuencia, responsables, medidas, instrumentos y recursos."},
  {id:"evidencias",label:"Evidencias",ref:"NT-04-2023 · Arts. 14, 15 y 17",desc:"Asocia documentos reales a los requisitos. En esta fase se almacenan solo en el navegador; subir un archivo no demuestra por sí mismo su autenticidad o validez."},
  {id:"revision",label:"Revisión preliminar",ref:"Matriz interna de datos mínimos",desc:"Identifica datos y soportes pendientes. Este diagnóstico es estructural, no sustituye al Auditor PSST ni significa aprobación normativa."}
];
const PLANTYPES=[
  ["educacion","Educación e información (18.1)"],
  ["induccion","Inducción y cambios (18.2)"],
  ["inspecciones","Inspecciones (18.2.5)"],
  ["monitoreo","Monitoreo de riesgos y procesos peligrosos (18.2.5.5)"],
  ["vigilancia","Vigilancia epidemiológica de la salud (18.2.6)"],
  ["tiempo","Utilización del tiempo libre (18.2.7)"],
  ["procedimientos","Reglas y procedimientos seguros (18.2.8)"],
  ["epp","Protección personal y colectiva (18.2.9)"],
  ["atencion","Atención integral preventiva (18.2.10)"],
  ["emergencias","Contingencias y emergencias (18.2.11)"],
  ["recursos","Recursos económicos (18.2.12)"],
  ["ergonomia","Ingeniería y ergonomía (18.2.13)"]
];
const EVIDENCE=[
  {id:"organigrama",title:"Organigrama de la entidad",ref:"Art. 14.1.1",note:"Debe corresponder a la estructura funcional y operativa real."},
  {id:"flujo",title:"Diagrama del proceso productivo",ref:"Art. 14.1.1",note:"Representa las etapas reales de producción o servicio."},
  {id:"acta_proceso",title:"Acta de identificación del proceso de trabajo",ref:"Art. 14.2.1",note:"Debe reflejar la participación de los actores correspondientes."},
  {id:"acta_asamblea",title:"Acta de asamblea y validación",ref:"Art. 14.1.3",note:"Adjuntar respaldo del resultado de la validación y relación con la nómina."},
  {id:"politica",title:"Política de SST fechada y firmada/endosada",ref:"Art. 15",note:"La firma/endoso y difusión requieren comprobación humana."},
  {id:"evaluacion",title:"Soporte de identificación y evaluación de riesgos",ref:"Art. 14; Guía PSST",note:"Matriz o instrumento aplicado, con metodología justificada."},
  {id:"cronogramas",title:"Cronogramas e instrumentos de planes",ref:"Art. 17",note:"Incluye la programación y herramientas de ejecución de los planes."},
  {id:"revision",title:"Soporte de revisión del CSSL y delegados",ref:"Art. 17.1.2",note:"Registro de la revisión y aprobación por los actores previstos."}
];
const base=()=>({company:{name:"",rif:"",site:"",activity:"",workers:"",ssst:"",cssl:"",responsible:"",shifts:""},processes:[],hazards:[],plans:[],evidence:[],notes:"",version:1});
let state=load(),current=0,savingTimer;
function load(){try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&v.company&&Array.isArray(v.processes)&&Array.isArray(v.hazards)&&Array.isArray(v.plans)&&Array.isArray(v.evidence))return v;}catch{}return base();}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));document.getElementById("saveStatus").textContent="Guardado en este navegador";}catch{document.getElementById("saveStatus").textContent="No se pudo guardar: revisa el espacio";}}
function laterSave(){document.getElementById("saveStatus").textContent="Guardando…";clearTimeout(savingTimer);savingTimer=setTimeout(save,200);}
function h(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function makeId(){return globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);}
function options(list,val,placeholder){return '<option value="">'+h(placeholder||"Selecciona…")+'</option>'+list.map(([id,name])=>'<option value="'+h(id)+'" '+(String(id)===String(val)?"selected":"")+'>'+h(name)+'</option>').join("");}
function field(label,key,opts={}){
  const value=getBind(key);
  const control=opts.options?'<select data-bind="'+h(key)+'">'+options(opts.options,value,opts.placeholder)+'</select>':opts.multiline?'<textarea data-bind="'+h(key)+'" rows="'+(opts.rows||3)+'" placeholder="'+h(opts.placeholder||"")+'">'+h(value)+'</textarea>':'<input data-bind="'+h(key)+'" type="'+(opts.type||"text")+'" value="'+h(value)+'" placeholder="'+h(opts.placeholder||"")+'" '+(opts.type==="number"?'min="0"':'')+'>';
  return '<div class="field '+(opts.wide?"wide":"")+'"><label>'+h(label)+'</label>'+control+(opts.help?'<small>'+h(opts.help)+'</small>':"")+'</div>';
}
function getBind(key){const [group,id,prop]=key.split(":");if(group==="company")return state.company[id]||"";if(group==="notes")return state.notes;if(["processes","hazards","plans"].includes(group))return state[group].find(r=>r.id===id)?.[prop]??"";return "";}
function setBind(key,value){const [group,id,prop]=key.split(":");if(group==="company")state.company[id]=value;else if(group==="notes")state.notes=value;else if(["processes","hazards","plans"].includes(group)){const item=state[group].find(r=>r.id===id);if(item)item[prop]=value;}laterSave();updateProgress();}
function isFilled(v){return String(v??"").trim().length>0;}
function status(){
 const company=["name","rif","site","activity","workers"].every(k=>isFilled(state.company[k]));
 const processes=state.processes.length>0&&state.processes.every(p=>["name","area","object","means","organization","workers"].every(k=>isFilled(p[k])));
 const hazards=state.hazards.length>0&&state.hazards.every(z=>state.processes.some(p=>p.id===z.processId)&&["description","exposed","effects","controls","method"].every(k=>isFilled(z[k])));
 const plans=state.plans.length>0&&state.plans.every(p=>state.hazards.some(z=>z.id===p.hazardId)&&["type","objective","goal","frequency","owner","preventive","predictive","corrective","divulgative","instruments","resources"].every(k=>isFilled(p[k])));
 const evidence=EVIDENCE.every(e=>state.evidence.some(f=>f.category===e.id));
 return {entidad:company,procesos,hazards, peligros:hazards,planes,evidencias:evidence};
}
function updateProgress(){
 const s=status();const done=STEPS.slice(0,5).filter(x=>s[x.id]).length;
 document.getElementById("progressLabel").textContent=done+" de 5 etapas con datos mínimos";
 document.getElementById("progressPct").textContent=Math.round(done/5*100)+"%";
 document.getElementById("progressFill").style.width=(done/5*100)+"%";
}
function nav(){
 const s=status();
 document.getElementById("stepNav").innerHTML=STEPS.map((x,i)=>'<button class="step-link '+(i===current?"active":"")+'" type="button" data-nav="'+i+'" '+(i===current?'aria-current="step"':'')+'><span class="step-num">'+String(i+1).padStart(2,"0")+'</span><span class="step-label">'+h(x.label)+'</span>'+(s[x.id]?'<span class="step-check" aria-label="Datos mínimos completos">✓</span>':'')+'</button>').join("");
 updateProgress();
}
function render(){
 const step=STEPS[current];nav();
 document.getElementById("stepTitle").textContent=step.label;
 document.getElementById("stepMeta").textContent=step.ref;
 document.getElementById("stepDescription").textContent=step.desc;
 document.getElementById("content").innerHTML=({entidad:renderCompany,procesos:renderProcesses,peligros:renderHazards,planes:renderPlans,evidencias:renderEvidence,revision:renderReview})[step.id]();
 document.getElementById("backBtn").disabled=current===0;
 document.getElementById("nextBtn").textContent=current===STEPS.length-1?"Volver al inicio":"Continuar";
}
function wrap(title,body,sub=""){return '<section class="card"><h3>'+h(title)+'</h3>'+(sub?'<p>'+h(sub)+'</p>':"")+body+'</section>';}
function renderCompany(){return wrap("Caracterización de la entidad",'<div class="form-grid">'+[
 field("Razón social","company:name"),field("RIF","company:rif"),field("Centro de trabajo / dirección","company:site",{wide:true}),field("Actividad económica y servicios","company:activity",{wide:true,multiline:true}),field("Número total de trabajadores","company:workers",{type:"number"}),field("Jornadas y turnos","company:shifts"),field("Servicio de Seguridad y Salud en el Trabajo","company:ssst"),field("Comité de Seguridad y Salud Laboral","company:cssl"),field("Profesional responsable y cargo","company:responsible",{wide:true})
].join("")+'</div>')+'<div class="hint">Registra cada centro de trabajo de forma diferenciada cuando proceda. Esta ficha inicial no sustituye la documentación legal del expediente.</div>';}
function entityCard(kind,obj,i){
 const lead='<div class="row-head"><strong>'+h((kind==="processes"?"Proceso":kind==="hazards"?"Peligro":"Actividad")+' '+(i+1))+'</strong><button class="btn btn-text" data-remove="'+kind+':'+h(obj.id)+'" type="button">Eliminar</button></div>';
 const k=x=>kind+":"+obj.id+":"+x;
 if(kind==="processes")return '<div class="row-item">'+lead+'<div class="form-grid">'+[
 field("Etapa o proceso",k("name")),field("Área, departamentos o puestos",k("area")),
 field("Objeto de trabajo",k("object"),{wide:true,multiline:true,help:"Materia, producto, paciente, usuario o servicio sobre el cual recae el trabajo."}),
 field("Medios de trabajo",k("means"),{wide:true,multiline:true,help:"Equipos, herramientas, sustancias, infraestructura."}),
 field("Organización del trabajo",k("organization"),{wide:true,multiline:true,help:"Tareas, secuencia, turnos, ritmos, interacciones y contratistas cuando apliquen."}),
 field("Número de trabajadores expuestos",k("workers"),{type:"number"})
 ].join("")+'</div></div>';
 if(kind==="hazards")return '<div class="row-item">'+lead+'<div class="form-grid">'+[
 field("Proceso asociado",k("processId"),{options:state.processes.map(p=>[p.id,p.name||"Proceso sin nombre"])}),
 field("Tipo o fuente de peligro",k("source"),{placeholder:"Máquina, sustancia, organización…"}),
 field("Descripción factual de la exposición",k("description"),{wide:true,multiline:true}),
 field("Personas expuestas (cantidad)",k("exposed"),{type:"number"}),
 field("Posibles consecuencias",k("effects")),
 field("Controles existentes y necesidades de mejora",k("controls"),{wide:true,multiline:true}),
 field("Metodología de evaluación y fundamento técnico",k("method"),{wide:true,multiline:true,help:"Puedes utilizar IPERC u otra metodología justificada. No se inventan puntuaciones ni mediciones."})
 ].join("")+'</div></div>';
 return '<div class="row-item">'+lead+'<div class="form-grid">'+[
 field("Componente del artículo 18",k("type"),{options:PLANTYPES}),
 field("Proceso peligroso vinculado",k("hazardId"),{options:state.hazards.map(z=>[z.id,(z.source||z.description||"Peligro sin nombre").slice(0,85)])}),
 field("Objetivo",k("objective"),{wide:true,multiline:true}),
 field("Meta verificable",k("goal"),{wide:true,help:"Define el resultado medible. No confundas objetivo con meta."}),
 field("Frecuencia / período",k("frequency")),field("Responsable / cargo",k("owner")),
 field("Acciones preventivas",k("preventive"),{wide:true,multiline:true}),
 field("Acciones predictivas",k("predictive"),{wide:true,multiline:true}),
 field("Acciones correctivas",k("corrective"),{wide:true,multiline:true}),
 field("Acciones divulgativas",k("divulgative"),{wide:true,multiline:true}),
 field("Formularios, instrumentos y procedimiento de ejecución",k("instruments"),{wide:true,multiline:true}),
 field("Recursos requeridos y costo estimado",k("resources"),{wide:true,multiline:true})
 ].join("")+'</div></div>';
}
function collection(kind,title,description,addLabel,empty){
 const rows=state[kind];
 return '<section class="card"><div class="card-header"><h3>'+h(title)+'</h3><button type="button" class="btn btn-primary" data-add="'+kind+'">+ '+h(addLabel)+'</button></div><p>'+h(description)+'</p>'+(rows.length?rows.map((o,i)=>entityCard(kind,o,i)).join(""):'<div class="empty">'+h(empty)+'</div>')+'</section>';
}
function renderProcesses(){return collection("processes","Etapas y procesos","Crea una ficha por proceso real. Describe objeto, medios, organización, área y número de personas expuestas.","Agregar proceso","Todavía no se ha descrito ningún proceso de trabajo.");}
function renderHazards(){return '<div class="hint warn">Antes de evaluar riesgos, documenta los procesos de trabajo. El campo «metodología» no sustituye su aplicación técnica ni las mediciones.</div>'+collection("hazards","Identificación y evaluación","Cada hallazgo debe vincularse a una etapa. Distingue la información observada de las hipótesis y de las medidas propuestas.","Agregar peligro","Todavía no hay procesos peligrosos registrados.");}
function renderPlans(){return '<div class="hint">El artículo 18 establece componentes y contenidos. Estas fichas son una organización funcional de trabajo, no una afirmación de que existan doce planes jurídicamente independientes.</div>'+collection("plans","Actividades de los planes de trabajo","Cada actividad debe enlazarse con el peligro o condición concreta que aborda y cumplir la estructura del artículo 17.","Agregar actividad","Primero identifica los procesos peligrosos para vincular actividades preventivas.");}
function evidenceItem(item){
 const f=state.evidence.find(e=>e.category===item.id);
 return '<div class="evidence-item"><div class="evidence-head"><div><strong>'+h(item.title)+'</strong><div><small>'+h(item.ref)+'</small></div></div><span class="tag '+(f?"ok":"warn")+'">'+(f?"Archivo local":"Pendiente")+'</span></div><p>'+h(item.note)+'</p><label class="sr-only" for="file-'+h(item.id)+'">Seleccionar archivo: '+h(item.title)+'</label><input id="file-'+h(item.id)+'" type="file" data-upload="'+h(item.id)+'" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx" aria-describedby="filesHelp">'+(f?'<div class="file-row"><span>'+h(f.name)+' · '+Math.ceil(f.size/1024)+' KB · sin verificar</span><div class="file-actions"><button class="btn btn-outline" data-filedownload="'+h(f.id)+'" type="button">Descargar copia local</button><button class="btn btn-text" data-filedelete="'+h(f.id)+'" type="button">Eliminar</button></div></div>':'')+'</div>';
}
function renderEvidence(){return '<div id="filesHelp" class="hint warn"><strong>Importante:</strong> los archivos se guardan en IndexedDB de ESTE navegador, sin cifrado ni copia en la nube. Máximo 12 MB por archivo. Usa únicamente archivos ficticios o públicos para pruebas. La presencia de un archivo NO equivale a autenticidad, suficiencia, firma validada ni aprobación.</div><section class="card"><div class="card-header"><h3>Soportes documentales</h3><span class="tag">'+state.evidence.length+' / '+EVIDENCE.length+'</span></div><div class="evidence-list">'+EVIDENCE.map(evidenceItem).join("")+'</div></section>';}
function blockers(){
 const list=[],s=status();
 if(!s.entidad)list.push("Completar identificación de la entidad: razón social, RIF, centro, actividad y número de trabajadores.");
 if(!state.processes.length)list.push("Agregar al menos un proceso de trabajo.");
 else state.processes.forEach((p,i)=>{if(["name","area","object","means","organization","workers"].some(k=>!isFilled(p[k])))list.push("Completar información del proceso "+(i+1)+".");});
 if(!state.hazards.length)list.push("Identificar procesos peligrosos asociados a las actividades.");
 else state.hazards.forEach((z,i)=>{if(!state.processes.some(p=>p.id===z.processId)||["description","exposed","effects","controls","method"].some(k=>!isFilled(z[k])))list.push("Completar y vincular el peligro "+(i+1)+".");});
 if(!state.plans.length)list.push("Definir actividades preventivas en los planes de trabajo.");
 else state.plans.forEach((p,i)=>{if(!state.hazards.some(z=>z.id===p.hazardId)||["type","objective","goal","frequency","owner","preventive","predictive","corrective","divulgative","instruments","resources"].some(k=>!isFilled(p[k])))list.push("Completar la ficha y vinculación de la actividad "+(i+1)+".");});
 EVIDENCE.filter(e=>!state.evidence.some(f=>f.category===e.id)).forEach(e=>list.push("Falta archivo: "+e.title+"."));
 return list;
}
function renderReview(){
 const list=blockers();
 const summary='<div class="stat-grid"><div class="stat"><b>'+state.processes.length+'</b><span>Procesos descritos</span></div><div class="stat"><b>'+state.hazards.length+'</b><span>Peligros registrados</span></div><div class="stat"><b>'+state.plans.length+'</b><span>Actividades planificadas</span></div></div>';
 const body=list.length?'<p>Se detectaron <strong>'+list.length+'</strong> requisitos de captura pendientes. No hay un borrador consolidado listo para imprimir.</p><ul>'+list.map(x=>'<li>'+h(x)+'</li>').join("")+'</ul>':'<p>Los datos mínimos de este prototipo están completos. <strong>Esto NO acredita conformidad normativa.</strong> Los documentos aún requieren verificación humana y el PSST, revisión técnica especializada.</p>';
 return summary+'<section class="card"><h3>Control de preparación del borrador</h3><div class="report">'+body+'</div><div class="pill-links"><span class="pill">Datos mínimos, no cumplimiento</span><span class="pill">Archivos no verificados</span><span class="pill">No conectado al INPSASEL</span></div><button type="button" class="btn btn-primary" data-print '+(list.length?"disabled":"")+'>Imprimir hoja de control (borrador)</button></section>'+wrap("Observaciones del profesional",field("Pendientes, restricciones y criterio técnico","notes",{wide:true,multiline:true,rows:5,help:"No registres información médica ni datos personales en este prototipo."}));
}
async function db(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("files"))req.result.createObjectStore("files",{keyPath:"id"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function fileAction(mode,value){
 const database=await db();
 return new Promise((resolve,reject)=>{const tx=database.transaction("files",mode==="get"?"readonly":"readwrite");const store=tx.objectStore("files");let out;const request=mode==="put"?store.put(value):mode==="delete"?store.delete(value):store.get(value);request.onsuccess=()=>{out=request.result;};tx.oncomplete=()=>{database.close();resolve(out);};tx.onerror=()=>{database.close();reject(tx.error);};});
}
async function upload(category,file){
 if(!file)return;
 if(file.size>12*1024*1024){alert("Máximo 12 MB por archivo.");return;}
 if(!/\.(pdf|png|jpe?g|webp|docx)$/i.test(file.name)){alert("Solo PDF, imagen o DOCX.");return;}
 const id=makeId(),old=state.evidence.find(e=>e.category===category);
 try{
   await fileAction("put",{id,name:file.name,size:file.size,type:file.type,blob:file});
   state.evidence=state.evidence.filter(e=>e.category!==category);
   state.evidence.push({id,category,name:file.name,size:file.size,at:new Date().toISOString(),verified:false});
   if(old)await fileAction("delete",old.id);
   save();render();
 }catch(e){alert("No fue posible guardar el archivo en este navegador. Prueba con un archivo de menor tamaño.");console.error(e);}
}
async function downloadFile(id){try{const file=await fileAction("get",id);if(!file)throw Error("Archivo local no disponible");const url=URL.createObjectURL(file.blob);const a=document.createElement("a");a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}catch{alert("No se encontró el archivo en el almacenamiento local.");}}
async function deleteFile(id){if(!confirm("¿Eliminar este soporte de prueba de este navegador?"))return;try{await fileAction("delete",id);}catch{}state.evidence=state.evidence.filter(f=>f.id!==id);save();render();}
function add(kind){
 const id=makeId(),template=kind==="processes"?{id,name:"",area:"",object:"",means:"",organization:"",workers:""}:kind==="hazards"?{id,processId:"",source:"",description:"",exposed:"",effects:"",controls:"",method:""}:{id,type:"",hazardId:"",objective:"",goal:"",frequency:"",owner:"",preventive:"",predictive:"",corrective:"",divulgative:"",instruments:"",resources:""};
 state[kind].push(template);save();render();
}
function remove(kind,id){
 if(!confirm("¿Eliminar este registro de prueba?"))return;
 state[kind]=state[kind].filter(e=>e.id!==id);
 save();render();
}
function backup(){
 const payload={format:"movida-psst-demo-v1",exportedAt:new Date().toISOString(),warning:"No incluye archivos de IndexedDB. No es un PSST aprobado.",data:state};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="Respaldo_PSST_DEMO_"+new Date().toISOString().slice(0,10)+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function reset(){
 if(!confirm("Esto borrará TODOS los datos y archivos locales de esta aplicación en este navegador. ¿Continuar?"))return;
 try{const database=await db();await new Promise((resolve,reject)=>{const tx=database.transaction("files","readwrite");tx.objectStore("files").clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});database.close();}catch{}
 localStorage.removeItem(KEY);state=base();current=0;render();save();
}
document.getElementById("content").addEventListener("input",e=>{const bind=e.target.dataset.bind;if(bind)setBind(bind,e.target.value);});
document.getElementById("content").addEventListener("change",async e=>{if(e.target.dataset.upload)await upload(e.target.dataset.upload,e.target.files?.[0]);else if(e.target.dataset.bind){setBind(e.target.dataset.bind,e.target.value);render();}});
document.getElementById("content").addEventListener("click",async e=>{
 const addBtn=e.target.closest("[data-add]");if(addBtn){add(addBtn.dataset.add);return;}
 const rm=e.target.closest("[data-remove]");if(rm){const [kind,id]=rm.dataset.remove.split(":");remove(kind,id);return;}
 const dl=e.target.closest("[data-filedownload]");if(dl){await downloadFile(dl.dataset.filedownload);return;}
 const fd=e.target.closest("[data-filedelete]");if(fd){await deleteFile(fd.dataset.filedelete);return;}
 if(e.target.closest("[data-print]")&&!blockers().length)window.print();
});
document.getElementById("stepNav").addEventListener("click",e=>{const t=e.target.closest("[data-nav]");if(!t)return;current=Number(t.dataset.nav);render();window.scrollTo({top:0,behavior:"smooth"});});
document.getElementById("backBtn").addEventListener("click",()=>{current=Math.max(0,current-1);render();window.scrollTo({top:0,behavior:"smooth"});});
document.getElementById("nextBtn").addEventListener("click",()=>{current=(current+1)%STEPS.length;render();window.scrollTo({top:0,behavior:"smooth"});});
document.getElementById("downloadBtn").addEventListener("click",backup);
document.getElementById("resetBtn").addEventListener("click",reset);
render();

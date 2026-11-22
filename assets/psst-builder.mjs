import { exposureRows } from "./psst-exposure.mjs?v=exposicion-1";
import { recordRefs, schedule } from "./psst-program.mjs?v=coach-1";

const list = records => Array.isArray(records) ? records.filter(row=>row && typeof row==="object") : [];
export const recordsOf = list;
export const statusLabels = {
  borrador:"Borrador del taller",revision:"Revisión interna",preparacion:"Preparación para consignación",
};
export const followupLabels = ["Por verificar","En evaluación","Eficaz","Requiere ajuste"];
export function organizationImport(text) {
  const rows = [];
  const parents = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const nombre = raw.trim();
    if (!nombre) continue;
    const indent = raw.match(/^[ \t]*/)[0].replaceAll("\t", "  ").length;
    const level = indent / 2;
    if (!Number.isInteger(level) || level > parents.length) {
      throw new Error("Revisa la sangría de la línea " + (index + 1) + ". Usa dos espacios por nivel, sin saltar niveles.");
    }
    if (nombre.length > 800) throw new Error("Acorta el nombre del cargo de la línea " + (index + 1) + ".");
    rows.push({nombre,parent:parents[level-1]});
    parents[level] = rows.length - 1;
    parents.length = level + 1;
  }
  if (!rows.length) throw new Error("Agrega al menos un cargo a la lista.");
  return rows;
}

export function organizationTree(records) {
  const nodes=list(records).filter(row=>row.id&&row.nombre);
  const byId=new Map(nodes.map(row=>[row.id,row]));
  return nodes.map(row=>{
    const ancestors=[row.id];
    let current=row, cycle=false;
    while(byId.has(current.reportaA)){
      if(ancestors.includes(current.reportaA)){cycle=true;break;}
      ancestors.push(current.reportaA);
      current=byId.get(current.reportaA);
    }
    return {...row,level:cycle?0:ancestors.length-1,
      parent:byId.get(row.reportaA),ancestors,root:current.id,cycle,orphan:Boolean(row.reportaA&&!byId.has(row.reportaA))};
  });
}

export function flowSequence(stages, flowId) {
  return list(stages).filter(row=>row.flujoRef===flowId && row.nombre);
}

function productStages(process, recordedStages) {
  const stages = flowSequence(recordedStages,process.id);
  if (stages.length) return stages;
  const text = process.secuencia ?? "";
  const separator = /[→\n;]/.test(text) ? /(?:→|\r?\n|;)+/ : /,+/;
  return text.split(separator).map(name => name.trim()).filter(Boolean).map(nombre => ({nombre}));
}

export function orderedFlows(flowData) {
  const source=flowData?.flujo??{};
  return list(source.productivos).filter(flow=>flow.id&&flow.nombre).map(flow=>({
    ...flow,
    stages:productStages(flow,source.etapasMapa),
  }));
}

export function nextCode(prefix, rows){
  const used=new Set(list(rows).map(row=>String(row.codigo??"").trim().toUpperCase()));
  let n=1;
  while(used.has(prefix+"-"+String(n).padStart(2,"0"))) n++;
  return prefix+"-"+String(n).padStart(2,"0");
}

export function technicalChecks({one={},two={},three={},four={}}) {
  const issues=[];
  const add=(target,id,message,action)=>issues.push({target,id,message,action});
  const tasks=list(one.tarea?.actividades), risks=list(two.filas), plans=list(three.planesDetallados), activities=list(three.filas);
  const riskIds=new Set(risks.map(row=>row.id));
  const exposure=exposureRows(two,tasks);
  for(const row of organizationTree(one.alcance?.estructura)){
    if(row.cycle||row.orphan) add("estructura",row.id,row.nombre+" tiene una dependencia "+(row.cycle?"circular.":"sin identificar."),"Elige la jefatura correcta.");
  }
  for(const risk of risks){
    const label=risk.codigo||"Hallazgo";
    const groups=exposure.filter(group=>group.hallazgoRef===risk.id&&group.puesto);
    if(!groups.length) add("m2",risk.id,label+" aún no tiene puestos expuestos desglosados.","Pulsa Registrar puestos expuestos y registra las cantidades por puesto, área y turno.");
    const seen=new Set();
    for(const group of groups){
      const key=[group.puesto,group.area,group.turno,group.grupo].map(v=>String(v??"").trim().toLocaleLowerCase("es")).join("|");
      if(seen.has(key)) add("expuestos",group.id,label+" · "+group.puesto+" aparece repetido en el mismo grupo, área y turno.","Revisa si ambas filas cuentan a las mismas personas.");
      seen.add(key);
      if(!group.cantidadValida) add("expuestos",group.id,label+" · "+group.puesto+" tiene el conteo pendiente.","Confirma la cantidad y documenta la fuente.");
    }
    if(!risk.tareaRef||!tasks.some(task=>task.id===risk.tareaRef))
      add("m2",risk.id,label+" no tiene una tarea de origen disponible.","Selecciona la tarea observada o revisa el inventario de Módulo 1.");
    if(risk.prioridad==="Inmediata"&&!plans.some(plan=>recordRefs(plan).includes(risk.id)))
      add("planes",null,label+" está marcado como inmediato y aún no tiene un plan vinculado.","Abre Crear o vincular plan y elige cómo atenderlo.");
    if(risk.estadoEvaluacion==="Pendiente de medición"&&(!risk.responsableEvaluacion||!risk.fechaEvaluacion))
      add("m2",risk.id,label+" tiene una medición pendiente.","Registra quién verificará la exposición y en qué fecha.");
  }
  for(const plan of plans){
    if(recordRefs(plan).some(id=>!riskIds.has(id))) add("planes",plan.id,(plan.codigo||"Plan")+" cita un hallazgo que ya no está disponible.","Revisa los hallazgos vinculados.");
    if(!activities.some(row=>row.planRef===plan.id && schedule(row) && row.responsable))
      add("planes",plan.id,(plan.codigo||"Plan")+" todavía no tiene una actividad programada con responsable.","Pulsa Programar actividad y completa las fechas.");
  }
  for(const row of activities){
    if(!row.actividad) continue;
    if(!schedule(row)||!row.eficacia) add("m3",row.id,row.actividad+" requiere "+(!schedule(row)?"fechas previstas.":"un criterio de eficacia."),"Abre la actividad y completa el dato.");
    if(row.estado==="Ejecutada"&&(!row.cierreReal||!row.evidenciaReal||!row.resultadoEficacia||row.resultadoEficacia==="Por verificar"))
      add("m3",row.id,row.actividad+" figura como ejecutada y tiene verificaciones de cierre pendientes.","Registra fecha real de cierre, evidencia y resultado de la eficacia.");
    if(row.estado==="Reprogramada"&&(!schedule({fechaInicio:row.nuevoInicio,fechaFin:row.nuevoFin})||!row.motivoReprogramacion))
      add("m3",row.id,row.actividad+" tiene una reprogramación por completar.","Indica las fechas nuevas en orden y el motivo.");
  }
  if(four.estadoExpediente&&four.estadoExpediente!=="borrador"&&!four.referenciaExpediente)
    add("expediente",null,"Falta documentar la revisión del expediente.","Indica quién lo revisó, la fecha y los soportes disponibles.");
  return issues;
}

export function operationalSchedule(row) {
  if(row.estado==="Reprogramada"&&row.nuevoInicio&&row.nuevoFin){
    const revised=schedule({fechaInicio:row.nuevoInicio,fechaFin:row.nuevoFin});
    if(revised) return revised;
  }
  return schedule(row);
}

export function executionStats(activities){
  const counts={total:0,pendientes:0,enCurso:0,reprogramadas:0,ejecutadas:0,eficaces:0};
  for(const row of list(activities)){
    if(!row.actividad) continue;
    counts.total++;
    if(row.estado==="Ejecutada") counts.ejecutadas++;
    else if(row.estado==="Reprogramada") counts.reprogramadas++;
    else if(row.estado==="En curso") counts.enCurso++;
    else counts.pendientes++;
    if(row.estado==="Ejecutada"&&row.resultadoEficacia==="Eficaz"&&row.evidenciaReal&&row.cierreReal) counts.eficaces++;
  }
  return counts;
}

const practiceKey="movida-psst-practica-v1";
const sample={
  m1:{draft:{alcance:{centro:"Centro Norte · caso ficticio",area:"Despacho",
    estructura:[{id:"d",nombre:"Dirección del centro"},{id:"o",nombre:"Operaciones",reportaA:"d"},{id:"s",nombre:"SSST",reportaA:"d"}]},
    flujo:{productivos:[{id:"f",codigo:"F-01",nombre:"Distribución de materiales",entradas:"Cajas y pedidos",secuencia:"Recepción → Preparación → Despacho",salidas:"Pedidos entregados",evidencia:"E-01"}],
    etapasMapa:[{id:"e1",flujoRef:"f",nombre:"Recepción"},{id:"e2",flujoRef:"f",nombre:"Preparación"},{id:"e3",flujoRef:"f",nombre:"Despacho",excepcion:"Pedido incompleto: vuelve a preparación"}],
    procesos:[{id:"p",codigo:"P-01",nombre:"Preparación y despacho",productivoRef:"f",etapaMapaRef:"e3"}]},
    tarea:{actividades:[{id:"t",codigo:"T-01",procesoRef:"p",etapa:"Despacho",nombre:"Traslado de cajas",descripcion:"El recorrido de las cajas cruza un paso peatonal.",evidencia:"E-01 · croquis de la ruta"}]}},revision:0},
};
export function practiceStore(storage,id){
  let state;
  try{state=JSON.parse(storage.getItem(practiceKey))??structuredClone(sample);}catch{state=structuredClone(sample);}
  const current=state[id]??{draft:{},revision:0};
  return {
    info:{...current,moduleId:id,label:"Centro Norte · espacio de práctica",projectKey:practiceKey,
      inputs:Object.fromEntries(["m1","m2","m3"].filter(key=>key!==id&&state[key]).map(key=>[key,{data:state[key].draft}])),
      progress:Object.fromEntries(["m1","m2","m3","m4"].map(key=>[key,{revision:state[key]?.revision??0}]))},
    save(next){
      const value={revision:(state[id]?.revision??0)+1,draft:next,savedAt:new Date().toISOString()};
      state[id]=value;
      storage.setItem(practiceKey,JSON.stringify(state));
      return {revision:value.revision};
    },
  };
}

export function exposureRows(two={},tasks=[]){
  const findings=Array.isArray(two.filas)?two.filas:[];
  const byId=new Map(findings.map(row=>[row.id,row]));
  const taskById=new Map((Array.isArray(tasks)?tasks:[]).map(row=>[row.id,row]));
  const groups=Array.isArray(two.gruposExpuestos)?two.gruposExpuestos:[];
  return groups.filter(row=>row && (row.puesto||row.hallazgoRef)).map(row=>{
    const risk=byId.get(row.hallazgoRef);
    const task=taskById.get(risk?.tareaRef);
    const count=String(row.cantidad??"").trim();
    const countValid=/^[1-9][0-9]*$/.test(count)&&Number.isSafeInteger(Number(count));
    return {...row,hallazgo:row.hallazgoRef?(risk?.codigo||risk?.riesgo||"Referencia pendiente de verificar"):"Sin hallazgo vinculado",
      tarea:task?.codigo||task?.nombre||"",cantidadValida:countValid,
      cantidadVisible:countValid?Number(count):"Pendiente de confirmar"};
  });
}

export function exposureSummary(risk,two){
  const groups=exposureRows(two).filter(row=>row.hallazgoRef===risk.id && row.puesto);
  const summaries=groups.map(row=>[row.puesto,row.area,row.turno,row.grupo].filter(Boolean).join(" · ")+
    ": "+(row.cantidadValida?row.cantidadVisible+" personas":row.cantidadVisible));
  if(risk.expuestos) summaries.push("Nota de exposición: "+risk.expuestos);
  return summaries.join("\n");
}

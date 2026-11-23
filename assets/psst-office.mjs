import {annualInvestment} from "./psst-coverage.mjs?v=anual-1";
import {annualTraining} from "./psst-coach.mjs?v=anual-1";
import { exposureRows, exposureSummary } from "./psst-exposure.mjs?v=exposicion-1";
import { operationalSchedule, recordsOf, technicalChecks } from "./psst-builder.mjs?v=exposicion-1";
import { schedule } from "./psst-program.mjs?v=coach-1";
import { activityRows } from "./psst-project.mjs?v=project-2";

const encoder=new TextEncoder();
const xml=value=>String(value??"").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/[<>&"']/g,ch=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[ch]));
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const relns="http://schemas.openxmlformats.org/package/2006/relationships";
const offns="http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function crc32(bytes){
  let crc=0xffffffff;
  for(const b of bytes){
    crc^=b;
    for(let bit=0;bit<8;bit++) crc=(crc>>>1)^(crc&1?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}

function zip(files,type){
  const blocks=[], directory=[];
  let offset=0, size=0;
  for(const [path,data] of Object.entries(files)){
    const name=encoder.encode(path), content=typeof data==="string"?encoder.encode(data):data, crc=crc32(content);
    const header=new Uint8Array(30), h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0x800,true);
    h.setUint16(12,33,true); h.setUint32(14,crc,true); h.setUint32(18,content.length,true);
    h.setUint32(22,content.length,true); h.setUint16(26,name.length,true);
    const entry=new Uint8Array(46), e=new DataView(entry.buffer);
    e.setUint32(0,0x02014b50,true); e.setUint16(4,20,true); e.setUint16(6,20,true); e.setUint16(8,0x800,true);
    e.setUint16(14,33,true); e.setUint32(16,crc,true); e.setUint32(20,content.length,true);
    e.setUint32(24,content.length,true); e.setUint16(28,name.length,true); e.setUint32(42,offset,true);
    blocks.push(header,name,content); directory.push(entry,name);
    offset+=header.length+name.length+content.length; size+=entry.length+name.length;
  }
  const end=new Uint8Array(22), d=new DataView(end.buffer), count=Object.keys(files).length;
  d.setUint32(0,0x06054b50,true); d.setUint16(8,count,true); d.setUint16(10,count,true);
  d.setUint32(12,size,true); d.setUint32(16,offset,true);
  return new Blob([...blocks,...directory,end],{type});
}

function packageOffice(files,target,types,kind){
  const mime="application/vnd.openxmlformats-officedocument.";
  return zip({
    "[Content_Types].xml":declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
      Object.entries(types).map(([name,type])=>'<Override PartName="/'+name+'" ContentType="'+mime+type+'"/>').join("")+'</Types>',
    "_rels/.rels":declaration+'<Relationships xmlns="'+relns+'"><Relationship Id="rId1" Type="'+offns+'/officeDocument" Target="'+target+'"/></Relationships>',
    ...files,
  },mime+kind);
}

const paragraph=(text,style="")=>'<w:p>'+(style?'<w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>':"")+
  '<w:r>'+String(text??"").split("\n").map(line=>'<w:t xml:space="preserve">'+xml(line)+'</w:t>').join("<w:br/>")+'</w:r></w:p>';

export function wordFromReport(report, parse=html=>new DOMParser().parseFromString(html,"text/html")){
  const doc=parse(report);
  let content="";
  for(const node of doc.body.querySelectorAll("h1,h2,h3,p,li,table,dl")){
    if(node.parentElement?.closest("table,dl")) continue;
    if(node.tagName==="TABLE"){
      const rows=[...node.rows];
      const cols=Math.max(1,...rows.map(row=>row.cells.length));
      const width=Math.floor(15500/cols);
      content+='<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:bottom w:val="single" w:sz="4" w:color="B6D8DC"/><w:insideH w:val="single" w:sz="4" w:color="B6D8DC"/></w:tblBorders></w:tblPr><w:tblGrid>'+
        Array.from({length:cols},()=>'<w:gridCol w:w="'+width+'"/>').join("")+'</w:tblGrid>'+
        rows.map((row,i)=>'<w:tr>'+(i===0?'<w:trPr><w:tblHeader/></w:trPr>':"")+
          [...row.cells].map(cell=>'<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/>'+(i===0?'<w:shd w:fill="DDF1F0"/>':"")+'</w:tcPr>'+
            paragraph(cell.textContent,"Small")+"</w:tc>").join("")+"</w:tr>").join("")+"</w:tbl>";
    } else if(node.tagName==="DL"){
      for(const item of node.children) content+=paragraph(item.textContent,item.tagName==="DT"?"Heading3":"");
    } else content+=paragraph(node.textContent,{H1:"Title",H2:"Heading1",H3:"Heading2"}[node.tagName]);
  }
  const wns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const styles=[["Title",36,0],["Heading1",28,0],["Heading2",24,1],["Heading3",22,2],["Small",16,null]];
  const styleXml=declaration+'<w:styles xmlns:w="'+wns+'">'+styles.map(([id,size,level])=>'<w:style w:type="paragraph" w:styleId="'+id+'"><w:name w:val="'+id+'"/>'+
    (level===null?"":'<w:pPr><w:keepNext/><w:outlineLvl w:val="'+level+'"/></w:pPr>')+
    '<w:rPr>'+(level===null?"":'<w:b/><w:color w:val="00646B"/>')+'<w:sz w:val="'+size+'"/></w:rPr></w:style>').join("")+'</w:styles>';
  const documentXml=declaration+'<w:document xmlns:w="'+wns+'"><w:body>'+content+
    '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="760" w:right="670" w:bottom="760" w:left="670" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>';
  return packageOffice({"word/document.xml":documentXml,"word/styles.xml":styleXml,
    "word/_rels/document.xml.rels":declaration+'<Relationships xmlns="'+relns+'"><Relationship Id="rId1" Type="'+offns+'/styles" Target="styles.xml"/></Relationships>'},
    "word/document.xml",{"word/document.xml":"wordprocessingml.document.main+xml","word/styles.xml":"wordprocessingml.styles+xml"},"wordprocessingml.document");
}

export async function zipDocuments(files){
  const contents=await Promise.all(Object.entries(files).map(async ([name,value])=>
    [name, value instanceof Blob ? new Uint8Array(await value.arrayBuffer()) : value]));
  return zip(Object.fromEntries(contents),"application/zip");
}

export function excelGantt(activities,plans){
  return excelBook([["Carta Gantt 2027",ganttRows(activities,plans),true]]);
}

function ganttRows(activities,plans){
  const cols=["Centro","Plan","Actividad","Responsable","Estado","Inicio previsto","Cierre previsto","Inicio real","Cierre real",
    "Recursos","Evidencia prevista","Evidencia de ejecución","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const valid=recordsOf(activities).filter(row=>row.actividad&&schedule(row));
  return [cols,...activityRows(activities,plans).map((cells,index)=>{
    const row=valid[index];
    const current=row&&operationalSchedule(row);
    return current?[...cells.slice(0,12),...Array.from({length:12},(_,month)=>
      current.start<=month+1&&current.end>=month+1?1:"")]:cells;
  })];
}

function sheetXml(rows,gantt,numberColumns=[]){
  const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const data=rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>{
    const ref=letters[j]+(i+1);
    if(i>0 && numberColumns.includes(j) && typeof value==="number") return '<c r="'+ref+'"><v>'+value+'</v></c>';
    if(gantt && value===1 && j>=12) return '<c r="'+ref+'" s="2"><v>1</v></c>';
    return '<c r="'+ref+'" s="'+(i===0?1:0)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
  }).join("")+"</row>").join("");
  const end=letters[rows[0].length-1];
  return declaration+'<worksheet xmlns="'+ns+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
    (gantt?'<cols><col min="1" max="12" width="23" customWidth="1"/><col min="13" max="24" width="6" customWidth="1"/></cols>':
      '<cols><col min="1" max="'+rows[0].length+'" width="27" customWidth="1"/></cols>')+
    '<sheetData>'+data+'</sheetData><autoFilter ref="A1:'+end+rows.length+'"/></worksheet>';
}

function excelBook(sheets){
  const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const styles=declaration+'<styleSheet xmlns="'+ns+'"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF006D76"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFBDE9DD"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const work=declaration+'<workbook xmlns="'+ns+'" xmlns:r="'+offns+'"><sheets>'+
    sheets.map(([name],i)=>'<sheet name="'+xml(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join("")+'</sheets></workbook>';
  const rel=declaration+'<Relationships xmlns="'+relns+'">'+
    sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+offns+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join("")+
    '<Relationship Id="rId'+(sheets.length+1)+'" Type="'+offns+'/styles" Target="styles.xml"/></Relationships>';
  const types={"xl/workbook.xml":"spreadsheetml.sheet.main+xml","xl/styles.xml":"spreadsheetml.styles+xml"};
  const files={"xl/workbook.xml":work,"xl/styles.xml":styles,"xl/_rels/workbook.xml.rels":rel};
  sheets.forEach(([,rows,gantt,numberColumns],i)=>{
    const path="xl/worksheets/sheet"+(i+1)+".xml";
    types[path]="spreadsheetml.worksheet+xml";
    files[path]=sheetXml(rows,gantt,numberColumns);
  });
  return packageOffice(files,"xl/workbook.xml",types,"spreadsheetml.sheet");
}

export function workbookForPSST({inputs={},draft={}}){
  const one=inputs.m1?.data??{}, two=inputs.m2?.data?.m2??{}, three=inputs.m3?.data?.m3??{}, four=draft.m4??{};
  const plans=recordsOf(three.planesDetallados);
  const tasks=recordsOf(one.tarea?.actividades);
  const name=(records,id)=>records.find(row=>row.id===id)?.codigo??"";
  const budget=annualInvestment(recordsOf(three.partidas),plans,recordsOf(three.filas));
  const training=annualTraining(recordsOf(three.filas),plans,three.gruposFormacion,two.gruposExpuestos);
  return excelBook([
    ["Carta Gantt 2027",ganttRows(three.filas,plans),true],
    ["Matriz de riesgos",[["Código","Tarea","Condición","Daño posible","Situación de trabajo","Puestos y personas expuestas","Controles existentes","Valoración","Prioridad","Evidencia","Dato pendiente","Estado","Responsable","Fecha prevista","Control propuesto","Justificación","Criterio de eficacia"],
      ...recordsOf(two.filas).map(row=>[row.codigo,name(tasks,row.tareaRef),row.peligro,row.riesgo,row.situacion,exposureSummary(row,two),row.controles,row.valoracion,
        row.prioridad,row.evidencia,row.pendiente,row.estadoEvaluacion,row.responsableEvaluacion,row.fechaEvaluacion,row.controlPropuesto,row.justificacionControl,row.criterioEficacia])]],
    ["Exposición por puesto",[["Hallazgo","Tarea","Puesto","Área o zona","Turno","Tipo de personal","Personas expuestas","Frecuencia","Duración","Fuente"],
      ...exposureRows(two,tasks).map(row=>[row.hallazgo,row.tarea,row.puesto,row.area,row.turno,row.grupo,row.cantidadVisible,row.frecuencia,row.duracion,row.fuente])],false,[6]],
    ["Seguimiento",[["Plan","Actividad","Responsable","Estado","Inicio previsto","Cierre previsto","Inicio real","Cierre real","Nuevo inicio","Nuevo cierre","Motivo",
      "Evidencia esperada","Evidencia de ejecución","Criterio de eficacia","Resultado de eficacia","Fecha de verificación","Nota de eficacia"],
      ...recordsOf(three.filas).filter(row=>row.actividad).map(row=>[name(plans,row.planRef)||row.plan,row.actividad,row.responsable,row.estado||"Pendiente",
        row.fechaInicio||row.inicio,row.fechaFin||row.fin,row.inicioReal,row.cierreReal,row.nuevoInicio,row.nuevoFin,row.motivoReprogramacion,
        row.evidenciaEsperada,row.evidenciaReal,row.eficacia,row.resultadoEficacia,row.verificacionEficacia,row.notaEficacia])]],
    ["Capacitación 2027",[["Grupo","T1","T2","T3","T4","Año","Pendientes"],...training.map(r=>[r.group,...r.quarters,r.total,r.gaps.join(", ")])],false,[1,2,3,4,5]],
    ["Inversión anual",[["Alcance","Moneda","T1","T2","T3","T4","Sin mes","Total conocido","Por estimar"],...budget.summary.map(s=>[s.scope,s.currency,...s.quarters,s.undated,s.total,s.pending])],false,[2,3,4,5,6,7,8]],
    ["Presupuesto",[["Plan","Recurso","Cantidad","Unidad","Costo unitario","Importe","Moneda","Fuente","Responsable","Actividad","Mes"],
      ...budget.rows.map(row=>[row.plan,row.concepto,row.cantidad,row.unidad,row.unitario,row.total,row.moneda,row.fuente,row.responsable,row.actividad,row.mes])],false,[2,4,5]],
    ["Anexos",[["Código","Soporte","Capítulo o referencia","Versión","Ubicación","Estado","Custodio","Responsable","Revisión de acceso"],
      ...recordsOf(four.soportes).map(row=>[row.codigo,row.nombre,row.capitulo,row.version,row.ubicacion,row.estado,row.custodio,row.responsable,row.revisionAcceso])]],
    ["Pendientes",[["Registro","Pendiente","Acción","Responsable","Plazo"],
      ...recordsOf(four.filas).map(row=>[row.capitulo,row.brecha,row.accion,row.responsable,row.plazo]),
      ...technicalChecks({one,two,three,four}).map(row=>[row.target,row.message,row.action,"",""])]],
  ]);
}

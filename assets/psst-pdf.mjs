const encoder=new TextEncoder();
const replacements={"→":" > ","↳":"  ","●":"X","✓":"OK","…":"…","−":"-","≤":"<=","≥":">="};
const extended="€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const codes=[128,130,131,132,133,134,135,136,137,138,139,140,142,145,146,147,148,149,150,151,152,153,154,155,156,158,159];

function hexText(text){
  return [...text.normalize("NFC")].map(character=>{
    const code=character.charCodeAt(0), index=extended.indexOf(character);
    if(index!==-1) return codes[index].toString(16).padStart(2,"0");
    if(code>=32&&code<=255) return code.toString(16).padStart(2,"0");
    return "3f";
  }).join("");
}

function wrapText(text,width){
  const cleaned=String(text??"").replace(/[→↳●✓…−≤≥]/g,char=>replacements[char]);
  return cleaned.split(/\r?\n/).flatMap(paragraph=>{
    const words=paragraph.trim().split(/\s+/).flatMap(word=>word.length>width?word.match(new RegExp(".{1,"+width+"}","g")):[word]);
    const lines=[];
    let line="";
    for(const word of words){
      if(line&&line.length+word.length+1>width){lines.push(line);line=word;}
      else line+=(line?" ":"")+word;
    }
    lines.push(line);
    return lines;
  });
}

function reportBlocks(doc){
  const blocks=[];
  for(const node of doc.body.querySelectorAll("h1,h2,h3,p,li,table")){
    if(node.parentElement?.closest("table")) continue;
    if(node.tagName==="TABLE"){
      const rows = [...node.rows].map(row => [...row.cells].map(cell => cell.textContent.trim()));
      if (rows.length > 1) blocks.push({type:"table",rows});
    } else if(node.textContent.trim()) {
      blocks.push({type:node.tagName.toLowerCase(),text:node.textContent.trim()});
    }
  }
  return blocks;
}

export function pdfFromReport(html,parse=source=>new DOMParser().parseFromString(source,"text/html")){
  const doc=parse(html), pages=[];
  const left=36, width=770, top=550, bottom=42;
  let commands=[], y=top;
  function nextPage(){
    if (commands.length) pages.push(commands);
    commands=[]; y=top;
  }
  function textAt(text,x,baseline,size,bold=false){
    commands.push(`BT /${bold?"F2":"F1"} ${size} Tf 0.06 0.18 0.25 rg ${x} ${baseline} Td <${hexText(text)}> Tj ET`);
  }
  function rect(x,baseline,w,h,color){
    commands.push(`${color} rg ${x} ${baseline} ${w} ${h} re f`);
  }
  function drawTable([header,...body]){
    const calendar=header.slice(-12).join(",")==="Ene,Feb,Mar,Abr,May,Jun,Jul,Ago,Sep,Oct,Nov,Dic";
    const weights=calendar ? (header.length===19?[54,105,80,64,64,54,60]:[180,112,72]).concat(Array(12).fill(23))
      : header.length===2 ? [1,3] : header.map(key=>/^(ID|Código|Plan|Tarea)$/.test(key)?0.58:1);
    const total=weights.reduce((sum,v)=>sum+v,0);
    const widths=weights.map(v=>width*v/total);
    const size=header.length>9?8:9, lead=size+3;
    const layout=row=>header.map((_,i)=>calendar && i>=header.length-12 && row[i]?.length<=3
      ? [row[i]] : wrapText(row[i],Math.floor((widths[i]-8)/(size*.62))));
    const head=layout(header);
    const headHeight=Math.max(...head.map(cell=>cell.length))*lead+8;
    function draw(cells,lines,isHeader,shade){
      const height=lines*lead+8;
      let x=left;
      cells.forEach((cell,i)=>{
        rect(x,y-height,widths[i]-.5,height-.5,isHeader?"0.80 0.91 0.91":shade?"0.92 0.96 0.97":"0.97 0.98 0.99");
        cell.forEach((line,j)=>{
          if(line==="●") rect(x+3,y-height/2-3,widths[i]-6,6,"0.00 0.40 0.43");
          else textAt(line,x+4,y-5-size-j*lead,size,isHeader);
        });
        x+=widths[i];
      });
      y-=height;
    }
    if(y < bottom+headHeight+48) nextPage();
    draw(head,(headHeight-8)/lead,true,false);
    body.forEach((row,index)=>{
      const cells=layout(row);
      const count=Math.max(...cells.map(cell=>cell.length));
      if (y-bottom < Math.min(count*lead+8,top-bottom-headHeight)) {
        nextPage(); draw(head,(headHeight-8)/lead,true,false);
      }
      for(let start=0;start<count;){
        let capacity=Math.floor((y-bottom-8)/lead);
        if(capacity<1){nextPage();draw(head,(headHeight-8)/lead,true,false);capacity=Math.floor((y-bottom-8)/lead);}
        const length=Math.min(capacity,count-start);
        draw(cells.map(cell=>cell.slice(start,start+length)),length,false,index%2===0);
        start+=length;
      }
    });
    y-=12;
  }
  for(const block of reportBlocks(doc)){
    if(block.type==="table"){drawTable(block.rows);continue;}
    const {type,text}=block;
    const heading=/^h[1-3]$/.test(type), size=type==="h1"?24:type==="h2"?17:type==="h3"?12:11;
    const leading=size+5;
    const lines=wrapText(text,Math.floor(width/(size*.62)));
    if(type==="h2" && /^(Índice|Carta Gantt 2027)$/.test(text)) nextPage();
    if(heading&&y<bottom+75+leading*lines.length) nextPage();
    if(heading) y-=8;
    for(const line of lines){
      if(y<bottom) nextPage();
      if(line) textAt(line,left,y,size,heading);
      y-=leading;
    }
    y-=heading?8:5;
  }
  if(commands.length||!pages.length) nextPage();
  const objects=[];
  function add(data){return objects.push(data);}
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const ids=[];
  for(const [index,page] of pages.entries()){
    const footer="BT /F1 8 Tf 0.20 0.36 0.39 rg 45 27 Td <"+hexText("Academia Movida de SST  |  "+(index+1)+" / "+pages.length)+"> Tj ET";
    const stream=page.concat(footer).join("\n");
    const content=add("<< /Length "+encoder.encode(stream).length+" >>\nstream\n"+stream+"\nendstream");
    ids.push(add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+content+" 0 R >>"));
  }
  objects[1]="<< /Type /Pages /Kids ["+ids.map(id=>id+" 0 R").join(" ")+"] /Count "+ids.length+" >>";
  const chunks=["%PDF-1.4\n"], offsets=[];
  let length=chunks[0].length;
  for(const [index,object] of objects.entries()){
    offsets.push(length);
    const data=(index+1)+" 0 obj\n"+object+"\nendobj\n";
    chunks.push(data);length+=encoder.encode(data).length;
  }
  chunks.push("xref\n0 "+(offsets.length+1)+"\n0000000000 65535 f \n"+
    offsets.map(offset=>String(offset).padStart(10,"0")+" 00000 n \n").join("")+
    "trailer\n<< /Size "+(offsets.length+1)+" /Root 1 0 R >>\nstartxref\n"+length+"\n%%EOF\n");
  return new Blob(chunks,{type:"application/pdf"});
}

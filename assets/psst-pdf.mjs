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
      const [head,...rows]=[...node.rows];
      if(!head) continue;
      const keys=[...head.cells].map(cell=>cell.textContent.trim());
      for(const row of rows){
        const values=[...row.cells].flatMap((cell,i)=>{
          const value=cell.textContent.trim();
          return value?[keys[i]+": "+value]:[];
        });
        if(values.length) blocks.push({type:"table",text:values.join(" | ")});
      }
    } else if(node.textContent.trim()) {
      blocks.push({type:node.tagName.toLowerCase(),text:node.textContent.trim()});
    }
  }
  return blocks;
}

export function pdfFromReport(html,parse=source=>new DOMParser().parseFromString(source,"text/html")){
  const doc=parse(html), pages=[];
  let commands=[],y=798;
  function nextPage(){
    pages.push(commands);commands=[];y=798;
  }
  for(const {type,text} of reportBlocks(doc)){
    const heading=/^h[1-3]$/.test(type), size=type==="h1"?17:type==="h2"?13:type==="h3"?11:9.5;
    const leading=size+5;
    const lines=wrapText(text,Math.floor(505/(size*.65)));
    if(heading&&y<88+leading*Math.min(lines.length,4)) nextPage();
    if(heading) y-=6;
    for(const line of lines){
      if(y<50) nextPage();
      if(line) commands.push("BT /"+(heading?"F2":"F1")+" "+size+" Tf "+
        (heading?"0.03 0.32 0.35":"0.10 0.17 0.22")+" rg 45 "+y+" Td <"+hexText(line)+"> Tj ET");
      y-=leading;
    }
    y-=type==="table"?4:6;
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
    ids.push(add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+content+" 0 R >>"));
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

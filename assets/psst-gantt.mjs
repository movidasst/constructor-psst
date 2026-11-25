import Gantt from "./vendor/frappe-gantt/frappe-gantt.es.js";
import { operationalSchedule } from "./psst-builder.mjs?v=organigrama-1";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const states = {"Pendiente":"pending", "En curso":"active", "Ejecutada":"done", "Reprogramada":"revised"};
const observers = new WeakMap();

export function renderTimeline(container, rows, {mode="Month", open=()=>{}}={}) {
  observers.get(container)?.disconnect();
  container.replaceChildren();
  if (!rows.length) return;
  // Synthetic IDs keep selectors independent of user-entered data.
  const records = new Map();
  const tasks = rows.map((row,index) => {
    const timing = operationalSchedule(row);
    const day = (value,end=false) => value.length===7
      ? value + (end ? "-"+new Date(Number(value.slice(0,4)),Number(value.slice(5,7)),0).getDate() : "-01") : value;
    const id="activity-"+index;
    records.set(id,row);
    return {id, name:escape(row.actividad), start:day(timing.from), end:day(timing.to,true),
      progress:row.estado==="Ejecutada"?100:0, custom_class:states[row.estado]??"pending"};
  });
  let rendered=false;
  function draw() {
    if(rendered || !container.getBoundingClientRect().width) return;
    rendered=true;
    try {
      new Gantt(container,tasks,{language:"es",view_mode:mode,readonly:true,
        container_height:Math.min(500,100+rows.length*45), infinite_padding:false,
        scroll_to:"start", holidays:{}, popup:()=>false, today_button:false,
        on_click:task=>open(records.get(task.id).id)});
      container.querySelectorAll(".bar-wrapper").forEach((bar,index)=>{
        bar.setAttribute("tabindex","0"); bar.setAttribute("role","button");
        bar.setAttribute("aria-label",rows[index].actividad+" · "+(rows[index].estado||"Pendiente")+" · Abrir ficha");
        bar.addEventListener("keydown",event=>{
          if(event.key==="Enter"||event.key===" "){event.preventDefault();open(rows[index].id);}
        });
      });
    } catch {
      container.textContent="Consulta y edita el cronograma en la tabla de actividades.";
    }
  }
  const observer=new ResizeObserver(draw);
  observers.set(container,observer); observer.observe(container); draw();
}

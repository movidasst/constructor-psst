import { makeProof } from "./lti-proof.mjs?v=bound-1";

const endpoint="https://edeydaueyxilutczhazm.supabase.co/functions/v1/psst-lti/continue";
const status=document.getElementById("access-status");
const source=new URLSearchParams(location.hash.slice(1));
history.replaceState(null,"",location.pathname+location.search);

async function start(){
  if(source.get("iss")!=="https://movidasst.org"||!source.get("login_hint"))
    throw new Error("Abre el Constructor desde la actividad de Moodle.");
  const challenge=await makeProof(sessionStorage);
  const form=document.createElement("form");
  form.method="post";
  form.action=endpoint;
  form.hidden=true;
  source.set("psst_challenge",challenge);
  for(const key of ["iss","client_id","target_link_uri","lti_deployment_id","login_hint","lti_message_hint","psst_challenge"]){
    const value=source.get(key);
    if(!value) continue;
    const field=document.createElement("input");
    field.type="hidden";
    field.name=key;
    field.value=value;
    form.append(field);
  }
  document.body.append(form);
  form.submit();
}

start().catch(()=>{
  status.textContent="Abre la actividad desde Moodle y permite el almacenamiento de esta pestaña para completar el acceso.";
});

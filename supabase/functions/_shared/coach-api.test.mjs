import {test} from "node:test";
import assert from "node:assert/strict";
import {createCoachingService} from "./coach-api.mjs";

test("sends only the confirmed anonymous text after checking the learner quota",async()=>{
  let quota=0;
  const text="Se comparten rutas de traslado y circulación peatonal durante el despacho.";
  const coach=createCoachingService({key:"mock-key",model:"gemini-mock",rpc:async (name,params)=>{
    assert.equal(name,"psst_lti_coach_quota");
    assert.deepEqual(params,{p_hash:"mock-hash"});
    return ++quota===1;
  },request:async(url,init)=>{
    assert.match(url,/^https:\/\/generativelanguage.googleapis.com\//);
    const body=JSON.parse(init.body);
    assert.equal(body.contents[0].parts[0].text,text);
    assert.doesNotMatch(init.body,/mock-hash/);
    return Response.json({candidates:[{content:{parts:[{text:"¿Qué situaciones coinciden en el recorrido?"}]}}]});
  }});
  assert.equal((await coach({p_hash:"mock-hash",mode:"campo",text:"Consulta privada a persona@example.com"})).status,422);
  assert.equal((await coach({p_hash:"mock-hash",mode:"campo",text})).suggestion,"¿Qué situaciones coinciden en el recorrido?");
  assert.equal((await coach({p_hash:"mock-hash",mode:"campo",text})).status,429);
});

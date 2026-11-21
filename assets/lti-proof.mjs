const pattern=/^[a-f0-9]{64}$/;
const prefix="psst:login-proof:";
const maxAge=10*60*1000;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");

export async function makeProof(storage,now=Date.now()){
  for(let i=storage.length-1;i>=0;i--){
    const key=storage.key(i);
    if(key?.startsWith(prefix) && !readRecord(storage,key,now)) storage.removeItem(key);
  }
  const proof=hex(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(proof))));
  storage.setItem(prefix+challenge,JSON.stringify({proof,at:now}));
  return challenge;
}

function readRecord(storage,key,now){
  const item=JSON.parse(storage.getItem(key)??"null");
  return item && pattern.test(item.proof) && Number.isFinite(item.at) && now-item.at<=maxAge ? item : null;
}

export function readProof(binding,storage,now=Date.now()){
  try { return pattern.test(binding??"") ? readRecord(storage??sessionStorage,prefix+binding,now)?.proof : undefined; }
  catch { return undefined; }
}

export function clearProof(binding){
  if(pattern.test(binding??"")) try{ sessionStorage.removeItem(prefix+binding); }catch{}
}

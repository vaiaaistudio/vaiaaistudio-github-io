const BASE_URL = 'https://gen.pollinations.ai';
function clampNumber(value,min,max,fallback){const n=Number(value);if(!Number.isFinite(n))return fallback;return Math.max(min,Math.min(max,Math.round(n)));}
function jsonError(res,status,message,detail=''){return res.status(status).json({error:detail?`${message} ${detail}`:message});}
async function pollinationsGet({prompt,model,width,height,seed,safe,apiKey}){
  const params = new URLSearchParams({model,width:String(width),height:String(height),seed:String(seed)});
  if(safe) params.set('safe','privacy,secrets');
  return fetch(`${BASE_URL}/image/${encodeURIComponent(prompt)}?${params}`,{
    method:'GET',cache:'no-store',headers:{Authorization:`Bearer ${apiKey}`,Accept:'image/png,image/jpeg,image/webp,*/*'}
  });
}
async function pollinationsOpenAI({prompt,model,width,height,seed,safe,quality,apiKey}){
  return fetch(`${BASE_URL}/v1/images/generations`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
    body:JSON.stringify({prompt,model,n:1,size:`${width}x${height}`,quality:quality==='hd'?'hd':'standard',response_format:'b64_json',seed,safe:safe?'privacy,secrets':false,user:'vaia-ai-studio'})
  });
}
export default async function handler(req,res){
  if(req.method !== 'POST'){
    res.setHeader('Allow','POST');
    return jsonError(res,405,'Method not allowed. Use POST.');
  }
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if(!apiKey) return jsonError(res,500,'POLLINATIONS_API_KEY belum diatur di Environment Variables server.');
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = String(body.prompt || '').trim();
    const model = String(body.model || 'flux').trim();
    const width = clampNumber(body.width,256,2048,1024);
    const height = clampNumber(body.height,256,2048,1024);
    const seed = clampNumber(body.seed,-1,2147483647,-1);
    const safe = Boolean(body.safe);
    const quality = String(body.quality || 'standard');
    if(!prompt) return jsonError(res,400,'Prompt kosong.');
    if(prompt.length > 12000) return jsonError(res,400,'Prompt terlalu panjang. Maksimal 12000 karakter.');

    let upstream = await pollinationsGet({prompt,model,width,height,seed,safe,apiKey});
    let ct = upstream.headers.get('content-type') || '';
    if(upstream.ok && ct.startsWith('image/')){
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type',ct);
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');
      return res.status(200).send(buffer);
    }

    const getError = await upstream.text().catch(()=>'');
    upstream = await pollinationsOpenAI({prompt,model,width,height,seed,safe,quality,apiKey});
    if(!upstream.ok){
      const text = await upstream.text().catch(()=>'');
      return jsonError(res,upstream.status,`Pollinations error ${upstream.status}:`,text.slice(0,700)||getError.slice(0,500));
    }
    const data = await upstream.json();
    const item = data?.data?.[0] || {};
    const b64 = item.b64_json || item.b64 || data.b64_json || '';
    const imageUrl = item.url || data.url || '';
    if(b64){
      const clean = String(b64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/,'');
      const buffer = Buffer.from(clean,'base64');
      res.setHeader('Content-Type','image/png');
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');
      return res.status(200).send(buffer);
    }
    if(imageUrl){
      const imgRes = await fetch(imageUrl,{cache:'no-store'});
      if(!imgRes.ok) return jsonError(res,502,'URL gambar dari Pollinations tidak bisa diambil.');
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.setHeader('Content-Type',imgRes.headers.get('content-type') || 'image/png');
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');
      return res.status(200).send(buffer);
    }
    return jsonError(res,502,'Pollinations tidak mengembalikan data gambar.');
  }catch(err){
    return jsonError(res,500,err?.message || 'Server error.');
  }
}

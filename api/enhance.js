const BASE_URL = 'https://gen.pollinations.ai';
function jsonError(res,status,message){return res.status(status).json({error:message});}
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
    const styleLabel = String(body.styleLabel || 'Default').trim();
    const styleSuffix = String(body.styleSuffix || '').trim();
    if(!prompt) return jsonError(res,400,'Prompt kosong.');
    const upstream = await fetch(`${BASE_URL}/v1/chat/completions`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({model:'openai-fast',messages:[{role:'system',content:'You are an expert image prompt engineer. Return only one polished English image prompt. Keep the original subject intact. Do not explain.'},{role:'user',content:`Enhance this image prompt for text-to-image generation. Add visual detail, lighting, composition, camera, quality tags, and this style direction: ${styleLabel}. Style notes: ${styleSuffix}. Prompt: ${prompt}`}],temperature:.72})
    });
    if(!upstream.ok){const text=await upstream.text().catch(()=>'');return jsonError(res,upstream.status,`Pollinations enhance error ${upstream.status}: ${text.slice(0,700)}`);}
    const data = await upstream.json();
    const enhanced = data?.choices?.[0]?.message?.content ? String(data.choices[0].message.content).trim() : '';
    if(!enhanced) return jsonError(res,502,'Response enhance kosong.');
    return res.status(200).json({prompt:enhanced});
  }catch(err){return jsonError(res,500,err?.message || 'Server error.');}
}

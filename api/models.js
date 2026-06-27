const BASE_URL = 'https://gen.pollinations.ai';
const fallbackModels=[{id:'flux',label:'FLUX Schnell / Flux Image',note:'fallback'},{id:'kontext',label:'FLUX.1 Kontext',note:'fallback'},{id:'klein',label:'FLUX.2 Klein 4B / Klein',note:'fallback'},{id:'zimage',label:'Z-Image',note:'fallback'},{id:'gptimage',label:'GPT Image',note:'fallback'},{id:'gptimage-large',label:'GPT Image Large',note:'fallback'},{id:'seedream5',label:'Seedream 5',note:'fallback'},{id:'qwen-image',label:'Qwen Image',note:'fallback'},{id:'wan-image',label:'WAN Image',note:'fallback'}];
export default async function handler(req,res){
  if(req.method !== 'GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed. Use GET.'});
  }
  try{
    const headers={Accept:'application/json'};
    if(process.env.POLLINATIONS_API_KEY) headers.Authorization=`Bearer ${process.env.POLLINATIONS_API_KEY}`;
    const upstream = await fetch(`${BASE_URL}/image/models`,{method:'GET',headers,cache:'no-store'});
    if(!upstream.ok) return res.status(200).json({models:fallbackModels,source:'fallback'});
    const data = await upstream.json();
    const arr = Array.isArray(data) ? data : (data.models || data.data || []);
    const models = arr.map(item=>{
      if(typeof item === 'string') return {id:item,label:item,note:'available'};
      const id = item.id || item.name || item.model || item.slug;
      const label = item.label || item.displayName || item.name || id;
      const cost = item.pricing?.cost ? `cost ${item.pricing.cost}` : '';
      return id ? {id,label,note:cost || 'available'} : null;
    }).filter(Boolean);
    return res.status(200).json({models:models.length?models:fallbackModels,source:models.length?'pollinations':'fallback'});
  }catch(err){return res.status(200).json({models:fallbackModels,source:'fallback'});}
}

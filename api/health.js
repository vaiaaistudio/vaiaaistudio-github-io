export default async function handler(req, res){
  if(req.method !== 'GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed. Use GET.'});
  }
  const ready = Boolean(process.env.POLLINATIONS_API_KEY);
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({
    ok:true,
    ready,
    runtime:'vercel-node',
    message: ready
      ? 'Backend proxy siap. Secret key tersedia di server dan tidak diekspos ke frontend.'
      : 'Backend proxy aktif, tetapi POLLINATIONS_API_KEY belum diatur.'
  });
}

// Cookies sin dependencias adicionales.
export function parseCookies(req,_res,next) {
  req.cookies={};
  for(const part of (req.headers.cookie||'').split(';')){
    const eq=part.indexOf('=');if(eq<0)continue;
    const k=part.slice(0,eq).trim();
    try{req.cookies[k]=decodeURIComponent(part.slice(eq+1).trim());}catch{ /* cookie inválida */ }
  }
  next();
}
export function rejectCrossOriginWrites(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const origin=req.get('origin');
 if(!origin || origin!==process.env.FRONTEND_ORIGIN)
  return res.status(403).json({error:'Origen de solicitud no autorizado'});
 next();
}

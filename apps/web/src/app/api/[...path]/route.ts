import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
const ALLOWED = /^(health|auth\/(register|verify|login|logout|refresh|resend|recover|password)|appointments|me|onboarding|accounts|transactions(?:\/[a-f0-9-]+(?:\/category)?)?|dashboard|budgets|goals(?:\/[a-f0-9-]+\/contributions)?|export|data|integrations|admin\/(overview|trials\/extend|trial-duration|appointments\/[a-f0-9-]+))$/;

async function proxy(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const {path} = await context.params;
  const route = path.join('/');
  if (!ALLOWED.test(route)) return Response.json({detail:'Ruta no disponible.'}, {status:404});
  const isAdmin = process.env.PORTAL_MODE === 'admin';
  if (route.startsWith('admin/') && !isAdmin) return Response.json({detail:'Ruta no disponible.'}, {status:404});
  // Check actual browser origin before proxying. Never trust forwarded host headers.
  if (!['GET','HEAD'].includes(request.method)) {
    const allowedOrigin = process.env.PUBLIC_ORIGIN || (isAdmin ? 'http://localhost:3001' : 'http://localhost:3000');
    if (request.headers.get('origin') !== allowedOrigin) return Response.json({detail:'Origen no autorizado.'}, {status:403});
    if (Number(request.headers.get('content-length') || 0) > 32768) return Response.json({detail:'Solicitud demasiado grande.'}, {status:413});
  }
  try {
    const body = ['GET','HEAD'].includes(request.method) ? undefined : await request.text();
    if (body && body.length > 32768) return Response.json({detail:'Solicitud demasiado grande.'}, {status:413});
    const upstream = await fetch(`${process.env.API_URL || 'http://127.0.0.1:8000'}/${route}${request.nextUrl.search}`, {
      method:request.method, body, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(25000),
      headers:{'Content-Type':'application/json', cookie:request.headers.get('cookie') || '',
               origin:request.headers.get('origin') || ''},
    });
    const headers = new Headers({'Content-Type':upstream.headers.get('content-type') || 'application/json','Cache-Control':'no-store'});
    for (const cookie of upstream.headers.getSetCookie()) headers.append('Set-Cookie',cookie);
    if (upstream.headers.has('content-disposition')) headers.set('Content-Disposition',upstream.headers.get('content-disposition')!);
    return new Response(await upstream.arrayBuffer(),{status:upstream.status,headers});
  } catch {
    return Response.json({detail:'El servicio no está disponible. Comprueba que la API esté iniciada.'},{status:503});
  }
}
export {proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE};

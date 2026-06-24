import { NextRequest, NextResponse } from 'next/server';

// Protezione minimale della dashboard con una password unica (no login vero —
// uso personale). Se DASHBOARD_PASSWORD non è impostata, non blocca nulla.
// Il cron usa CRON_SECRET separato e NON passa di qui (escluso dal matcher).
const COOKIE = 'lg_auth';

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const url = new URL(req.url);

  // Login via query (?pw=...) → setta cookie e ripulisce l'URL.
  const pw = url.searchParams.get('pw');
  if (pw) {
    if (pw === password) {
      url.searchParams.delete('pw');
      const res = NextResponse.redirect(url);
      res.cookies.set(COOKIE, password, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
    return new NextResponse('Password errata', { status: 401 });
  }

  if (req.cookies.get(COOKIE)?.value === password) return NextResponse.next();

  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Majloasis</title>
     <style>body{background:#000;color:#fff;font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
     form{display:flex;flex-direction:column;gap:12px;width:280px}
     input{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);color:#fff}
     button{padding:12px;border-radius:999px;border:none;background:#fff;color:#000;font-weight:600;cursor:pointer}</style></head>
     <body><form method="GET"><h2 style="font-family:Sora,system-ui">Majloasis 🌴</h2>
     <input name="pw" type="password" placeholder="Password" autofocus/>
     <button>Entra</button></form></body></html>`,
    { status: 401, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export const config = {
  // Protegge le pagine; esclude /api (cron/collect hanno le loro chiavi),
  // gli asset statici e i font.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

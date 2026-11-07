import { NextResponse, type NextRequest } from 'next/server';
import { decideAccess } from './lib/auth';

// Runs before every page request, so a rejected request never reaches the
// page and never touches the database.
export function proxy(request: NextRequest) {
  const decision = decideAccess({
    password: process.env.DASHBOARD_PASSWORD,
    onVercel: Boolean(process.env.VERCEL),
    authorization: request.headers.get('authorization'),
  });

  if (decision === 'allow') return NextResponse.next();

  if (decision === 'misconfigured') {
    return new NextResponse('DASHBOARD_PASSWORD is not set for this deployment.', { status: 503 });
  }

  return new NextResponse('Password required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Best-Of Dashboard", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except static build assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

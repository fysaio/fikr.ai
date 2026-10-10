import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh user session if present
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  
  // Define public routes (landing page, welcome, login, signup, you, forgot, reset, auth endpoints)
  const isPublicRoute =
    url.pathname === '/' ||
    url.pathname === '/welcome' ||
    url.pathname === '/login' ||
    url.pathname === '/signup' ||
    url.pathname === '/you' ||
    url.pathname === '/forgot' ||
    url.pathname === '/reset' ||
    url.pathname === '/screens' ||
    url.pathname === '/offline' ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/api/');

  if (!user && !isPublicRoute) {
    url.pathname = '/welcome';
    return NextResponse.redirect(url);
  }

  // If user is logged in and trying to access /login or /signup, delegate to root check
  if (user && (url.pathname === '/login' || url.pathname === '/signup')) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

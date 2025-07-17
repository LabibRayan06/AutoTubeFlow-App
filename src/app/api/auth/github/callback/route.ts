import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession, IronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session: IronSession<SessionData> = await getIronSession(cookies(), sessionOptions);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const originalUrl = session.redirectUrl || '/';
  
  // Clear the redirectUrl from the session
  session.redirectUrl = undefined;

  if (!code) {
    const error = searchParams.get('error') || 'Unknown error';
    await session.save();
    return NextResponse.redirect(`${originalUrl}?github_auth_error=${encodeURIComponent(error)}`);
  }

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      await session.save();
      return NextResponse.redirect(`${originalUrl}?github_auth_error=${encodeURIComponent('GitHub credentials not configured on server.')}`);
  }

  try {
    // Exchange the code for an access token
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(data.error_description || 'Failed to get access token from GitHub.');
    }

    // Store token in session
    session.github_token = data.access_token;
    await session.save();

    // Redirect back to the original page with success indicator
    return NextResponse.redirect(`${originalUrl}?github_auth_success=true`);
  } catch (error: any) {
    await session.save();
    const errorMessage = error.message || 'Failed to authenticate with GitHub.';
    return NextResponse.redirect(`${originalUrl}?github_auth_error=${encodeURIComponent(errorMessage)}`);
  }
}

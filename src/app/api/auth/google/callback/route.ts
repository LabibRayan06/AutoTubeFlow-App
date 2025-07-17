import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';
import { IronSession, getIronSession } from 'iron-session';
import { SessionData, sessionOptions } from '@/lib/session';

async function getGoogleOAuth2Client() {
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

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
    return NextResponse.redirect(`${originalUrl}?google_auth_error=${encodeURIComponent(error)}`);
  }

  try {
    const oauth2Client = await getGoogleOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens in session
    session.google_tokens = tokens;
    await session.save();

    // Redirect back to the original page with success indicator
    return NextResponse.redirect(`${originalUrl}?google_auth_success=true`);
  } catch (error: any) {
    await session.save();
    const errorMessage = error.message || 'Failed to authenticate with Google.';
    return NextResponse.redirect(`${originalUrl}?google_auth_error=${encodeURIComponent(errorMessage)}`);
  }
}

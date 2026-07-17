export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/**
 * HTTPS yokken (COOKIE_SECURE=false) `Secure` bayrağı tarayıcının cookie'yi
 * hiç saklamamasına yol açar. Varsayılan NODE_ENV=production davranışını
 * korur; sadece TLS henüz kurulmamış ortamlarda COOKIE_SECURE=false ile
 * bilinçli olarak geçici gevşetilebilir.
 */
function isSecureCookie() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

export function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 15 * 60,
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };
}

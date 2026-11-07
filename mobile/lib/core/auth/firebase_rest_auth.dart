import 'package:dio/dio.dart';

import '../config.dart';

/// Firebase Auth over its public REST endpoints (Identity Toolkit and Secure
/// Token), used instead of the native plugin so the app needs no
/// `google-services.json` and no change to the Android build.
///
/// It does exactly what the website's `firebase/auth` calls do for this app:
/// email + password sign-in, ID-token refresh, confirming a password reset and
/// applying an email-verification link. The API only ever sees the resulting
/// ID token as `Authorization: Bearer`; it never handles a password.
///
/// Google sign-in is deliberately absent — it needs a native OAuth client,
/// which is the one thing the plugin route buys (decision D1).
class FirebaseRestAuth {
  FirebaseRestAuth({required this.apiKey, Dio? dio, DateTime Function()? clock})
    : _dio = dio ?? Dio(),
      _now = clock ?? DateTime.now {
    _dio.options
      ..connectTimeout = const Duration(seconds: 20)
      ..receiveTimeout = const Duration(seconds: 20)
      ..sendTimeout = const Duration(seconds: 20);
  }

  final String apiKey;
  final Dio _dio;
  final DateTime Function() _now;

  // Local demo stack only: with GZ_AUTH_EMULATOR=10.0.2.2:9099 both endpoints point at the
  // Firebase Auth emulator, which speaks the same REST API. Empty (the default) = real Firebase.
  static const _emulator = AppConfig.authEmulatorHost;
  static const _identity = _emulator == ''
      ? 'https://identitytoolkit.googleapis.com/v1'
      : 'http://$_emulator/identitytoolkit.googleapis.com/v1';
  static const _secureToken = _emulator == ''
      ? 'https://securetoken.googleapis.com/v1/token'
      : 'http://$_emulator/securetoken.googleapis.com/v1/token';

  Future<FirebaseSession> signInWithPassword(
    String email,
    String password,
  ) async {
    final data = await _post('$_identity/accounts:signInWithPassword', {
      'email': email,
      'password': password,
      'returnSecureToken': true,
    });
    return FirebaseSession(
      uid: data['localId'] as String,
      email: data['email'] as String?,
      idToken: data['idToken'] as String,
      refreshToken: data['refreshToken'] as String,
      expiresAt: _expiry(data['expiresIn']),
    );
  }

  /// Trades a refresh token for a fresh ID token.
  Future<FirebaseSession> refresh(String refreshToken) async {
    final data = await _post(
      _secureToken,
      'grant_type=refresh_token&refresh_token=${Uri.encodeQueryComponent(refreshToken)}',
      contentType: Headers.formUrlEncodedContentType,
    );
    return FirebaseSession(
      uid: (data['user_id'] ?? data['userId']) as String,
      email: null,
      idToken: (data['id_token'] ?? data['idToken']) as String,
      refreshToken: (data['refresh_token'] ?? refreshToken) as String,
      expiresAt: _expiry(data['expires_in']),
    );
  }

  /// `confirmPasswordReset(oobCode, newPassword)` in the web SDK.
  Future<void> confirmPasswordReset(String oobCode, String newPassword) async {
    await _post('$_identity/accounts:resetPassword', {
      'oobCode': oobCode,
      'newPassword': newPassword,
    });
  }

  /// `applyActionCode(oobCode)` in the web SDK — confirms an email address.
  Future<void> applyActionCode(String oobCode) async {
    await _post('$_identity/accounts:update', {'oobCode': oobCode});
  }

  DateTime _expiry(Object? seconds) {
    final lifetime = seconds is num
        ? seconds.toInt()
        : int.tryParse('$seconds') ?? 3600;
    return _now().add(Duration(seconds: lifetime));
  }

  Future<Map<String, dynamic>> _post(
    String url,
    Object body, {
    String? contentType,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        url,
        queryParameters: {'key': apiKey},
        data: body,
        options: Options(contentType: contentType),
      );
      final data = response.data;
      return data is Map
          ? Map<String, dynamic>.from(data)
          : <String, dynamic>{};
    } on DioException catch (error) {
      throw _toException(error);
    }
  }
}

/// A signed-in Firebase identity: the short-lived ID token the API checks and
/// the long-lived refresh token that mints the next one.
class FirebaseSession {
  const FirebaseSession({
    required this.uid,
    required this.email,
    required this.idToken,
    required this.refreshToken,
    required this.expiresAt,
  });

  final String uid;
  final String? email;
  final String idToken;
  final String refreshToken;
  final DateTime expiresAt;

  /// Still good for at least [margin] — a token about to lapse mid-request is
  /// treated as already lapsed.
  bool isFresh(DateTime now, {Duration margin = const Duration(minutes: 1)}) =>
      expiresAt.isAfter(now.add(margin));
}

class FirebaseAuthException implements Exception {
  const FirebaseAuthException(this.code, this.message);

  /// Firebase's error code, e.g. `INVALID_LOGIN_CREDENTIALS`.
  final String code;

  /// The sentence a person should read — the SDK's own wording is not for
  /// end users, so these mirror the website's `friendlyAuthError`.
  final String message;

  /// The refresh token itself is dead (revoked, expired, account gone or
  /// disabled): the person has to sign in again, retrying will not help.
  bool get endsSession => const {
    'TOKEN_EXPIRED',
    'INVALID_REFRESH_TOKEN',
    'MISSING_REFRESH_TOKEN',
    'USER_DISABLED',
    'USER_NOT_FOUND',
  }.contains(code);

  bool get isNetwork => code == 'network_error';

  /// Reads as `Exception: <message>` so the screens' existing prefix
  /// stripping shows just the sentence (see `ApiError.toString`).
  @override
  String toString() => 'Exception: $message';
}

const _friendly = {
  'INVALID_LOGIN_CREDENTIALS':
      'Your email or password is wrong. Check both and try again, or tap "Forgot password?" to reset it.',
  'INVALID_PASSWORD':
      'That password is wrong. Try again, or tap "Forgot password?" to reset it.',
  'EMAIL_NOT_FOUND':
      'No GalleryZone account uses this email. Check for typos, or tap "Create account" to sign up.',
  'INVALID_EMAIL':
      'That is not a valid email address. Check for typos (e.g. missing @ or .com).',
  'USER_DISABLED':
      'This account has been suspended. Email support@galleryzone.in to appeal, mentioning this email.',
  'TOO_MANY_ATTEMPTS_TRY_LATER':
      'Too many failed attempts. Wait 15 minutes and try again — or reset your password to unlock sooner.',
  'INVALID_OOB_CODE':
      'This link is invalid or has already been used. Request a new one from "Forgot password?".',
  'EXPIRED_OOB_CODE':
      'This link has expired. Request a new one from "Forgot password?".',
  'WEAK_PASSWORD':
      'That password is too weak. Use at least 8 characters, with a mix of letters and numbers.',
  'EMAIL_EXISTS':
      'An account with this email already exists. Tap "Sign in" instead, or use "Forgot password?" if you cannot remember it.',
};

FirebaseAuthException _toException(DioException error) {
  final body = error.response?.data;
  if (body is Map && body['error'] is Map) {
    // Firebase sometimes appends detail after the code: "CODE : explanation".
    final raw = (body['error']['message'] as String?) ?? 'UNKNOWN';
    final code = raw.split(' : ').first.trim();
    return FirebaseAuthException(
      code,
      _friendly[code] ??
          'Sign-in failed (Firebase: $code). Try again in a moment. '
              'If it keeps happening, email support@galleryzone.in.',
    );
  }
  if (error.response == null) {
    return const FirebaseAuthException(
      'network_error',
      'Looks like you are offline. Check your Wi-Fi or mobile data and try again.',
    );
  }
  return const FirebaseAuthException(
    'UNKNOWN',
    'Sign-in failed for an unknown reason. Try again in a moment, and email '
        'support@galleryzone.in if it keeps happening.',
  );
}

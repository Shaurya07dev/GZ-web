import 'package:google_sign_in/google_sign_in.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/auth/firebase_rest_auth.dart';
import '../../core/auth/token_manager.dart';
import '../models/account.dart';
import '../models/auth.dart';
import '../repositories/auth_repository.dart';

/// Sign-in against the real thing: Firebase proves who is calling, the API's
/// own record says what they are.
///
///  * Email + password go to Firebase over its REST endpoints
///    ([FirebaseRestAuth]); the API never sees a password.
///  * The role comes from `GET /v1/auth/me` — the server's record of the
///    account — never from the form. That is also why the "sign in as"
///    choice the offline mock needs is gone.
///  * Registration creates the account and profile through the API
///    (`POST /v1/auth/register`) and then signs in with the same credentials.
class RemoteAuthRepository implements AuthRepository {
  RemoteAuthRepository({
    required this.api,
    required this.firebase,
    required this.tokens,
    GoogleSignIn? googleSignIn,
  }) : _google = googleSignIn ??
            GoogleSignIn(
              scopes: const ['email', 'profile'],
              // Android `google_sign_in` returns `idToken: null` unless the
              // sign-in is bound to the Firebase project's auto-generated
              // WEB OAuth client. The ID + SHA-1 pair is the Android OAuth
              // client (which authorises this APK), but the id_token we hand
              // Firebase has to be audience = web client. The id below is
              // the type-3 entry in android/app/google-services.json for
              // galleryzone-prod — not a secret (OAuth client ids never are).
              serverClientId:
                  '558316713525-ceic2am5gqt73fq9u254fe0ulupogsr9.apps.googleusercontent.com',
            );

  final ApiClient api;
  final FirebaseRestAuth firebase;
  final TokenManager tokens;
  final GoogleSignIn _google;

  static const _adminMessage =
      'Admin tools are on the GalleryZone website. Sign in at galleryzone.in to use them.';

  Future<CurrentUser> _me() async {
    final json = await api.getMap('/v1/auth/me');
    return CurrentUser(
      uid: json['uid'] as String? ?? '',
      roleId: json['role'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      roleGrants: [
        for (final grant in (json['roleGrants'] as List? ?? const []))
          if (grant is String) grant,
      ],
    );
  }

  /// Signs in to Firebase, then asks the API who that is.
  Future<AuthAck> _establish(
    String email,
    String password, {
    required bool remember,
  }) async {
    final session = await firebase.signInWithPassword(email.trim(), password);
    await tokens.start(session, remember: remember);

    final CurrentUser user;
    try {
      user = await _me();
    } on ApiError catch (error) {
      // Signed in to Firebase but there is no GalleryZone profile behind it:
      // nowhere useful to route them.
      await tokens.clear();
      if (error.isUnauthorized) {
        throw Exception(
          'Either your password is wrong, or no GalleryZone account exists for '
          'this email. Check the password, or tap "Create account" below to '
          'register.',
        );
      }
      rethrow;
    }

    final role = user.role;
    if (role == null) {
      // An admin: a real account, but not one the app has a portal for.
      await tokens.clear();
      throw Exception(_adminMessage);
    }
    return AuthAck(
      email: user.email.isEmpty ? email : user.email,
      role: role,
      name: user.name,
    );
  }

  @override
  Future<AuthAck> login(LoginInput input, {bool simulateError = false}) =>
      _establish(input.email, input.password, remember: input.rememberMe);

  @override
  Future<AuthAck> loginWithGoogle({Role? defaultRole, String? name}) async {
    // 1. Google account chooser — a cancelled tap is a silent no-op, not an
    //    error. signInSilently first tries the already-chosen account, falling
    //    back to the chooser.
    final account = await _google.signIn();
    if (account == null) {
      throw Exception('Google sign-in cancelled.');
    }
    final auth = await account.authentication;
    final googleIdToken = auth.idToken;
    if (googleIdToken == null || googleIdToken.isEmpty) {
      await _google.signOut();
      throw Exception(
        'Google did not return an ID token. Try again, or sign in with email '
        'and password.',
      );
    }

    // 2. Exchange it for a Firebase session.
    final session = await firebase.signInWithGoogleIdToken(googleIdToken);
    await tokens.start(session, remember: true);

    // 3. Look up the GalleryZone profile. A first-time Google signer has no
    //    row yet — the API's bootstrap endpoint creates it with the role
    //    the user picked on the register screen (or `customer` as a default
    //    on the login screen).
    CurrentUser user;
    try {
      user = await _me();
    } on ApiError catch (error) {
      if (!error.isUnauthorized) {
        await tokens.clear();
        await _google.signOut();
        rethrow;
      }
      try {
        await api.post(
          '/v1/auth/bootstrap',
          body: {
            if (defaultRole != null) 'role': defaultRole.name,
            if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
          },
        );
        user = await _me();
      } catch (bootstrapError) {
        await tokens.clear();
        await _google.signOut();
        rethrow;
      }
    }

    final role = user.role;
    if (role == null) {
      // An admin signed in on the app, which has no admin portal.
      await tokens.clear();
      await _google.signOut();
      throw Exception(_adminMessage);
    }
    return AuthAck(
      email: user.email.isEmpty ? (account.email) : user.email,
      role: role,
      name: user.name,
    );
  }

  @override
  Future<AuthAck> register(
    RegisterInput input, {
    bool simulateError = false,
  }) async {
    await api.post(
      '/v1/auth/register',
      auth: false,
      body: {
        'email': input.email.trim(),
        'password': input.password,
        'name': input.name.trim(),
        'role': input.role.name,
        'phone': input.phone,
      },
    );
    final ack = await _establish(input.email, input.password, remember: true);

    // The sign-up form asks an aggregator for its company name, but the
    // account endpoint has nowhere to put it. Saving it on the profile now
    // means they are not asked twice. Best effort: a failure here must not
    // undo a registration that worked.
    final company = input.companyName?.trim() ?? '';
    if (input.role == Role.aggregator && company.isNotEmpty) {
      try {
        await api.patch('/v1/me/profile', body: {'companyName': company});
      } on ApiError {
        // They can enter it on their profile.
      }
    }
    return ack;
  }

  /// The API answers 202 whether or not the address has an account, so this
  /// cannot be used to find out who is registered.
  @override
  Future<AuthAck> forgotPassword(
    ForgotPasswordInput input, {
    bool simulateError = false,
  }) async {
    await api.post(
      '/v1/auth/password-reset',
      auth: false,
      body: {'email': input.email.trim()},
    );
    return AuthAck(email: input.email);
  }

  /// [ResetPasswordInput.token] is Firebase's `oobCode` from the emailed link.
  @override
  Future<AuthResult> resetPassword(
    ResetPasswordInput input, {
    bool simulateError = false,
  }) async {
    final code = input.token;
    if (code == null || code.isEmpty) {
      throw Exception(
        'This reset link is missing its code. Request a new one.',
      );
    }
    await firebase.confirmPasswordReset(code, input.password);
    return const AuthResult();
  }

  @override
  Future<AuthResult> verifyEmail({
    String? token,
    bool simulateError = false,
  }) async {
    if (token == null || token.isEmpty) {
      throw Exception('This verification link is missing its code.');
    }
    await firebase.applyActionCode(token);
    return const AuthResult();
  }

  @override
  Future<void> signOut() async {
    // Also forget the Google account on-device: without this, the next
    // Google button tap signs the same account back in silently instead
    // of showing the chooser — surprising when more than one account is
    // on the phone.
    try {
      await _google.signOut();
    } catch (_) {
      // The plugin can throw if it was never used; the sign-out is
      // best-effort.
    }
    await tokens.clear();
  }

  @override
  Future<void> requestAccountDeletion() async {
    await api.post(
      '/v1/support',
      body: {
        'subject': 'Account deletion request',
        'message':
            'Please close my GalleryZone account and delete my data. Sent from the GalleryZone app. '
            'I understand any wallet balance should be withdrawn first.',
      },
    );
  }

  @override
  Future<CurrentUser?> resumeSession() async {
    if (!tokens.hasSession) return null;
    try {
      return await _me();
    } on ApiError catch (error) {
      // A refused session is over; a missing network is not.
      if (error.isUnauthorized || error.isAccountClosed) {
        await tokens.clear();
        return null;
      }
      rethrow;
    }
  }

  // --- OTP (3 Nov 2026) ------------------------------------------------------
  // Thin pass-through to the API. See the controller comments in
  // backend/apps/api/src/auth/otp.controller.ts for the exact semantics.

  @override
  Future<void> sendEmailOtp({required String email, required String purpose}) async {
    await api.post(
      '/v1/auth/email-otp/send',
      auth: false,
      body: {'email': email.trim(), 'purpose': purpose},
    );
  }

  @override
  Future<void> verifyEmailOtp({required String email, required String code}) async {
    await api.post(
      '/v1/auth/email-otp/verify',
      auth: false,
      body: {'email': email.trim(), 'code': code.trim(), 'purpose': 'signup'},
    );
  }

  @override
  Future<void> sendPhoneOtp({required String phone}) async {
    await api.post('/v1/auth/phone-otp/send', body: {'phone': phone.trim()});
  }

  @override
  Future<void> verifyPhoneOtp({required String phone, required String code}) async {
    await api.post(
      '/v1/auth/phone-otp/verify',
      body: {'phone': phone.trim(), 'code': code.trim()},
    );
  }

  @override
  Future<void> resetPasswordWithOtp({
    required String email,
    required String code,
    required String password,
  }) async {
    await api.post(
      '/v1/auth/reset-password',
      auth: false,
      body: {'email': email.trim(), 'code': code.trim(), 'password': password},
    );
  }
}

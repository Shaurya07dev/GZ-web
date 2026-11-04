import '../models/account.dart';
import '../models/auth.dart';
import '../repositories/auth_repository.dart';
import 'mock_utils.dart';

class MockAuthRepository implements AuthRepository {
  @override
  Future<AuthAck> login(LoginInput input, {bool simulateError = false}) {
    if (simulateError) return mockError('Invalid email or password.');
    return mockDelay(() => AuthAck(email: input.email));
  }

  @override
  Future<AuthAck> register(RegisterInput input, {bool simulateError = false}) {
    if (simulateError) {
      return mockError('An account with this email already exists.');
    }
    return mockDelay(() => AuthAck(email: input.email));
  }

  @override
  Future<AuthAck> forgotPassword(
    ForgotPasswordInput input, {
    bool simulateError = false,
  }) {
    if (simulateError) return mockError('Could not send reset email.');
    return mockDelay(() => AuthAck(email: input.email));
  }

  @override
  Future<AuthResult> resetPassword(
    ResetPasswordInput input, {
    bool simulateError = false,
  }) {
    if (simulateError) return mockError('Reset link is invalid or expired.');
    return mockDelay(() => const AuthResult());
  }

  @override
  Future<AuthResult> verifyEmail({String? token, bool simulateError = false}) {
    // Failure is driven by the token value itself, same as the web mock
    // (mirrors how a real bad/expired link would arrive as a URL param),
    // plus a longer delay so the "Verifying…" state reads as real work.
    if (simulateError || token == 'invalid') {
      return mockError('This verification link is invalid or has expired.');
    }
    return mockDelay(
      () => const AuthResult(),
      duration: const Duration(milliseconds: 1200),
    );
  }

  @override
  Future<void> signOut() async {}

  @override
  Future<void> requestAccountDeletion() async {}

  @override
  Future<CurrentUser?> resumeSession() async => null;

  // OTP mocks: a four-six-two "123456" always passes, anything else fails,
  // so the screens can be exercised offline the same way the web mock does.
  @override
  Future<void> sendEmailOtp({required String email, required String purpose}) =>
      mockDelay(() {});

  @override
  Future<void> verifyEmailOtp({required String email, required String code}) {
    if (code != '123456') return mockError('That code is wrong or expired.');
    return mockDelay(() {});
  }

  @override
  Future<void> sendPhoneOtp({required String phone}) => mockDelay(() {});

  @override
  Future<void> verifyPhoneOtp({required String phone, required String code}) {
    if (code != '123456') return mockError('That code is wrong or expired.');
    return mockDelay(() {});
  }

  @override
  Future<void> resetPasswordWithOtp({
    required String email,
    required String code,
    required String password,
  }) {
    if (code != '123456') return mockError('That code is wrong or expired.');
    return mockDelay(() {});
  }
}

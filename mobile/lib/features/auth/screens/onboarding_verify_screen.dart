import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../providers/auth_providers.dart';
import '../role_options.dart';
import '../validators.dart';
import '../widgets/auth_widgets.dart';
import 'login_screen.dart';
import '../../../data/models/auth.dart';

/// Port of `features/auth/components/onboarding-verify.tsx`. Two steps,
/// in order:
///
///  1. **Email OTP** — a six-digit code issued by `/v1/auth/email-otp/send`
///     and consumed by `/v1/auth/email-otp/verify`. Skipped automatically
///     for a first-time Google sign-up (its Firebase token already proves
///     the email), which arrives with `emailVerified: true`.
///  2. **Phone OTP** — a six-digit SMS via MSG91. Skippable; the person
///     can add their number later from the profile.
///
/// On completion the screen writes the session and lands the role.
class OnboardingVerifyScreen extends ConsumerStatefulWidget {
  const OnboardingVerifyScreen({
    super.key,
    required this.email,
    required this.role,
    this.emailAlreadyVerified = false,
  });

  static const path = '/onboarding/verify';

  final String email;
  final Role role;

  /// True for Google sign-up — Firebase has already verified the email, so
  /// skip step 1.
  final bool emailAlreadyVerified;

  @override
  ConsumerState<OnboardingVerifyScreen> createState() =>
      _OnboardingVerifyScreenState();
}

enum _Step { email, phone }

class _OnboardingVerifyScreenState
    extends ConsumerState<OnboardingVerifyScreen> {
  late _Step _step = widget.emailAlreadyVerified ? _Step.phone : _Step.email;

  final _emailCode = TextEditingController();
  final _phone = TextEditingController();
  final _phoneCode = TextEditingController();

  bool _emailSending = false;
  bool _emailVerifying = false;
  bool _phoneSending = false;
  bool _phoneVerifying = false;
  bool _phoneSent = false;
  String? _error;
  String? _info;

  @override
  void initState() {
    super.initState();
    // Auto-fire the first email send for sign-ups — the previous screen
    // only called /register and bounced here. Google skips this.
    if (!widget.emailAlreadyVerified) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _sendEmailOtp());
    }
  }

  @override
  void dispose() {
    _emailCode.dispose();
    _phone.dispose();
    _phoneCode.dispose();
    super.dispose();
  }

  void _setError(String? message) => setState(() {
    _error = message;
    _info = null;
  });

  void _setInfo(String? message) => setState(() {
    _info = message;
    _error = null;
  });

  Future<void> _sendEmailOtp() async {
    if (_emailSending) return;
    setState(() {
      _emailSending = true;
      _error = null;
    });
    try {
      await ref
          .read(authRepositoryProvider)
          .sendEmailOtp(email: widget.email, purpose: 'signup');
      if (!mounted) return;
      _setInfo('Code sent. Check your inbox.');
    } catch (error) {
      if (!mounted) return;
      _setError(authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _emailSending = false);
    }
  }

  Future<void> _verifyEmailOtp() async {
    final code = _emailCode.text.trim();
    if (code.length != 6) {
      _setError('Enter the six-digit code.');
      return;
    }
    setState(() {
      _emailVerifying = true;
      _error = null;
    });
    try {
      await ref
          .read(authRepositoryProvider)
          .verifyEmailOtp(email: widget.email, code: code);
      if (!mounted) return;
      setState(() {
        _step = _Step.phone;
        _info = 'Email verified. Add your phone number next.';
      });
    } catch (error) {
      if (!mounted) return;
      _setError(authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _emailVerifying = false);
    }
  }

  Future<void> _sendPhoneOtp() async {
    final phone = _phone.text.trim();
    if (!_isValidPhone(phone)) {
      _setError('Enter a 10-digit mobile number.');
      return;
    }
    setState(() {
      _phoneSending = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).sendPhoneOtp(phone: phone);
      if (!mounted) return;
      setState(() {
        _phoneSent = true;
        _info = 'Code sent by SMS.';
      });
    } catch (error) {
      if (!mounted) return;
      _setError(authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _phoneSending = false);
    }
  }

  Future<void> _verifyPhoneOtp() async {
    final phone = _phone.text.trim();
    final code = _phoneCode.text.trim();
    if (code.length != 6) {
      _setError('Enter the six-digit code.');
      return;
    }
    setState(() {
      _phoneVerifying = true;
      _error = null;
    });
    try {
      await ref
          .read(authRepositoryProvider)
          .verifyPhoneOtp(phone: phone, code: code);
      if (!mounted) return;
      await _finish();
    } catch (error) {
      if (!mounted) return;
      _setError(authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _phoneVerifying = false);
    }
  }

  /// "I'll do this later" on the phone step. The account is signed in
  /// either way; the number can be added from the profile.
  Future<void> _skipPhone() => _finish();

  Future<void> _finish() async {
    await ref.read(sessionProvider.notifier).signIn(widget.role);
    ref.invalidate(accountProvider);
    if (!mounted) return;
    context.go(landingAfterRegister(widget.role));
  }

  bool _isValidPhone(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    return digits.length == 10 || digits.length == 12;
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthCrest(),
          const SizedBox(height: 24),
          AuthFormHeader(
            title: _step == _Step.email
                ? 'Verify your email'
                : 'Verify your phone',
            description: _step == _Step.email
                ? "We sent a six-digit code to ${widget.email}. Enter it below."
                : 'An SMS code finishes setting up your account. You can add this later from your profile.',
            icon: _step == _Step.email ? LucideIcons.mail : LucideIcons.phone,
          ),
          const SizedBox(height: 20),
          if (_error != null) ...[
            AuthErrorBanner(message: _error!),
            const SizedBox(height: 12),
          ] else if (_info != null) ...[
            _InfoBanner(message: _info!),
            const SizedBox(height: 12),
          ],
          if (_step == _Step.email) _buildEmailStep() else _buildPhoneStep(),
        ],
      ),
    );
  }

  Widget _buildEmailStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _OtpInput(controller: _emailCode),
        const SizedBox(height: 18),
        AuthSubmitButton(
          label: 'Verify email',
          isLoading: _emailVerifying,
          onPressed: _verifyEmailOtp,
        ),
        const SizedBox(height: 10),
        Center(
          child: TextButton.icon(
            onPressed: _emailSending ? null : _sendEmailOtp,
            icon: _emailSending
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(LucideIcons.rotateCw, size: 14),
            label: Text(_emailSending ? 'Sending…' : 'Resend code'),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthTextField(
          label: 'Phone number',
          controller: _phone,
          validator: validatePhone,
          hint: '98765 43210',
          icon: LucideIcons.phone,
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumber],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 44,
          child: OutlinedButton.icon(
            onPressed: _phoneSending ? null : _sendPhoneOtp,
            icon: _phoneSending
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(LucideIcons.send, size: 16),
            label: Text(_phoneSent ? 'Resend SMS code' : 'Send SMS code'),
          ),
        ),
        if (_phoneSent) ...[
          const SizedBox(height: 18),
          _OtpInput(controller: _phoneCode),
          const SizedBox(height: 18),
          AuthSubmitButton(
            label: 'Verify phone',
            isLoading: _phoneVerifying,
            onPressed: _verifyPhoneOtp,
          ),
        ],
        const SizedBox(height: 10),
        Center(
          child: TextButton(
            onPressed: (_phoneVerifying || _phoneSending) ? null : _skipPhone,
            child: const Text("I'll add my phone later"),
          ),
        ),
        const SizedBox(height: 4),
        Center(
          child: TextButton(
            onPressed: () => context.go(LoginScreen.path),
            child: const Text('Back to sign in'),
          ),
        ),
      ],
    );
  }
}

class _OtpInput extends StatelessWidget {
  const _OtpInput({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      autofocus: true,
      maxLength: 6,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(
        letterSpacing: 8,
        fontWeight: FontWeight.w600,
      ),
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      decoration: const InputDecoration(
        hintText: '••••••',
        counterText: '',
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.info, size: 18, color: theme.colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message, style: theme.textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}

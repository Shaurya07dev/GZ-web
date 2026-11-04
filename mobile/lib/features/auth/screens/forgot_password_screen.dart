import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../providers/auth_providers.dart';
import '../validators.dart';
import '../widgets/auth_widgets.dart';
import 'login_screen.dart';

/// Port of `features/auth/components/forgot-password-form.tsx`'s OTP flow.
/// Two steps: request a reset code to your email, then type the code and a
/// new password together. Non-committal copy at step 1 — the API answers
/// 202 whether or not an account exists, so this screen does not confirm
/// one way or the other.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  static const path = '/forgot-password';

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

enum _Step { email, reset }

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  _Step _step = _Step.email;

  final _emailForm = GlobalKey<FormState>();
  final _resetForm = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();

  bool _sending = false;
  bool _resetting = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _sendCode({bool resend = false}) async {
    if (!resend && !_emailForm.currentState!.validate()) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).sendEmailOtp(
            email: _email.text.trim(),
            purpose: 'password_reset',
          );
      if (!mounted) return;
      setState(() {
        _step = _Step.reset;
        _info = resend ? 'Code resent.' : 'If an account exists, a code is on its way.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _resetPassword() async {
    if (!_resetForm.currentState!.validate()) return;
    setState(() {
      _resetting = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).resetPasswordWithOtp(
            email: _email.text.trim(),
            code: _code.text.trim(),
            password: _password.text,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password updated. Sign in with your new password.'),
        ),
      );
      context.go(LoginScreen.path);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _resetting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthFormHeader(
            title: _step == _Step.email
                ? 'Forgot your password?'
                : 'Enter your reset code',
            description: _step == _Step.email
                ? "Enter your email and we'll send you a six-digit code to reset it."
                : "We sent a code to ${_email.text.trim()}. Enter it below with your new password.",
            icon: _step == _Step.email ? LucideIcons.keyRound : LucideIcons.shieldCheck,
          ),
          const SizedBox(height: 20),
          if (_error != null) ...[
            AuthErrorBanner(message: _error!),
            const SizedBox(height: 12),
          ] else if (_info != null) ...[
            _InfoBanner(message: _info!),
            const SizedBox(height: 12),
          ],
          if (_step == _Step.email) _buildEmailStep() else _buildResetStep(),
        ],
      ),
    );
  }

  Widget _buildEmailStep() {
    return Form(
      key: _emailForm,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthTextField(
            label: 'Email',
            controller: _email,
            validator: validateEmail,
            hint: 'you@example.com',
            icon: LucideIcons.mail,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
          ),
          const SizedBox(height: 20),
          AuthSubmitButton(
            label: 'Send reset code',
            isLoading: _sending,
            onPressed: () => _sendCode(),
          ),
          const SizedBox(height: 16),
          Center(
            child: TextButton.icon(
              onPressed: () => context.go(LoginScreen.path),
              icon: const Icon(LucideIcons.arrowLeft, size: 14),
              label: const Text('Back to sign in'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResetStep() {
    return Form(
      key: _resetForm,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Six-digit code',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _code,
            autofocus: true,
            maxLength: 6,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              letterSpacing: 8,
              fontWeight: FontWeight.w600,
            ),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            validator: (value) {
              final v = value?.trim() ?? '';
              if (v.length != 6) return 'Enter the six-digit code.';
              return null;
            },
            decoration: const InputDecoration(
              hintText: '••••••',
              counterText: '',
            ),
          ),
          const SizedBox(height: 14),
          AuthTextField(
            label: 'New password',
            controller: _password,
            validator: validateNewPassword,
            hint: 'Min 8 characters, 1 letter, 1 number',
            icon: LucideIcons.lock,
            obscure: true,
            autofillHints: const [AutofillHints.newPassword],
          ),
          const SizedBox(height: 20),
          AuthSubmitButton(
            label: 'Reset password',
            isLoading: _resetting,
            onPressed: _resetPassword,
          ),
          const SizedBox(height: 10),
          Center(
            child: TextButton.icon(
              onPressed: _sending ? null : () => _sendCode(resend: true),
              icon: _sending
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(LucideIcons.rotateCw, size: 14),
              label: Text(_sending ? 'Sending…' : 'Resend code'),
            ),
          ),
          Center(
            child: TextButton(
              onPressed: () => context.go(LoginScreen.path),
              child: const Text('Back to sign in'),
            ),
          ),
        ],
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

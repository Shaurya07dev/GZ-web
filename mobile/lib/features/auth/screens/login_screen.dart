import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/auth.dart';
import '../providers/auth_providers.dart';
import '../role_options.dart';
import '../validators.dart';
import '../widgets/auth_widgets.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

/// Port of `features/auth/components/login-form.tsx`.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next});

  static const path = '/login';

  /// Where the guard bounced the user from, carried through as `?next=` the
  /// same way `proxy.ts` does it.
  final String? next;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  // Offline mock only: with no backend to say who an account is, this toggle
  // is the real "sign in as" control. Against the real API the role comes
  // from the server's record of the account and the toggle is not drawn.
  // Sent here from checkout or a hand-over, the person is a collector.
  late Role _demoRole = switch (widget.next) {
    final next?
        when next.startsWith('/checkout') || next.startsWith('/transfer') =>
      Role.customer,
    _ => Role.artist,
  };

  // On by default: someone signing in expects to still be signed in when they
  // come back, not to be handed the form again.
  bool _rememberMe = true;
  bool _simulateError = false;
  bool _isSubmitting = false;
  String? _formError;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _formError = null;
      _isSubmitting = true;
    });
    try {
      final ack = await ref
          .read(authRepositoryProvider)
          .login(
            LoginInput(
              email: _email.text.trim(),
              password: _password.text,
              rememberMe: _rememberMe,
            ),
            simulateError: _simulateError,
          );
      // The server decides the role; only the offline mock falls back to the
      // "sign in as" choice.
      final role = ack.role ?? _demoRole;
      await ref
          .read(sessionProvider.notifier)
          .signIn(role, rememberMe: _rememberMe);
      ref.invalidate(accountProvider);
      if (!mounted) return;
      context.go(landingAfterLogin(role, next: widget.next));
    } catch (error) {
      if (!mounted) return;
      setState(() => _formError = authErrorMessage(error));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// One tap into a role's sample-data home, no form. Offline demo only (the
  /// buttons are not drawn against the real API): the same fake-session write
  /// [_submit] performs, minus the email and password.
  Future<void> _demoSignIn(Role role) async {
    HapticFeedback.lightImpact();
    await ref.read(sessionProvider.notifier).signIn(role);
    ref.invalidate(accountProvider);
    if (!mounted) return;
    // Back to where they were going — a guest who tapped Buy Now was sent
    // here mid-purchase and should land in checkout, not on a dashboard.
    context.go(safeNextPath(widget.next) ?? role.home);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final remote = ref.watch(remoteBackendProvider);
    final sessionEnded = ref.watch(sessionEndedProvider);
    return AuthScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              // Sent here from a page (Buy Now, a hand-over link): the way
              // back to it, which the form alone does not show.
              if (Navigator.of(context).canPop())
                IconButton(
                  tooltip: 'Back',
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              const Spacer(),
              // Someone opening the app for the first time came to look at
              // art, not to fill in a form: the way in without an account is
              // at the top, not under the whole form.
              TextButton.icon(
                onPressed: () => context.push('/marketplace'),
                icon: const Icon(LucideIcons.arrowRight, size: 16),
                iconAlignment: IconAlignment.end,
                label: const Text('Explore art'),
              ),
            ],
          ),
          const Reveal(child: AuthCrest()),
          const SizedBox(height: 28),
          if (widget.next case final next?) ...[
            Reveal(index: 1, child: _WhySignIn(next: next)),
            const SizedBox(height: 20),
          ],
          if (!remote) ...[
            Reveal(index: 1, child: _DemoSignIn(onPick: _demoSignIn)),
            const SizedBox(height: 28),
            Reveal(
              index: 2,
              child: RoleToggle<Role>(
                options: [
                  for (final option in roleOptions)
                    (
                      label: option.label,
                      icon: option.icon,
                      value: option.role,
                    ),
                ],
                value: _demoRole,
                onChanged: (role) => setState(() => _demoRole = role),
              ),
            ),
            const SizedBox(height: 24),
          ],
          Reveal(
            index: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AuthFormHeader(
                  title: 'Welcome back',
                  description: remote
                      ? 'Sign in to continue to your portal.'
                      : 'Pick your role above, then sign in to continue.',
                  icon: LucideIcons.logIn,
                ),
                if (sessionEnded && _formError == null) ...[
                  const SizedBox(height: 20),
                  const AuthErrorBanner(
                    message: 'You were signed out. Sign in again to continue.',
                  ),
                ],
                if (_formError != null) ...[
                  const SizedBox(height: 20),
                  AuthErrorBanner(message: _formError!),
                ],
                const SizedBox(height: 24),
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      AuthTextField(
                        label: 'Email Address',
                        controller: _email,
                        validator: validateEmail,
                        hint: 'you@example.com',
                        icon: LucideIcons.mail,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                      ),
                      const SizedBox(height: 18),
                      AuthTextField(
                        label: 'Password',
                        controller: _password,
                        validator: validateRequiredPassword,
                        hint: 'Your password',
                        icon: LucideIcons.lock,
                        obscure: true,
                        autofillHints: const [AutofillHints.password],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(
                            child: InkWell(
                              onTap: () =>
                                  setState(() => _rememberMe = !_rememberMe),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Checkbox(
                                    value: _rememberMe,
                                    onChanged: (value) => setState(
                                      () => _rememberMe = value ?? false,
                                    ),
                                  ),
                                  const Flexible(child: Text('Remember me')),
                                ],
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () =>
                                context.push(ForgotPasswordScreen.path),
                            child: const Text('Forgot password?'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      AuthSubmitButton(
                        label: 'Sign in',
                        isLoading: _isSubmitting,
                        onPressed: _submit,
                      ),
                      if (!remote) ...[
                        const SizedBox(height: 16),
                        DevPanel(
                          child: Row(
                            children: [
                              const Expanded(
                                child: Text('Simulate invalid credentials'),
                              ),
                              Switch.adaptive(
                                value: _simulateError,
                                onChanged: (value) =>
                                    setState(() => _simulateError = value),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          // The marketplace is public (no session needed), same as the web's
          // header nav — reachable before signing in, not only after.
          Center(
            child: TextButton.icon(
              onPressed: () => context.push('/marketplace'),
              icon: const Icon(LucideIcons.compass, size: 16),
              label: const Text('Browse the marketplace'),
            ),
          ),
          const SizedBox(height: 8),
          const SocialAuthRow(),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text("Don't have an account?", style: theme.textTheme.bodySmall),
              TextButton(
                onPressed: () => context.push(RegisterScreen.path),
                child: const Text('Create one'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Why the sign-in is in the way, when it was put there mid-task: the
/// purchase or hand-over is waiting, and signing in goes straight back to it.
class _WhySignIn extends StatelessWidget {
  const _WhySignIn({required this.next});

  final String next;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (icon, title, body) = switch (next) {
      _ when next.startsWith('/checkout') => (
        LucideIcons.shoppingBag,
        'Sign in to finish your purchase',
        "Your artwork is waiting. You'll be back at checkout as soon as "
            "you're in.",
      ),
      _ when next.startsWith('/transfer') => (
        LucideIcons.gift,
        'Sign in to accept this artwork',
        "You'll go straight back to the hand-over once you're in.",
      ),
      _ => (
        LucideIcons.lock,
        'Sign in to continue',
        "You'll be taken back to where you were.",
      ),
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: theme.colorScheme.tertiary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleSmall),
                const SizedBox(height: 2),
                Text(body, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// "Demo Artist / Demo Aggregator / Demo Customer": one tap into each portal
/// with sample data. Drawn only in the offline demo build.
class _DemoSignIn extends StatelessWidget {
  const _DemoSignIn({required this.onPick});

  final ValueChanged<Role> onPick;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final radius = BorderRadius.circular(AppRadius.lg);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.xl),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.primary.withValues(alpha: 0.12),
            theme.colorScheme.primary.withValues(alpha: 0.03),
          ],
        ),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                LucideIcons.sparkles,
                size: 16,
                color: theme.colorScheme.tertiary,
              ),
              const SizedBox(width: 8),
              Text('Try the demo', style: theme.textTheme.titleSmall),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'One tap, no account. Sample data only.',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (final option in roleOptions) ...[
                Expanded(
                  child: Material(
                    color: theme.colorScheme.surfaceContainerLowest,
                    shape: RoundedRectangleBorder(
                      borderRadius: radius,
                      side: BorderSide(
                        color: theme.colorScheme.primary.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Pressable(
                      onTap: () => onPick(option.role),
                      borderRadius: radius,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 14,
                        ),
                        child: Column(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: theme.colorScheme.primary.withValues(
                                  alpha: 0.14,
                                ),
                              ),
                              child: Icon(
                                option.icon,
                                size: 18,
                                color: theme.colorScheme.tertiary,
                              ),
                            ),
                            const SizedBox(height: 10),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                'Demo ${option.label}',
                                maxLines: 1,
                                style: theme.textTheme.labelSmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                if (option != roleOptions.last) const SizedBox(width: 8),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

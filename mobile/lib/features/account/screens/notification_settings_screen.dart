import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion.dart';
import '../../../data/models/notification_prefs.dart';
import '../../marketplace/widgets/artwork_card.dart' show EmptyState;
import '../providers/account_providers.dart';

/// Four opt-in notification toggles, mirroring the web
/// `NotificationPreferencesCard` on /account/settings. Transactional emails
/// (order confirmations, invoices, password resets) are always sent and have
/// no toggle here.
class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  static const path = '/account/notifications';

  @override
  ConsumerState<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends ConsumerState<NotificationSettingsScreen> {
  String? _savingKey;

  Future<void> _toggle(
    NotificationPreferences current,
    String key,
    bool next,
  ) async {
    if (_savingKey != null) return;
    setState(() => _savingKey = key);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(customerRepositoryProvider)
          .updateNotificationPreferences({key: next});
      ref.invalidate(notificationPreferencesProvider);
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _savingKey = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final prefsAsync = ref.watch(notificationPreferencesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: prefsAsync.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.triangleAlert,
          title: "Couldn't load notification settings",
          description: 'Please try again in a moment.',
          action: OutlinedButton(
            onPressed: () =>
                ref.invalidate(notificationPreferencesProvider),
            child: const Text('Retry'),
          ),
        ),
        data: (prefs) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Text(
              'Transactional emails like order confirmations, invoices, and password resets are always sent — these controls only cover reminders and news.',
              style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
            ),
            const SizedBox(height: 20),
            _ToggleTile(
              title: 'Abandoned cart reminders',
              subtitle:
                  "Email us if you added a piece to your cart but didn't check out.",
              value: prefs.abandonedCart,
              busy: _savingKey == 'abandonedCart',
              onChanged: (v) => _toggle(prefs, 'abandonedCart', v),
            ),
            _ToggleTile(
              title: 'News and announcements',
              subtitle:
                  'Platform updates, new artist drops, feature releases.',
              value: prefs.marketing,
              busy: _savingKey == 'marketing',
              onChanged: (v) => _toggle(prefs, 'marketing', v),
            ),
            _ToggleTile(
              title: 'Weekly digest',
              subtitle: 'A once-a-week roundup of marketplace activity.',
              value: prefs.weeklyDigest,
              busy: _savingKey == 'weeklyDigest',
              onChanged: (v) => _toggle(prefs, 'weeklyDigest', v),
            ),
            _ToggleTile(
              title: 'Push notifications',
              subtitle: "Allow pushes on devices you've signed in to.",
              value: prefs.pushEnabled,
              busy: _savingKey == 'pushEnabled',
              onChanged: (v) => _toggle(prefs, 'pushEnabled', v),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  const _ToggleTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.busy,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final bool busy;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      value: value,
      onChanged: busy ? null : onChanged,
      title: Text(title),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Text(subtitle),
      ),
    );
  }
}

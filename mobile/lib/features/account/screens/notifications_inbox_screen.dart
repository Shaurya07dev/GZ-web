import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/notification_inbox.dart';
import '../../marketplace/widgets/artwork_card.dart' show EmptyState;
import '../providers/account_providers.dart';

/// The in-app inbox for transactional notifications (order shipped, payment
/// received, settlement processed). Ports the web /notifications popover to
/// a full screen on mobile — tapping a row marks it read and navigates to
/// the deep link if the server attached one.
///
/// Added 9 Nov 2026 — web had this via the notifications popover; mobile
/// had nothing, so buyers only saw order updates in email.
class NotificationsInboxScreen extends ConsumerWidget {
  const NotificationsInboxScreen({super.key});

  static const path = '/account/notifications/inbox';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          inbox.when(
            data: (data) => data.unreadCount > 0
                ? TextButton(
                    onPressed: () async {
                      await ref
                          .read(customerRepositoryProvider)
                          .markAllNotificationsRead();
                      ref.invalidate(notificationsProvider);
                    },
                    child: const Text('Mark all read'),
                  )
                : const SizedBox.shrink(),
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: RefreshIndicator.adaptive(
        onRefresh: () async {
          ref.invalidate(notificationsProvider);
          await ref.read(notificationsProvider.future);
        },
        child: inbox.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            children: [
              const SizedBox(height: 120),
              EmptyState(
                icon: LucideIcons.triangleAlert,
                title: "Couldn't load notifications",
                description: 'Pull down to try again in a moment.',
              ),
            ],
          ),
          data: (data) {
            if (data.items.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: LucideIcons.bell,
                    title: 'No notifications yet',
                    description:
                        'Order updates, payment confirmations and announcements show up here.',
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: data.items.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) => _NotificationRow(
                notification: data.items[i],
                onTap: () async {
                  final n = data.items[i];
                  if (!n.read) {
                    await ref
                        .read(customerRepositoryProvider)
                        .markNotificationRead(n.id);
                    ref.invalidate(notificationsProvider);
                  }
                  if (context.mounted && n.url != null && n.url!.isNotEmpty) {
                    // The server stores web paths; the mobile router shares
                    // most of them (/account/orders/*, /marketplace/*).
                    context.push(n.url!);
                  }
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unread = !notification.read;
    return Material(
      color: unread
          ? theme.colorScheme.primary.withValues(alpha: 0.05)
          : theme.cardTheme.color,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: unread
                      ? theme.colorScheme.tertiary
                      : Colors.transparent,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight:
                            unread ? FontWeight.w600 : FontWeight.w500,
                      ),
                    ),
                    if (notification.body.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        notification.body,
                        style: theme.textTheme.bodySmall?.copyWith(
                          height: 1.4,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

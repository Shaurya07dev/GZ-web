import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/account/providers/account_providers.dart'
    show customerRepositoryProvider, notificationsProvider;
import '../router/app_router.dart' show routerProvider;
import 'fcm_service.dart';

/// One `FcmService` instance per app lifetime. The service itself is a
/// no-op when Firebase config files aren't present, so this is safe to
/// create even in offline/mock dev builds — call-site code doesn't branch.
final fcmServiceProvider = Provider<FcmService>((ref) {
  final service = FcmService(
    repository: ref.watch(customerRepositoryProvider),
  );
  ref.onDispose(service.dispose);
  return service;
});

/// A keep-alive subscription that invalidates the notifications inbox
/// whenever a foreground push arrives. Just `ref.watch` this from the
/// root widget; it never produces a value, it only reacts to the FCM
/// service's foreground stream.
///
/// Why a provider: Riverpod disposes the stream subscription when the
/// root widget unmounts (e.g. hot reload), which prevents duplicate
/// listeners. The service persists the inbox row server-side alongside
/// every push, so we just need to tell this client to re-fetch.
final fcmInboxRefreshProvider = Provider<void>((ref) {
  final service = ref.watch(fcmServiceProvider);
  final sub = service.onForegroundMessage.listen((_) {
    ref.invalidate(notificationsProvider);
  });
  ref.onDispose(sub.cancel);
});

/// Keep-alive subscription that opens the server-attached URL when the
/// user taps a system-tray push. The backend attaches `url` to the FCM
/// data payload (same path it writes to the in-app inbox row), so the
/// mapping is identity: data['url'] → router.push(url).
///
/// Also marks the notification read in the background — the server knows
/// the id from the data payload, and the user acted on it by tapping, so
/// the bell unread count drops immediately on return to the inbox.
final fcmDeepLinkProvider = Provider<void>((ref) {
  final service = ref.watch(fcmServiceProvider);
  final router = ref.read(routerProvider);
  final sub = service.onNotificationTap.listen((message) async {
    final data = message.data;
    final url = data['url'] as String?;
    final id = data['notificationId'] as String?;
    if (url != null && url.isNotEmpty) {
      // Only push paths — a full https URL would try to open externally.
      final path = url.startsWith('http') ? Uri.parse(url).path : url;
      if (path.isNotEmpty) router.push(path);
    }
    if (id != null && id.isNotEmpty) {
      try {
        await ref
            .read(customerRepositoryProvider)
            .markNotificationRead(id);
        ref.invalidate(notificationsProvider);
      } catch (_) {
        // Non-fatal: the next inbox open will mark-read anyway.
      }
    }
  });
  ref.onDispose(sub.cancel);
});

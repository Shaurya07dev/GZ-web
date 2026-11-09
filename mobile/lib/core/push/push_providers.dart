import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/account/providers/account_providers.dart'
    show customerRepositoryProvider, notificationsProvider;
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

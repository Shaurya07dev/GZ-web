import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/account/providers/account_providers.dart'
    show customerRepositoryProvider;
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

import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../../data/repositories/customer_repository.dart';

/// Push notifications on mobile via FCM — added 31 Oct 2026 for parity with
/// the server-side FCM infrastructure.
///
/// Standard FCM wiring:
///   1. Firebase.initializeApp() — reads google-services.json / Info.plist
///   2. Ask for notification permission (iOS prompts, Android ≥13 prompts)
///   3. Read the current token and register it with the backend
///   4. Subscribe to onTokenRefresh so a rotated token is re-registered
///
/// This service is deliberately failure-tolerant: if the native config is
/// missing (dev build without google-services.json), every call becomes a
/// no-op and the app still works. The register-with-backend step only runs
/// when there is a signed-in session, so unauthenticated launches don't
/// hit a 401 shouting match with the API.
///
/// Backend endpoints (/v1/account/notifications/devices) and the
/// `pushEnabled` preference are already shipped; this is the device-side
/// half of the loop.
class FcmService {
  FcmService({required this.repository});

  final CustomerRepository repository;
  bool _available = false;
  bool _initialized = false;
  StreamSubscription<String>? _tokenRefreshSub;

  /// True after a successful [initialize]. Call sites can use this to hide
  /// the "push" toggle when the device can't deliver anyway.
  bool get isAvailable => _available;

  /// Boots Firebase + Messaging. Idempotent and never throws into the
  /// caller — a missing google-services.json is normal in dev and reads as
  /// "FCM disabled on this device".
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    try {
      await Firebase.initializeApp();
    } catch (error) {
      debugPrint('FCM: Firebase.initializeApp failed — $error');
      // No native config → silently disabled, same as the server's PushSender.
      return;
    }
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('FCM: notification permission denied by user');
        return;
      }
      _available = true;
      _tokenRefreshSub = messaging.onTokenRefresh.listen(_handleToken);
    } catch (error) {
      debugPrint('FCM: initialize failed — $error');
    }
  }

  /// Reads the current device token and registers it with the backend.
  /// Call when a user signs in; token registration is per-user so an app
  /// that signed-out and signed-in-as-someone-else doesn't deliver pushes
  /// to the previous account.
  Future<void> registerForCurrentUser() async {
    if (!_available) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;
      await _handleToken(token);
    } catch (error) {
      debugPrint('FCM: register failed — $error');
    }
  }

  /// Revokes the device token on the backend (sign-out).
  Future<void> unregisterCurrentDevice() async {
    if (!_available) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;
      await repository.revokeFcmToken(token);
      await FirebaseMessaging.instance.deleteToken();
    } catch (error) {
      debugPrint('FCM: unregister failed — $error');
    }
  }

  Future<void> _handleToken(String token) async {
    try {
      await repository.registerFcmToken(
        token: token,
        platform: _platformName(),
        deviceLabel: _deviceLabel(),
      );
    } catch (error) {
      // A 401 means no session — ignore and let the next sign-in retry.
      debugPrint('FCM: backend register failed — $error');
    }
  }

  String _platformName() {
    if (kIsWeb) return 'web';
    if (Platform.isIOS) return 'ios';
    if (Platform.isAndroid) return 'android';
    return 'web';
  }

  String? _deviceLabel() {
    if (kIsWeb) return 'Web';
    if (Platform.isIOS) return 'iOS';
    if (Platform.isAndroid) return 'Android';
    return null;
  }

  Future<void> dispose() async {
    await _tokenRefreshSub?.cancel();
    _tokenRefreshSub = null;
  }
}

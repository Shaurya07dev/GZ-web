/// One in-app notification — a persistent copy of a transactional event
/// (order shipped, payment received, settlement processed). The web polls
/// `GET /v1/notifications` for the same list; the mobile inbox reads this
/// same shape so a notification seen on either surface is the same row.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    this.url,
  });

  final String id;
  final String title;
  final String body;

  /// A path on the GalleryZone site. The mobile app maps it to an in-app
  /// route when the user taps the row; nulls render as non-tappable.
  final String? url;

  final bool read;
  final String createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
    id: json['id'] as String? ?? '',
    title: json['title'] as String? ?? '',
    body: json['body'] as String? ?? '',
    url: json['url'] as String?,
    read: json['read'] as bool? ?? false,
    createdAt: json['createdAt'] as String? ?? '',
  );
}

class NotificationInbox {
  const NotificationInbox({
    this.items = const [],
    this.unreadCount = 0,
  });

  final List<AppNotification> items;
  final int unreadCount;

  factory NotificationInbox.fromJson(Map<String, dynamic> json) =>
      NotificationInbox(
        items: (json['items'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AppNotification.fromJson)
            .toList(),
        unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      );
}

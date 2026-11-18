import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/router/web_paths.dart';
import 'package:gallery_zone/data/models/notification_inbox.dart';
import 'package:gallery_zone/data/remote/mappers/portal_mappers.dart';

/// What an admin broadcast looks like when it reaches the app: the exact JSON the backend writes
/// (backend/packages/db/src/broadcasts.ts, listed by GET /v1/messages and GET /v1/notifications), read
/// by the app's own mappers, so a message sent from the admin screen is a message in the inbox.
void main() {
  test('a broadcast arrives in Messages as a message from GalleryZone, with its line breaks and its time', () {
    final message = messageThreadFromApi({
      'id': 'bc_b1_artist1',
      'userId': 'artist1',
      'fromLabel': 'GalleryZone',
      'subject': 'Maintenance on Sunday',
      'preview': 'The site is down 2 to 3 am. Please save your work.',
      'body': 'The site is down 2 to 3 am.\nPlease save your work.',
      'unread': true,
      // Firestore timestamps cross the API as {_seconds, _nanoseconds}.
      'receivedAt': {'_seconds': 1763400000, '_nanoseconds': 0},
    });
    expect(message.id, 'bc_b1_artist1');
    expect(message.from, 'GalleryZone');
    expect(message.subject, 'Maintenance on Sunday');
    expect(message.body, 'The site is down 2 to 3 am.\nPlease save your work.');
    expect(message.unread, isTrue);
    expect(DateTime.parse(message.receivedAt).toUtc().year, 2025);
  });

  test('its bell notification opens the right screen, whichever website address the admin chose', () {
    final inbox = NotificationInbox.fromJson({
      'unreadCount': 3,
      'items': [
        {
          'id': 'n1',
          'title': 'Maintenance on Sunday',
          'body': 'x',
          'url': '/dashboard/messages',
          'read': false,
          'createdAt': '2026-11-17T10:00:00.000Z',
        },
        {
          'id': 'n2',
          'title': 'Reservations are open',
          'body': 'x',
          'url': '/aggregator/messages',
          'read': false,
          'createdAt': '2026-11-17T10:00:00.000Z',
        },
        {
          'id': 'n3',
          'title': 'Complete your profile',
          'body': 'x',
          'url': '/aggregator/profile',
          'read': false,
          'createdAt': '2026-11-17T10:00:00.000Z',
        },
      ],
    });
    expect(inbox.unreadCount, 3);
    expect(
      [for (final n in inbox.items) appPathFor(n.url!)],
      [
        '/dashboard/messages',
        '/aggregator/dashboard/messages',
        '/aggregator/dashboard/profile',
      ],
    );
  });
}

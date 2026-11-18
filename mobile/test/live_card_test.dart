import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/data/models/artwork.dart';
import 'package:gallery_zone/features/artist/screens/artist_artworks_screen.dart';

import 'support/catalog_fixtures.dart';

void main() {
  test('a live piece in the artist\'s list opens its public page; a draft or a returned piece does not', () {
    const opens = [
      ArtworkStatus.marketplace,
      ArtworkStatus.reserved,
      ArtworkStatus.withAggregator,
      ArtworkStatus.sold,
      ArtworkStatus.settlementComplete,
      ArtworkStatus.delivered,
      ArtworkStatus.completed,
    ];
    for (final status in ArtworkStatus.values) {
      expect(
        opensPublicPage(fixtureArtwork(status: status)),
        opens.contains(status),
        reason: '$status',
      );
    }
    // Nothing to show yet, or no longer ours to show.
    expect(
      opensPublicPage(fixtureArtwork(status: ArtworkStatus.draft)),
      isFalse,
    );
    expect(
      opensPublicPage(fixtureArtwork(status: ArtworkStatus.pendingApproval)),
      isFalse,
    );
    expect(
      opensPublicPage(fixtureArtwork(status: ArtworkStatus.returned)),
      isFalse,
    );
  });
}

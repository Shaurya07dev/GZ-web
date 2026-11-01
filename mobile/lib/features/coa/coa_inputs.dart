import '../../core/format.dart';
import '../../data/models/artwork.dart';
import '../../data/models/passport.dart';
import 'coa_pdf.dart';
import 'display_card.dart';

/// What the Certificate of Authenticity prints for [artwork], from the same
/// sources everywhere it is made: the artist's COA & NFC board and the public
/// passport. The passport (when it has loaded) is the record: it carries the
/// artist's signature and the number and date the certificate was issued with.
CoaPdfInput coaInputFor(
  Artwork artwork,
  Passport? passport, {
  String ownerName = '',
}) => CoaPdfInput(
  artworkId: artwork.id,
  productCode: passport?.productCode ?? artwork.productCode,
  title: artwork.title,
  artistName: artwork.artistName,
  category: humanize(artwork.category),
  // The regional tradition ("Rajasthan: Phad Painting") is not on the
  // certificate, as it is not on the website's: the Art Form line is one short
  // ruled line, and the tradition would be cut off it. The display card, which
  // has the room, carries it.
  exclusive: artwork.exclusive,
  artistSignatureDataUrl: passport?.artistSignatureDataUrl,
  medium: humanize(artwork.medium),
  dimensions: dimensionsLabel(artwork.dimensions),
  yearCreated: artwork.yearCreated,
  coaCertificateNumber:
      passport?.coaCertificateNumber ?? artwork.coaCertificateNumber,
  coaIssueDate: passport?.coaIssuedAt ?? artwork.coaIssueDate,
  ownerName: ownerName,
);

/// What the "FOR SALE" display card prints for [artwork]: the regional
/// tradition as its art form when it is known, else the category.
DisplayCardInput displayCardInputFor(Artwork artwork, Passport? passport) {
  final type = artwork.artworkType?.trim() ?? '';
  final size = dimensionsLabel(artwork.dimensions);
  return DisplayCardInput(
    artworkId: artwork.id,
    title: artwork.title,
    description: artwork.description,
    artForm: humanize(type.isNotEmpty ? type : artwork.category),
    medium: humanize(artwork.medium),
    size: size.isEmpty ? '—' : size,
    artworkCode: passport?.productCode ?? artwork.productCode ?? artwork.id,
    artistName: artwork.artistName,
  );
}

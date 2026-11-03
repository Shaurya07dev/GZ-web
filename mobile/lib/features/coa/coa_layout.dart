/// Where everything sits on the Certificate of Authenticity's designed artwork
/// (assets/coa/coa-template.png): a port of the website's coa-pdf.ts, so the
/// two certificates are the same one.
///
/// Every position is in the artwork's own pixels, measured off the design, and
/// scaled to wherever it is drawn: the screen and the PDF page alike. Nothing
/// about the design lives in the code, only where each value sits on it.
library;

/// The template's intrinsic pixel size.
const coaTplW = 1280.0;
const coaTplH = 853.0;

/// The PDF page: A4 landscape's width (297 mm), with the template's aspect so
/// nothing is stretched.
const coaPageWidthPt = 841.8897637795276;
const coaPageHeightPt = coaPageWidthPt * coaTplH / coaTplW;

/// Points per template pixel.
const coaPtPerPx = coaPageWidthPt / coaTplW;

/// Where the seven ruled fields' values start, how wide a value may be before
/// it must shrink or be cut, and the baseline each one sits on.
const coaFieldValueX = 366.0;
const coaFieldValueMaxW = 196.0;
const coaFieldBaselines = (
  artistName: 402.0,
  title: 446.0,
  artForm: 487.0,
  medium: 529.0,
  dimensions: 573.0,
  yearCreated: 615.0,
  artworkId: 658.0,
);

/// The bottom-left "DATE OF ISSUE" block: the label is on the template, the
/// value goes under it. The certificate's own number sits quietly below that.
const coaDateCenterX = 233.0;
const coaDateBaseline = 775.0;
const coaCertNoBaseline = 794.0;

/// The blank panel under "VERIFIED THIS ARTWORK", above the "Scan to verify"
/// caption.
const coaQrSize = 170.0;
const coaQrX = 964.0;
const coaQrY = 432.0;

/// The space above the printed "Artist Signature" label. The signature is
/// fitted inside this box keeping its own aspect ratio, so a wide scrawl and a
/// tall one both sit on the line rather than being stretched to fill it.
const coaSigCenterX = 737.0;
const coaSigBottom = 662.0;
const coaSigMaxW = 180.0;
const coaSigMaxH = 62.0;

/// The values' type, in points at the PDF's page width. 12 is the start size of
/// a ruled field, which shrinks no further than 8.
const coaFieldStartPt = 12.0;
const coaFieldMinPt = 8.0;
const coaDatePt = 11.0;
const coaCertNoPt = 8.0;

/// Ink for the values, and the quieter ink of the certificate number.
const coaInk = 0xFF1A1612;
const coaInk2 = 0xFF6E6860;

import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/postal.dart';

void main() {
  test('India is the default and keeps the strict six-digit PIN rule', () {
    expect(postalFormatFor(null).code, 'IN');
    expect(postalFormatFor('in').label, 'PIN code');
    expect(isPostalValid('IN', '560001'), isTrue);
    expect(isPostalValid('IN', '060001'), isFalse);
  });

  test(
    'the mobile formats match the website for international pickup addresses',
    () {
      expect(isPostalValid('US', '94103-1234'), isTrue);
      expect(isPostalValid('GB', 'SW1A 1AA'), isTrue);
      expect(isPostalValid('CA', 'K1A 0B1'), isTrue);
      expect(isPostalValid('AU', '2000'), isTrue);
      expect(isPostalValid('JP', '100-0001'), isTrue);
      expect(isPostalValid('AE', 'PO Box 12345'), isTrue);
      expect(postalFormatFor('CA').maxLength, 7);
    },
  );

  test('an unlisted ISO country gets the same permissive backend fallback', () {
    expect(postalFormatFor('BR').code, 'ZZ');
    expect(isPostalValid('BR', '01310-100'), isTrue);
    expect(isPostalValid('BR', 'x'), isFalse);
    expect(isPostalValid('BR', 'way-too-long-postal-code'), isFalse);
  });
}

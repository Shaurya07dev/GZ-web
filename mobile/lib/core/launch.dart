import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// The public site. The legal documents and the FAQ are native screens now
/// (see `features/legal/`); what still links out is the marketing copy —
/// the landing page, About, Contact and the artist survey.
const galleryZoneSite = 'https://www.galleryzone.in';

/// The app's public contact point, as the web's support pages show it. There
/// is no phone number on purpose: contact is by email.
const galleryZoneEmail = 'galleryzone@zohomail.in';

/// Opens [url] outside the app.
///
/// Every external tap in the app goes through here so the failure path is
/// handled once: a device with no browser, no mail client, or no dialer
/// gets a message instead of a tap that appears to do nothing. Android also
/// needs the matching `<intent>` entries in `AndroidManifest.xml`'s
/// `<queries>` block, or these fail silently on Android 11+.
Future<void> openExternal(BuildContext context, String url) async {
  final messenger = ScaffoldMessenger.of(context);
  // `launchUrl` reports "nothing could handle this" either by returning false
  // or by throwing, depending on the platform — both are the same outcome
  // here.
  var opened = false;
  try {
    opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
  } catch (_) {
    opened = false;
  }
  if (opened) return;
  messenger.showSnackBar(SnackBar(content: Text("Couldn't open $url")));
}

/// The website's step-by-step guide to linking an NFC tag, with a voiceover. It
/// is a page of the site (the same one the artist dashboard offers), so it opens
/// in the app's browser view and any later change to it reaches the app with
/// no update.
const nfcGuideUrl = '$galleryZoneSite/guides/link-nfc.html';

/// Opens [url] in a browser view that sits inside the app (a Custom Tab on
/// Android, a Safari view on iPhone), so a guide can be read and closed without
/// leaving the app. Falls back to the phone's browser, then to a message.
Future<void> openInApp(BuildContext context, String url) async {
  final messenger = ScaffoldMessenger.of(context);
  var opened = false;
  try {
    opened = await launchUrl(Uri.parse(url), mode: LaunchMode.inAppBrowserView);
  } catch (_) {
    opened = false;
  }
  if (opened || !context.mounted) return;
  await openExternal(context, url);
  messenger.hideCurrentSnackBar();
  // openExternal shows its own message if that failed too.
}

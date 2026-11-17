/// The addresses the website uses for screens that live somewhere else in the
/// app. The server writes website paths into notifications, push payloads,
/// emails and broadcasts ("/aggregator/profile", "/dashboard/earnings"), and a
/// tap on one has to land on the matching screen instead of "That page does not
/// exist". Anything not listed is the same address in both.
const _webToApp = <String, String>{
  '/aggregator': '/aggregator/dashboard',
  '/aggregator/profile': '/aggregator/dashboard/profile',
  '/aggregator/messages': '/aggregator/dashboard/messages',
  '/aggregator/support': '/aggregator/dashboard/support',
  // "Wallet" was the website's old name for these two; Earnings is the new one.
  '/aggregator/wallet': '/aggregator/earnings',
  '/dashboard/earnings': '/dashboard/sales',
  '/dashboard/wallet': '/dashboard/sales',
  '/account/wallet': '/account/orders',
};

/// [location] as an in-app address: the website path swapped for its screen in
/// the app, the query string and fragment kept. A location the app already
/// understands comes back unchanged.
String appPathFor(String location) {
  final uri = Uri.tryParse(location);
  if (uri == null || uri.hasScheme || uri.hasAuthority) return location;
  var path = uri.path;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.substring(0, path.length - 1);
  }
  final mapped = _webToApp[path];
  if (mapped == null) return location;
  return uri.replace(path: mapped).toString();
}

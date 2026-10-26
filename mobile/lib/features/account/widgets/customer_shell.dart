import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/motion.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/portal_widgets.dart';
import '../../../data/models/auth.dart';

/// Five real destinations, each its own branch — no drawer-opening special
/// case. Shop is the marketplace, one tap from anywhere: it is what a
/// collector opens the app for, and on the website it sits in the header on
/// every page. "More" is a full screen (see `CustomerMoreScreen`), not a
/// slide-out drawer, so everything the web keeps in its sidebar (Collection,
/// Addresses, Resell, Support, FAQs, About) is one tap from a tab rather than
/// living behind the avatar.
const shellDestinations = <ShellDestination>[
  ShellDestination(icon: LucideIcons.layoutGrid, label: 'Account'),
  ShellDestination(icon: LucideIcons.store, label: 'Shop'),
  ShellDestination(icon: LucideIcons.shoppingBag, label: 'Orders'),
  ShellDestination(icon: LucideIcons.heart, label: 'Saved'),
  ShellDestination(icon: LucideIcons.menu, label: 'More'),
];

/// The Shop tab: the marketplace inside the collector's shell. A collector's
/// "browse the marketplace" links come here, so the tabs stay underneath.
const customerShopPath = '/account/shop';

/// Where "browse the marketplace" takes [role]: a collector's own Shop tab,
/// anyone else the public marketplace.
String marketplaceFor(Role? role) =>
    role == Role.customer ? customerShopPath : '/marketplace';

/// The customer's root shell. Branch state (scroll position, selected tab)
/// survives resize because `StatefulShellRoute.indexedStack` keeps each
/// branch's navigator alive — the navigation *surface* swaps by width, the
/// content does not rebuild from scratch.
///
/// - compact (<600): bottom `NavigationBar`
/// - medium (600-839): `NavigationRail`, icons + labels
/// - expanded (>=840): extended `NavigationRail`
class CustomerShell extends ConsumerWidget {
  const CustomerShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _goBranch(int index) {
    HapticFeedback.selectionClick();
    navigationShell.goBranch(
      index,
      // Tapping the active tab returns to that branch's first route.
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final size = WindowSize.of(context);
    final body = BranchFade(
      index: navigationShell.currentIndex,
      child: navigationShell,
    );

    if (size.isCompact) {
      return Scaffold(
        body: body,
        bottomNavigationBar: ShellNavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: _goBranch,
          destinations: shellDestinations,
        ),
      );
    }

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: _goBranch,
            extended: size.isExpanded,
            labelType: size.isExpanded ? null : NavigationRailLabelType.all,
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                size.isExpanded ? 'GALLERYZONE' : 'GZ',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.tertiary,
                  letterSpacing: 2,
                ),
              ),
            ),
            destinations: [
              for (final destination in shellDestinations)
                NavigationRailDestination(
                  icon: Icon(destination.icon),
                  label: Text(destination.label),
                ),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: body),
        ],
      ),
    );
  }
}

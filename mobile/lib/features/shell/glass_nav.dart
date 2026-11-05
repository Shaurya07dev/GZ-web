import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/motion.dart';
import 'portal_widgets.dart' show ShellDestination;

/// A floating, pill-shaped bottom navigation bar with a frosted-glass look.
///
/// Built to the owner-supplied reference 5 Nov 2026: a translucent rounded
/// container that blurs whatever's behind it, a raised "pill" circle behind
/// the selected destination's icon, and an optional separate circular FAB
/// that floats above the bar for a primary action (search on the collector
/// shell, upload on the artist shell, etc).
///
/// Theme-agnostic: every colour is read from the active [ColorScheme] so
/// this works unchanged in light and dark. No new palette.
class GlassNavBar extends StatelessWidget {
  const GlassNavBar({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.destinations,
    this.floatingAction,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<ShellDestination> destinations;

  /// A separate circular button that floats above and to the right of the
  /// pill — the shell's primary action (search / upload / compose). Null
  /// hides the FAB entirely.
  final GlassNavAction? floatingAction;

  @override
  Widget build(BuildContext context) {
    final mediaPadding = MediaQuery.paddingOf(context).bottom;
    // The pill sits above the system gesture bar on Android and above the
    // home indicator on iPhones. `max` keeps a sensible gap on devices with
    // no bottom inset so it never hugs the bottom edge of the screen.
    final bottomInset = mediaPadding > 0 ? mediaPadding : 12.0;

    return SafeArea(
      top: false,
      left: false,
      right: false,
      // The nav is drawn by the shell inside `bottomNavigationBar`, which
      // already reserves vertical space; we add our own bottom padding
      // inside instead of trusting the Scaffold's.
      minimum: EdgeInsets.zero,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, bottomInset),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.bottomRight,
          children: [
            _NavPill(
              selectedIndex: selectedIndex,
              onDestinationSelected: onDestinationSelected,
              destinations: destinations,
            ),
            if (floatingAction != null)
              Positioned(
                // The FAB sits above the pill's right edge, overlapping it
                // slightly so the two read as one unit — not as a stray
                // button lost in the margin.
                right: 4,
                bottom: 44,
                child: _GlassFab(action: floatingAction!),
              ),
          ],
        ),
      ),
    );
  }
}

/// The primary action the floating FAB performs. Callers pass this in rather
/// than building the FAB themselves — keeps every shell's FAB visually
/// identical (same size, same glow, same haptic) with just icon + callback
/// varying.
class GlassNavAction {
  const GlassNavAction({
    required this.icon,
    required this.onPressed,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;
}

class _NavPill extends StatelessWidget {
  const _NavPill({
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.destinations,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<ShellDestination> destinations;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Pull the pill colour straight from the theme. 0.72 gives enough
    // translucency to see the blur through it without washing out the icons
    // on bright wallpapers behind.
    final pillColor = scheme.surface.withValues(alpha: 0.72);
    final borderColor = scheme.outline.withValues(alpha: 0.28);
    final shadow = Colors.black.withValues(alpha: 0.18);

    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          decoration: BoxDecoration(
            color: pillColor,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: borderColor, width: 1),
            boxShadow: [
              BoxShadow(
                color: shadow,
                blurRadius: 18,
                spreadRadius: -2,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < destinations.length; i++)
                Expanded(
                  child: _NavItem(
                    destination: destinations[i],
                    selected: i == selectedIndex,
                    onTap: () => onDestinationSelected(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final ShellDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final labelColor = selected ? scheme.tertiary : scheme.onSurfaceVariant;
    final motion = motionOf(context);

    return Semantics(
      selected: selected,
      button: true,
      label: destination.label,
      child: InkWell(
        onTap: () {
          if (!selected) HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(32),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // The raised "pill" behind the active icon. Fades + scales in
              // so switching tabs feels like the circle has slid under the
              // icon rather than popped.
              AnimatedContainer(
                duration: motion ? const Duration(milliseconds: 220) : Duration.zero,
                curve: Curves.easeOutCubic,
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected
                      ? scheme.tertiary.withValues(alpha: 0.18)
                      : Colors.transparent,
                  boxShadow: selected
                      ? [
                          BoxShadow(
                            color: scheme.tertiary.withValues(alpha: 0.25),
                            blurRadius: 10,
                            spreadRadius: -2,
                          ),
                        ]
                      : null,
                ),
                child: Icon(
                  destination.icon,
                  size: 20,
                  color: selected ? scheme.tertiary : scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 3),
              AnimatedDefaultTextStyle(
                duration: motion ? const Duration(milliseconds: 220) : Duration.zero,
                style: TextStyle(
                  fontSize: 10,
                  height: 1.1,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  color: labelColor,
                  letterSpacing: 0.1,
                ),
                child: Text(
                  destination.label,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GlassFab extends StatelessWidget {
  const _GlassFab({required this.action});

  final GlassNavAction action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // The FAB uses the brand's gold as its fill — matches the active-tab
    // pill tint so the eye reads one accent colour, not two.
    return Semantics(
      label: action.tooltip ?? 'Primary action',
      button: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            HapticFeedback.selectionClick();
            action.onPressed();
          },
          borderRadius: BorderRadius.circular(999),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  scheme.tertiary,
                  scheme.tertiary.withValues(alpha: 0.86),
                ],
              ),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.18),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: scheme.tertiary.withValues(alpha: 0.35),
                  blurRadius: 18,
                  spreadRadius: -2,
                  offset: const Offset(0, 6),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              action.icon,
              size: 22,
              color: scheme.onTertiary,
            ),
          ),
        ),
      ),
    );
  }
}

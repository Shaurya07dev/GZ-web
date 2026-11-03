import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// A printed paper, shown whole on the page with a way to look closer: on a
/// phone its small type is a picture until you zoom, so tapping opens it
/// full screen to pinch and pan. [enlarged] is what the full-screen view
/// shows, when that is not the same widget as [child].
class ZoomablePaper extends StatelessWidget {
  const ZoomablePaper({
    super.key,
    required this.title,
    required this.child,
    this.enlarged,
  });

  final String title;
  final Widget child;
  final Widget? enlarged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          button: true,
          label: 'Enlarge $title',
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => showPaperViewer(
              context,
              title: title,
              paper: enlarged ?? child,
            ),
            // A hairline, like the app's other cards, not a shadow: the paper
            // is already the heaviest thing on the page.
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: theme.colorScheme.outline),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.md - 1),
                child: child,
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              LucideIcons.maximize2,
              size: 12,
              color: theme.textTheme.bodySmall?.color,
            ),
            const SizedBox(width: 6),
            Text('Tap to enlarge', style: theme.textTheme.labelSmall),
          ],
        ),
      ],
    );
  }
}

/// The paper full screen, on black, to pinch and pan.
Future<void> showPaperViewer(
  BuildContext context, {
  required String title,
  required Widget paper,
}) {
  return Navigator.of(context).push(
    MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          title: Text(title),
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: InteractiveViewer(
                  minScale: 1,
                  maxScale: 6,
                  child: Center(child: paper),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'Pinch to zoom',
                  style: TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

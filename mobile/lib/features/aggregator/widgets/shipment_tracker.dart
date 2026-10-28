import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/artist_portal.dart';

/// The four courier milestones that ShipRocket writes back to GalleryZone.
///
/// This intentionally does not guess a stage from the portal's own shipment
/// status: until the ShipRocket webhook supplies a stage, the honest state is
/// that a courier booking/tracking event has not reached GalleryZone yet.
class ShipmentTracker extends StatelessWidget {
  const ShipmentTracker({
    super.key,
    required this.stage,
    this.trackingId,
    this.carrier,
  });

  final ShiprocketStage? stage;
  final String? trackingId;
  final String? carrier;

  static const _stages = ShiprocketStage.values;

  static const _labels = <ShiprocketStage, String>{
    ShiprocketStage.pickup: 'Pickup',
    ShiprocketStage.inTransit: 'In transit',
    ShiprocketStage.outForDelivery: 'Out for delivery',
    ShiprocketStage.delivered: 'Delivered',
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final current = stage;
    if (current == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(
            alpha: 0.35,
          ),
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: theme.colorScheme.outline),
        ),
        child: Row(
          children: [
            Icon(
              LucideIcons.packageSearch,
              size: 15,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Shipment not booked yet',
                style: theme.textTheme.labelMedium,
              ),
            ),
          ],
        ),
      );
    }

    final currentIndex = _stages.indexOf(current);
    final cleanCarrier = carrier?.trim() ?? '';
    final cleanTrackingId = trackingId?.trim() ?? '';
    final reference = [
      if (cleanCarrier.isNotEmpty) cleanCarrier,
      if (cleanTrackingId.isNotEmpty) 'AWB $cleanTrackingId',
    ].join(' · ');
    final accent = current == ShiprocketStage.delivered
        ? const Color(0xFF34D399)
        : theme.colorScheme.tertiary;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                current == ShiprocketStage.delivered
                    ? LucideIcons.packageCheck
                    : LucideIcons.truck,
                size: 15,
                color: accent,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _labels[current]!,
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (var index = 0; index < _stages.length; index++) ...[
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: index <= currentIndex
                        ? accent
                        : theme.colorScheme.outline,
                  ),
                ),
                if (index < _stages.length - 1)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: index < currentIndex
                          ? accent
                          : theme.colorScheme.outline,
                    ),
                  ),
              ],
            ],
          ),
          if (reference.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              reference,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../providers/account_providers.dart';
import '../screens/cart_screen.dart';

/// Cart icon with item-count badge, dropped into any customer AppBar.actions.
///
/// 8 Nov 2026 — client reported that the cart screen existed but had no
/// entry point anywhere in the app, which left "Add to cart" on artwork
/// detail as a dead end. Ecommerce convention is a cart action in every
/// top-level screen's app bar, badged with the count — Amazon, Flipkart,
/// Shopify and every variant do it this way.
class CartAction extends ConsumerWidget {
  const CartAction({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final count = cart.value?.count ?? 0;
    final theme = Theme.of(context);
    return IconButton(
      tooltip: 'Cart',
      onPressed: () => context.push(CartScreen.path),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(LucideIcons.shoppingCart),
          if (count > 0)
            Positioned(
              right: -6,
              top: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.tertiary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  count > 9 ? '9+' : '$count',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onPrimary,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

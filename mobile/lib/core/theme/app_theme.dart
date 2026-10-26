import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Brand tokens ported from `frontend-web/app/globals.css` (Tailwind v4
/// CSS-first config — that file is the single source of truth, not this
/// comment). Dark is the product's hard default (`next-themes` with
/// `enableSystem: false`), light exists and must stay fully usable.
class AppColors {
  const AppColors._();

  static const darkBackground = Color(0xFF0B0A08);
  static const darkForeground = Color(0xFFF1ECE0);
  static const darkCard = Color(0xFF141209);
  static const darkSecondary = Color(0xFF1C1A12);
  static const darkMuted = Color(0xFF17150E);
  static const darkMutedForeground = Color(0xFF9C9686);
  static const darkGold = Color(0xFFC89A4A);
  static const darkGoldBright = Color(0xFFE9C57A);
  static const darkGoldDeep = Color(0xFF8A6423);
  static const darkBorder = Color(
    0xFF211F1B,
  ); // foreground ~10% over background

  // Warm Greige (website, 10 Sep 2026): the light palette moved from cream to
  // a calmer stone, with the card now a shade darker than the page.
  static const lightBackground = Color(0xFFF3EFE9);
  static const lightForeground = Color(0xFF211E18);
  static const lightCard = Color(0xFFEAE6DF);
  static const lightSecondary = Color(0xFFE2DDD6);
  static const lightMuted = Color(0xFFE5E0D9);
  // One step darker than the website's #867E74: that grey reads 3.6:1 on the
  // page, under the 4.5:1 small text needs on a phone held at arm's length.
  static const lightMutedForeground = Color(0xFF6F675D);
  static const lightGold = Color(0xFFA9782C);
  static const lightGoldBright = Color(0xFF8A6423);
  static const lightGoldDeep = Color(0xFF6E4F1B);
  static const lightBorder = Color(
    0xFFD8D4CE,
  ); // foreground ~13% over background

  static const destructive = Color(
    0xFFDC5B4A,
  ); // oklch(0.577 0.245 27.325), same both themes

  /// Text on a gold fill: the same near-black in both themes, as on the
  /// website.
  static const onGold = Color(0xFF171310);
}

/// Single proportional radius scale, base 12 — every other value is that
/// times a fixed multiplier (`globals.css` `--radius-*` tokens).
class AppRadius {
  const AppRadius._();

  static const double base = 12.0;
  static const double sm = base * 0.6; // 7.2
  static const double md = base * 0.8; // 9.6
  static const double lg = base; // 12
  static const double xl = base * 1.4; // 16.8
  static const double xl2 = base * 1.8; // 21.6
  static const double xl3 = base * 2.2; // 26.4
  static const double xl4 = base * 2.6; // 31.2 (full pill on badges/switches)
}

/// The app's motion vocabulary. Every duration and curve in the UI comes from
/// here, so the whole app moves with one rhythm: quick for feedback, a beat
/// longer for things arriving, never slow enough to wait on.
class AppMotion {
  const AppMotion._();

  /// Press feedback, toggles, colour changes.
  static const fast = Duration(milliseconds: 150);

  /// Something on the page changing state: a panel swapping, a count moving.
  static const medium = Duration(milliseconds: 280);

  /// Something arriving: content after a load, a tab's page, a sheet.
  static const slow = Duration(milliseconds: 420);

  /// Material 3's emphasized decelerate: a confident start that settles
  /// gently. The curve for anything entering.
  static const enter = Cubic(0.05, 0.7, 0.1, 1.0);

  /// Material 3's standard easing, for things moving between two states.
  static const standard = Cubic(0.2, 0.0, 0.0, 1.0);
}

class AppTheme {
  const AppTheme._();

  static const sansFamily = 'Inter';
  static const serifFamily = 'Playfair Display';

  /// Playfair carries the editorial voice (titles, headlines, big numbers);
  /// Inter carries everything read at small sizes. Both are bundled (see the
  /// `fonts:` block in pubspec.yaml), every weight under one family, so a
  /// `copyWith(fontWeight: w600)` gets the real SemiBold face and nothing
  /// waits on a download.
  ///
  /// Sizes and line heights are Material's own, so layouts measured against
  /// them stay put — what changes is weight, tracking (Inter wants it tighter
  /// than Roboto's defaults), and Playfair's figures, which default to
  /// old-style numerals that drop below the line: "₹1,30,750" in a stat looked
  /// like a typo.
  static TextTheme _textTheme(Color foreground, Color muted) {
    const lining = [FontFeature.liningFigures()];
    // (size, line height) pairs are Material 3's type scale.
    TextStyle serif(
      double size,
      double line,
      FontWeight weight,
      double track,
    ) => TextStyle(
      fontFamily: serifFamily,
      fontSize: size,
      height: line / size,
      fontWeight: weight,
      letterSpacing: track,
      color: foreground,
      fontFeatures: lining,
      leadingDistribution: TextLeadingDistribution.even,
    );
    TextStyle sans(
      double size,
      double line,
      FontWeight weight,
      double track, [
      Color? color,
    ]) => TextStyle(
      fontFamily: sansFamily,
      fontSize: size,
      height: line / size,
      fontWeight: weight,
      letterSpacing: track,
      color: color ?? foreground,
      leadingDistribution: TextLeadingDistribution.even,
    );
    return TextTheme(
      displayLarge: serif(57, 64, FontWeight.w400, -1.2),
      displayMedium: serif(45, 52, FontWeight.w400, -0.8),
      displaySmall: serif(36, 44, FontWeight.w400, -0.5),
      headlineLarge: serif(32, 40, FontWeight.w400, -0.5),
      headlineMedium: serif(28, 36, FontWeight.w400, -0.4),
      headlineSmall: serif(24, 32, FontWeight.w400, -0.2),
      titleLarge: serif(22, 28, FontWeight.w500, -0.1),
      titleMedium: sans(16, 24, FontWeight.w600, -0.15),
      titleSmall: sans(14, 20, FontWeight.w600, -0.1),
      bodyLarge: sans(16, 24, FontWeight.w400, -0.15),
      bodyMedium: sans(14, 20, FontWeight.w400, -0.1),
      bodySmall: sans(12, 16, FontWeight.w400, 0, muted),
      labelLarge: sans(14, 20, FontWeight.w600, 0),
      labelMedium: sans(12, 16, FontWeight.w500, 0.1),
      labelSmall: sans(11, 16, FontWeight.w500, 0.2),
    );
  }

  static ThemeData get dark {
    const scheme = ColorScheme(
      brightness: Brightness.dark,
      surface: AppColors.darkBackground,
      onSurface: AppColors.darkForeground,
      onSurfaceVariant: AppColors.darkMutedForeground,
      surfaceDim: AppColors.darkBackground,
      surfaceBright: Color(0xFF2A2720),
      surfaceContainerLowest: Color(0xFF070605),
      surfaceContainerLow: Color(0xFF100E0A),
      surfaceContainer: AppColors.darkCard,
      surfaceContainerHigh: AppColors.darkSecondary,
      surfaceContainerHighest: Color(0xFF24211A),
      primary: AppColors.darkGold,
      onPrimary: AppColors.darkBackground,
      primaryContainer: Color(0xFF3A2C14),
      onPrimaryContainer: Color(0xFFF0D9A8),
      secondary: AppColors.darkSecondary,
      onSecondary: AppColors.darkForeground,
      secondaryContainer: Color(0xFF3A2C14),
      onSecondaryContainer: Color(0xFFF0D9A8),
      // `tertiary` carries the brand's gold-bright accent (links, icon
      // glyphs, active toggles) — the reference design's second gold, which
      // Material's scheme has no dedicated slot for. Reusing an existing
      // ColorScheme role instead of a ThemeExtension keeps it reachable as
      // plain `colorScheme.tertiary` everywhere.
      tertiary: AppColors.darkGoldBright,
      onTertiary: AppColors.darkBackground,
      tertiaryContainer: Color(0xFF3A2C14),
      onTertiaryContainer: Color(0xFFF0D9A8),
      error: AppColors.destructive,
      onError: Colors.white,
      errorContainer: Color(0xFF4A1A14),
      onErrorContainer: Color(0xFFF8C9C1),
      outline: AppColors.darkBorder,
      outlineVariant: Color(0xFF1A1814),
      inverseSurface: AppColors.darkForeground,
      onInverseSurface: AppColors.darkCard,
      inversePrimary: AppColors.lightGold,
      shadow: Colors.black,
      scrim: Colors.black,
      // No tint on raised surfaces: Material would wash every scrolled app
      // bar and sheet in gold.
      surfaceTint: Colors.transparent,
    );
    return _build(
      scheme,
      AppColors.darkCard,
      AppColors.darkMuted,
      AppColors.darkForeground,
      AppColors.darkMutedForeground,
    );
  }

  static ThemeData get light {
    // Every Material 3 role spelled out. Left unset, ColorScheme falls back to
    // its oldest defaults — dividers drawn in the text colour, placeholders the
    // same colour as the page, a grey pill under the selected tab — which is
    // most of why the app looked like a stock template.
    const scheme = ColorScheme(
      brightness: Brightness.light,
      surface: AppColors.lightBackground,
      onSurface: AppColors.lightForeground,
      onSurfaceVariant: AppColors.lightMutedForeground,
      surfaceDim: AppColors.lightSecondary,
      surfaceBright: Color(0xFFFBF9F5),
      surfaceContainerLowest: Color(0xFFFBF9F5),
      surfaceContainerLow: Color(0xFFEFEBE4),
      surfaceContainer: AppColors.lightCard,
      surfaceContainerHigh: AppColors.lightMuted,
      surfaceContainerHighest: AppColors.lightSecondary,
      primary: AppColors.lightGold,
      onPrimary: AppColors.onGold,
      primaryContainer: Color(0xFFEBDDC6),
      onPrimaryContainer: Color(0xFF4D3610),
      secondary: AppColors.lightSecondary,
      onSecondary: AppColors.lightForeground,
      secondaryContainer: Color(0xFFEBDDC6),
      onSecondaryContainer: Color(0xFF4D3610),
      tertiary: AppColors.lightGoldBright,
      onTertiary: Color(0xFFFBF9F5),
      tertiaryContainer: Color(0xFFEBDDC6),
      onTertiaryContainer: Color(0xFF4D3610),
      error: AppColors.destructive,
      onError: Colors.white,
      errorContainer: Color(0xFFF8DDD8),
      onErrorContainer: Color(0xFF6E1A10),
      outline: AppColors.lightBorder,
      outlineVariant: AppColors.lightSecondary,
      inverseSurface: Color(0xFF2A2620),
      onInverseSurface: AppColors.lightBackground,
      inversePrimary: AppColors.darkGoldBright,
      // Shadows take the page's warmth instead of falling as flat grey.
      shadow: Color(0xFF3B2A14),
      scrim: Colors.black,
      surfaceTint: Colors.transparent,
    );
    return _build(
      scheme,
      AppColors.lightCard,
      AppColors.lightMuted,
      AppColors.lightForeground,
      AppColors.lightMutedForeground,
    );
  }

  /// Status and navigation bars: transparent, drawn over by the app, with
  /// icons that read on the page behind them.
  static SystemUiOverlayStyle overlayStyleFor(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    return SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
      statusBarBrightness: brightness,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: dark
          ? Brightness.light
          : Brightness.dark,
      systemNavigationBarContrastEnforced: false,
    );
  }

  static ThemeData _build(
    ColorScheme scheme,
    Color card,
    Color muted,
    Color foreground,
    Color mutedForeground,
  ) {
    final text = _textTheme(foreground, mutedForeground);
    final buttonText = text.labelLarge!;
    final controlShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.lg),
    );
    // Pressed buttons darken by a touch rather than flooding with a ripple.
    WidgetStateProperty<Color?> pressOverlay(Color color) =>
        WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.pressed)
              ? color.withValues(alpha: 0.12)
              : states.contains(WidgetState.hovered) ||
                    states.contains(WidgetState.focused)
              ? color.withValues(alpha: 0.06)
              : null,
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      canvasColor: scheme.surface,
      textTheme: text,
      // A soft, round ripple. The default sparkle reads as noise on a calm,
      // paper-coloured page.
      splashFactory: InkRipple.splashFactory,
      splashColor: foreground.withValues(alpha: 0.06),
      highlightColor: foreground.withValues(alpha: 0.04),
      hoverColor: foreground.withValues(alpha: 0.03),
      dividerColor: scheme.outlineVariant,
      appBarTheme: AppBarThemeData(
        backgroundColor: scheme.surface,
        foregroundColor: foreground,
        elevation: 0,
        // Content sliding under the bar gets a hairline shadow, not a tint.
        scrolledUnderElevation: 0.6,
        shadowColor: scheme.shadow.withValues(alpha: 0.35),
        surfaceTintColor: Colors.transparent,
        titleSpacing: 20,
        titleTextStyle: text.titleLarge,
        iconTheme: IconThemeData(color: foreground, size: 22),
        actionsIconTheme: IconThemeData(color: foreground, size: 22),
        systemOverlayStyle: overlayStyleFor(scheme.brightness),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        elevation: 0,
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.primary.withValues(alpha: 0.16),
        indicatorShape: const StadiumBorder(),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        overlayColor: WidgetStateProperty.all(Colors.transparent),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 22,
            color: states.contains(WidgetState.selected)
                ? scheme.tertiary
                : mutedForeground,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => text.labelSmall!.copyWith(
            fontSize: 11.5,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? foreground
                : mutedForeground,
          ),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: scheme.surface,
        indicatorColor: scheme.primary.withValues(alpha: 0.16),
        indicatorShape: const StadiumBorder(),
        selectedIconTheme: IconThemeData(color: scheme.tertiary, size: 22),
        unselectedIconTheme: IconThemeData(color: mutedForeground, size: 22),
        selectedLabelTextStyle: text.labelMedium!.copyWith(
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelTextStyle: text.labelMedium!.copyWith(
          color: mutedForeground,
        ),
      ),
      // Cards carry no border in the reference design — a subtle ring
      // (`ring-1 ring-foreground/10`) stands in for one, via a hairline
      // outline instead of elevation shadow.
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          side: BorderSide(color: scheme.outline, width: 1),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 12,
        shadowColor: scheme.shadow.withValues(alpha: 0.25),
        titleTextStyle: text.headlineSmall,
        contentTextStyle: text.bodyMedium?.copyWith(
          height: 1.5,
          color: foreground.withValues(alpha: 0.85),
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl3),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surfaceContainerLowest,
        modalBackgroundColor: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        modalElevation: 16,
        shadowColor: scheme.shadow.withValues(alpha: 0.3),
        showDragHandle: true,
        dragHandleColor: scheme.outline,
        dragHandleSize: const Size(36, 4),
        clipBehavior: Clip.antiAlias,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onInverseSurface,
          fontWeight: FontWeight.w500,
        ),
        actionTextColor: scheme.inversePrimary,
        elevation: 8,
        insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 10,
        shadowColor: scheme.shadow.withValues(alpha: 0.3),
        textStyle: text.bodyMedium,
        labelTextStyle: WidgetStateProperty.all(text.bodyMedium),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
          side: BorderSide(color: scheme.outline.withValues(alpha: 0.6)),
        ),
      ),
      menuTheme: MenuThemeData(
        style: MenuStyle(
          backgroundColor: WidgetStateProperty.all(
            scheme.surfaceContainerLowest,
          ),
          surfaceTintColor: WidgetStateProperty.all(Colors.transparent),
          shape: WidgetStateProperty.all(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.xl),
            ),
          ),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.tertiary,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20),
        titleTextStyle: text.bodyLarge?.copyWith(fontWeight: FontWeight.w500),
        subtitleTextStyle: text.bodySmall,
        minVerticalPadding: 12,
        shape: controlShape,
      ),
      expansionTileTheme: ExpansionTileThemeData(
        iconColor: scheme.tertiary,
        collapsedIconColor: mutedForeground,
        shape: const Border(),
        collapsedShape: const Border(),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 48),
          // Height comes from minimumSize, not padding, so a button squeezed
          // into a fixed slot keeps its label centred instead of clipped.
          padding: const EdgeInsets.symmetric(horizontal: 20),
          textStyle: buttonText,
          elevation: 0,
          shape: controlShape,
          disabledBackgroundColor: foreground.withValues(alpha: 0.08),
          disabledForegroundColor: foreground.withValues(alpha: 0.38),
        ).copyWith(overlayColor: pressOverlay(scheme.onPrimary)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(0, 48),
          // Height comes from minimumSize, not padding, so a button squeezed
          // into a fixed slot keeps its label centred instead of clipped.
          padding: const EdgeInsets.symmetric(horizontal: 20),
          textStyle: buttonText,
          backgroundColor: scheme.surfaceContainerLowest,
          foregroundColor: foreground,
          elevation: 1,
          shadowColor: scheme.shadow.withValues(alpha: 0.3),
          shape: controlShape,
        ).copyWith(overlayColor: pressOverlay(foreground)),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style:
            OutlinedButton.styleFrom(
              minimumSize: const Size(0, 48),
              // Height comes from minimumSize, not padding, so a button squeezed
              // into a fixed slot keeps its label centred instead of clipped.
              padding: const EdgeInsets.symmetric(horizontal: 20),
              textStyle: buttonText,
              foregroundColor: foreground,
              shape: controlShape,
            ).copyWith(
              overlayColor: pressOverlay(foreground),
              side: WidgetStateProperty.resolveWith(
                (states) => BorderSide(
                  color: states.contains(WidgetState.disabled)
                      ? scheme.outline.withValues(alpha: 0.5)
                      : states.contains(WidgetState.pressed)
                      ? scheme.primary
                      : Color.alphaBlend(
                          foreground.withValues(alpha: 0.08),
                          scheme.outline,
                        ),
                ),
              ),
            ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: scheme.tertiary,
          textStyle: buttonText,
          shape: controlShape,
        ).copyWith(overlayColor: pressOverlay(scheme.tertiary)),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          highlightColor: foreground.withValues(alpha: 0.08),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        elevation: 2,
        highlightElevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          selectedBackgroundColor: scheme.primary.withValues(alpha: 0.16),
          selectedForegroundColor: foreground,
          foregroundColor: mutedForeground,
          side: BorderSide(color: scheme.outline),
          textStyle: text.labelLarge,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: card,
        selectedColor: scheme.primary.withValues(alpha: 0.18),
        disabledColor: muted,
        checkmarkColor: scheme.tertiary,
        side: BorderSide(color: scheme.outline),
        shape: const StadiumBorder(),
        labelStyle: text.labelLarge?.copyWith(
          fontWeight: FontWeight.w500,
          color: foreground,
        ),
        secondaryLabelStyle: text.labelLarge,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        surfaceTintColor: Colors.transparent,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: foreground,
        unselectedLabelColor: mutedForeground,
        labelStyle: text.labelLarge,
        unselectedLabelStyle: text.labelLarge?.copyWith(
          fontWeight: FontWeight.w500,
        ),
        indicatorColor: scheme.primary,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: scheme.outlineVariant,
        overlayColor: WidgetStateProperty.all(Colors.transparent),
        splashFactory: NoSplash.splashFactory,
      ),
      // Inputs match the reference's `Input` primitive: filled card
      // surface, hairline ring, gold ring on focus — no Material underline.
      inputDecorationTheme: InputDecorationThemeData(
        filled: true,
        fillColor: card,
        hintStyle: text.bodyLarge?.copyWith(
          color: mutedForeground.withValues(alpha: 0.85),
        ),
        labelStyle: text.bodyMedium?.copyWith(color: mutedForeground),
        floatingLabelStyle: text.bodyMedium?.copyWith(color: scheme.tertiary),
        helperStyle: text.bodySmall,
        errorStyle: text.bodySmall?.copyWith(color: scheme.error),
        prefixIconColor: mutedForeground,
        suffixIconColor: mutedForeground,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.error, width: 1.5),
        ),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: scheme.primary,
        selectionColor: scheme.primary.withValues(alpha: 0.28),
        selectionHandleColor: scheme.primary,
      ),
      checkboxTheme: CheckboxThemeData(
        side: BorderSide(color: scheme.outline, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? scheme.primary
              : Colors.transparent,
        ),
        checkColor: WidgetStateProperty.all(scheme.onPrimary),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? scheme.primary
              : mutedForeground,
        ),
      ),
      badgeTheme: BadgeThemeData(
        backgroundColor: scheme.primary,
        textColor: scheme.onPrimary,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? scheme.surfaceContainerLowest
              : mutedForeground,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? scheme.primary : muted,
        ),
        trackOutlineColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.transparent
              : scheme.outline,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHighest,
        circularTrackColor: Colors.transparent,
        refreshBackgroundColor: scheme.surfaceContainerLowest,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: scheme.primary,
        inactiveTrackColor: scheme.surfaceContainerHighest,
        thumbColor: scheme.primary,
        overlayColor: scheme.primary.withValues(alpha: 0.12),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: scheme.inverseSurface,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        textStyle: text.labelMedium?.copyWith(color: scheme.onInverseSurface),
        waitDuration: const Duration(milliseconds: 400),
      ),
      scrollbarTheme: ScrollbarThemeData(
        radius: const Radius.circular(8),
        thickness: WidgetStateProperty.all(4),
        thumbColor: WidgetStateProperty.all(foreground.withValues(alpha: 0.25)),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../artwork_form_data.dart';

/// What the picker hands back: the chosen type's value (`other` for the free
/// text option), or null when the artist cleared their choice. Dismissing the
/// sheet returns nothing at all, so "no change" and "cleared" stay different.
class ArtworkTypePick {
  const ArtworkTypePick(this.value);

  final String? value;
}

/// "Type of artwork": the 28 Indian traditions by state, the 97 world art forms
/// and "Other", as one searchable sheet. Port of the website's grouped type
/// combobox; a bottom sheet is the native way to pick from a list this long.
Future<ArtworkTypePick?> showArtworkTypePicker(
  BuildContext context, {
  required String selected,
}) {
  return showModalBottomSheet<ArtworkTypePick>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (context) => _ArtworkTypeSheet(selected: selected),
  );
}

const _groupHeading = {
  ArtworkTypeGroup.india: 'Indian art, by state',
  ArtworkTypeGroup.world: 'World art forms',
};

class _ArtworkTypeSheet extends StatefulWidget {
  const _ArtworkTypeSheet({required this.selected});

  final String selected;

  @override
  State<_ArtworkTypeSheet> createState() => _ArtworkTypeSheetState();
}

class _ArtworkTypeSheetState extends State<_ArtworkTypeSheet> {
  String _query = '';

  /// Choosing the type that is already chosen clears it, as on the website.
  void _choose(String value) {
    Navigator.of(context)
        .pop(ArtworkTypePick(widget.selected == value ? null : value));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final query = _query.trim().toLowerCase();
    final matches = [
      for (final option in artworkTypeOptions)
        if (option.group != ArtworkTypeGroup.other &&
            (query.isEmpty ||
                option.label.toLowerCase().contains(query) ||
                option.keywords.toLowerCase().contains(query)))
          option,
    ];
    final other = artworkTypeOptions.last;

    // Section headings only for the groups that have something to show.
    final rows = <Widget>[];
    ArtworkTypeGroup? current;
    for (final option in matches) {
      if (option.group != current) {
        current = option.group;
        rows.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            child: Text(
              _groupHeading[current]!.toUpperCase(),
              style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 1.2),
            ),
          ),
        );
      }
      rows.add(
        _TypeTile(
          title: option.label,
          subtitle: option.keywords.isEmpty ? null : option.keywords,
          selected: widget.selected == option.value,
          onTap: () => _choose(option.value),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.78,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  autofocus: false,
                  onChanged: (value) => setState(() => _query = value),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(LucideIcons.search, size: 16),
                    hintText: 'Search tradition, state, region...',
                  ),
                ),
              ),
              Expanded(
                child: rows.isEmpty
                    ? Align(
                        alignment: Alignment.topLeft,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                          child: Text(
                            'No matching type.',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                      )
                    : ListView(children: rows),
              ),
              // Pinned, not the last of a hundred and twenty-five: someone whose
              // tradition is not in the list should not have to scroll to say so.
              const Divider(height: 1),
              _TypeTile(
                title: other.label,
                selected: widget.selected == other.value,
                onTap: () => _choose(other.value),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TypeTile extends StatelessWidget {
  const _TypeTile({
    required this.title,
    this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: subtitle == null
          ? null
          : Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: selected
          ? Icon(
              LucideIcons.check,
              size: 16,
              color: Theme.of(context).colorScheme.tertiary,
            )
          : null,
      selected: selected,
      onTap: onTap,
    );
  }
}

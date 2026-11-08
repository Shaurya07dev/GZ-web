import 'dart:async';
import 'dart:typed_data';

import '../../data/models/nfc.dart';
import '../../data/repositories/nfc_repository.dart';
import '../verify_url.dart';
import 'nfc_device.dart';
import 'ntag213.dart';

/// Where the person is in a link or a lock, for the sheet that guides them.
enum NfcProgress {
  waitingForTag,
  checking,
  writing,
  verifyingWrite,
  recording,
  locking,
  verifyingLock,
}

/// A link or lock that did not happen, with the step it stopped at. [message]
/// is written for the person holding the phone.
class NfcFlowException implements Exception {
  const NfcFlowException(this.step, this.message);

  final NfcFailureStep step;
  final String message;

  /// Reads as `Exception: <message>`, like [ApiError], so every screen shows the
  /// text through the same call.
  @override
  String toString() => 'Exception: $message';
}

/// The two things the app does to a physical chip (NFC_IMPLEMENTATION.md §7.4,
/// §7.5), in the order that keeps them safe:
///
///  * The server is asked BEFORE the chip is touched. Writing first and telling
///    the server afterwards would overwrite another piece's still-unlocked chip,
///    or lock the wrong one, before anyone said no.
///  * A lock is only attempted on a chip that already carries this artwork's
///    link, because the URL on a locked chip is permanent.
///  * Each lock step is skipped if the chip already shows it done, so a lock
///    whose last call to the server failed can simply be run again.
///  * The lock is judged by reading the lock bytes back, not by trusting the
///    write: whether a refused write raises an error differs between phones.
class NfcFlow {
  NfcFlow({
    required this.device,
    required this.repository,
    String Function(String artworkId)? urlFor,
  }) : _urlFor = urlFor ?? verifyUrlFor;

  final NfcDevice device;
  final NfcRepository repository;
  final String Function(String artworkId) _urlFor;

  /// Writes the artwork's verify URL to a blank (or to-be-replaced) chip and
  /// records the link.
  Future<NfcState> link(
    String artworkId, {
    void Function(NfcProgress progress)? onProgress,
  }) {
    return _session(artworkId, (session) async {
      final url = _urlFor(artworkId);
      onProgress?.call(NfcProgress.waitingForTag);
      final chip = await session.poll();
      await session.requireNtag213(chip);

      session.step = NfcFailureStep.uidMismatch;
      onProgress?.call(NfcProgress.checking);
      final action = await repository.check(
        artworkId,
        chip.uid,
        NfcIntent.link,
      );

      // Already linked to this very chip: leave a good write alone.
      // Compare by path too — an older chip may still carry the
      // galleryzone.art URL, which is the same destination.
      if (action != NfcCheckAction.noop ||
          !_pathPointsTo(await device.readUrl(), artworkId)) {
        session.step = NfcFailureStep.write;
        onProgress?.call(NfcProgress.writing);
        await device.writeUrl(url);
        onProgress?.call(NfcProgress.verifyingWrite);
        if (await device.readUrl() != url) {
          throw const NfcFlowException(
            NfcFailureStep.write,
            "The tag was written but doesn't read back correctly. Try again, or use a different tag.",
          );
        }
      }

      session.step = NfcFailureStep.confirm;
      onProgress?.call(NfcProgress.recording);
      final NfcState state;
      try {
        state = await repository.confirmLinked(artworkId, chip.uid);
      } catch (error) {
        throw NfcFlowException(
          NfcFailureStep.confirm,
          'The tag was written, but GalleryZone could not record it (${_textOf(error)}). Tap Link tag again to finish.',
        );
      }
      await device.finish(message: 'Tag linked');
      return state;
    });
  }

  /// Sets the chip's lock bytes for good, checks they took, and records it.
  Future<NfcState> lock(
    String artworkId, {
    void Function(NfcProgress progress)? onProgress,
  }) {
    return _session(artworkId, (session) async {
      onProgress?.call(NfcProgress.waitingForTag);
      final chip = await session.poll();
      await session.requireNtag213(chip);

      session.step = NfcFailureStep.uidMismatch;
      onProgress?.call(NfcProgress.checking);
      final action = await repository.check(
        artworkId,
        chip.uid,
        NfcIntent.lock,
      );

      if (action != NfcCheckAction.noop) {
        // Permanent means permanent: never lock a chip that doesn't point here.
        // Match the URL by its `/verify/<id>` path, not the full string: the
        // site domain has moved (galleryzone.art → galleryzone.in, 7 Nov 2026)
        // and chips written against the old host must still lock.
        session.step = NfcFailureStep.uidMismatch;
        final chipUrl = await device.readUrl();
        if (!_pathPointsTo(chipUrl, artworkId)) {
          throw const NfcFlowException(
            NfcFailureStep.uidMismatch,
            "This chip doesn't hold this artwork's link, so it was not locked. Link it to this piece first.",
          );
        }

        // Prior lock attempt partially succeeded (chip is fully locked
        // already, server didn't get the confirm): skip straight to the
        // record step rather than retrying writes the chip is going to
        // refuse. Running the whole lock sequence again on a locked chip
        // was giving transient "chip lost contact" errors to buyers who
        // just needed the record caught up (client-reported 8 Nov 2026).
        if (!await _isLocked()) {
          onProgress?.call(NfcProgress.locking);
          await _lockChip(session);
          onProgress?.call(NfcProgress.verifyingLock);
          session.step = NfcFailureStep.verifyLock;
          if (!await _isLocked()) {
            throw const NfcFlowException(
              NfcFailureStep.verifyLock,
              "The tag didn't lock completely, so nothing was recorded. Hold it steady against the phone and try again.",
            );
          }
        }
      }

      session.step = NfcFailureStep.confirm;
      onProgress?.call(NfcProgress.recording);
      final NfcState state;
      try {
        state = await repository.confirmLocked(artworkId, chip.uid);
      } catch (error) {
        // The chip IS locked by now; only the record is missing. Running the lock
        // again skips every step the chip already shows done and just records it.
        throw NfcFlowException(
          NfcFailureStep.confirm,
          'The tag is locked, but GalleryZone could not record it (${_textOf(error)}). Tap Lock tag again to finish.',
        );
      }
      await device.finish(message: 'Tag locked');
      return state;
    });
  }

  // --- The lock sequence (§7.5): CC, then static, then dynamic. Page 3 has to go
  // first: the static lock bytes lock page 3 itself.

  Future<Uint8List> _readPage(int page) async =>
      Ntag213.firstPage(await device.transceive(Ntag213.read(page)));

  Future<void> _lockChip(_Session session) async {
    session.step = NfcFailureStep.lockCc;
    final cc = await _readPage(Ntag213.capabilityContainerPage);
    if ((cc[3] & Ntag213.readOnlyAccess) != Ntag213.readOnlyAccess) {
      await device.transceive(
        Ntag213.write(
          Ntag213.capabilityContainerPage,
          Ntag213.lockedCapabilityContainer(cc),
        ),
      );
    }

    session.step = NfcFailureStep.lockStatic;
    final staticPage = await _readPage(Ntag213.staticLockPage);
    if (staticPage[2] != 0xFF || staticPage[3] != 0xFF) {
      await device.transceive(
        Ntag213.write(
          Ntag213.staticLockPage,
          Ntag213.lockedStaticPage(staticPage),
        ),
      );
    }

    session.step = NfcFailureStep.lockDynamic;
    final dynamicPage = await _readPage(Ntag213.dynamicLockPage);
    if (dynamicPage[0] != 0xFF ||
        dynamicPage[1] != 0xFF ||
        dynamicPage[2] != 0xFF) {
      await device.transceive(
        Ntag213.write(
          Ntag213.dynamicLockPage,
          Ntag213.lockedDynamicPage(dynamicPage),
        ),
      );
    }
  }

  Future<bool> _isLocked() async => Ntag213.isFullyLocked(
    capabilityContainer: await _readPage(Ntag213.capabilityContainerPage),
    staticPage: await _readPage(Ntag213.staticLockPage),
    dynamicPage: await _readPage(Ntag213.dynamicLockPage),
  );

  // --- Plumbing ------------------------------------------------------------------

  /// Runs [body] in a reader session that is always closed, turns whatever went
  /// wrong into one [NfcFlowException] naming the step, and tells the server
  /// about it (except a tap that never came, which is just a person changing
  /// their mind).
  Future<NfcState> _session(
    String artworkId,
    Future<NfcState> Function(_Session session) body,
  ) async {
    final session = _Session(device);
    try {
      return await body(session);
    } catch (error) {
      final failure = error is NfcFlowException
          ? error
          : NfcFlowException(session.step, _textOf(error));
      await device.finish(error: failure.message);
      if (failure.step != NfcFailureStep.poll) {
        unawaited(
          repository.reportFailure(
            artworkId,
            failure.step,
            failure.message,
            tagUid: session.uid,
          ),
        );
      }
      throw failure;
    }
  }
}

class _Session {
  _Session(this.device);

  final NfcDevice device;
  NfcFailureStep step = NfcFailureStep.poll;
  String? uid;

  Future<NfcChip> poll() async {
    step = NfcFailureStep.poll;
    final NfcChip chip;
    try {
      chip = await device.poll();
    } catch (_) {
      throw const NfcFlowException(
        NfcFailureStep.poll,
        'No tag was found. Hold it flat against the back of your phone and try again.',
      );
    }
    uid = chip.uid;
    return chip;
  }

  /// Only an NTAG213 is written or locked: the plan's chip, and the one whose
  /// lock bytes the lock sequence knows.
  ///
  /// Compatibility notes (owner-reported 2 Nov 2026 — NFC errors on real
  /// NTAG213 chips the client bought):
  ///  * The OS tag-type signal is unreliable: iOS classifies NTAG213 as
  ///    MIFARE Ultralight sometimes and as "unknown" other times. We treat
  ///    it as a hint only — the CC bytes decide.
  ///  * Factory-fresh NTAG213 chips have `00 00 00 00` on the CC page
  ///    because no NDEF message has been written yet. We format them
  ///    ourselves to the standard default (`E1 10 12 00`) before writing
  ///    the URL, so a brand-new chip from any supplier works out of the box.
  ///  * The UID shape is the authoritative check (7 bytes), after
  ///    [normalizeTagUid] strips any cascade-tag prefix the stack might add.
  Future<void> requireNtag213(NfcChip chip) async {
    step = NfcFailureStep.chipType;
    if (!isNtagUid(chip.uid)) {
      throw NfcFlowException(
        NfcFailureStep.chipType,
        "This chip has a ${(chip.uid.length / 2).round()}-byte UID; "
            'NTAG213 is 7 bytes. Use a GalleryZone-supplied tag.',
      );
    }
    final Uint8List cc;
    try {
      cc = Ntag213.firstPage(
        await device.transceive(Ntag213.read(Ntag213.capabilityContainerPage)),
      );
    } catch (_) {
      throw const NfcFlowException(
        NfcFailureStep.chipType,
        "The tag couldn't be read. Hold it flat and steady against the back of your phone and try again.",
      );
    }
    if (Ntag213.isNtag213(cc)) return;
    if (Ntag213.isBlankCapabilityContainer(cc)) {
      // Format the chip ourselves before the first write. The CC on a
      // factory-fresh NTAG213 is writable; only the lock bytes are OTP.
      try {
        await device.transceive(
          Ntag213.write(
            Ntag213.capabilityContainerPage,
            Ntag213.defaultCapabilityContainer(),
          ),
        );
      } catch (_) {
        throw const NfcFlowException(
          NfcFailureStep.chipType,
          "This looks like a blank NTAG213 but we couldn't format it. Try again, or use a different tag.",
        );
      }
      return;
    }
    final variant = Ntag213.recognisedButIncompatibleChip(cc);
    throw NfcFlowException(
      NfcFailureStep.chipType,
      variant != null
          ? 'This is an $variant chip, not an NTAG213. Use a GalleryZone-supplied tag.'
          : "This isn't an NTAG213 chip. Use a GalleryZone-supplied tag.",
    );
  }
}

/// True when [chipUrl] points at this artwork's passport, regardless of host.
/// Matches `.../verify/<artworkId>` so a chip written under galleryzone.art
/// (pre-7 Nov 2026) is still recognised as belonging to [artworkId] once the
/// site moves to galleryzone.in — the chip is a pointer; what matters is where
/// it points.
bool _pathPointsTo(String? chipUrl, String artworkId) {
  if (chipUrl == null || chipUrl.isEmpty) return false;
  final parsed = Uri.tryParse(chipUrl);
  if (parsed == null) return false;
  final segments = parsed.pathSegments;
  if (segments.length < 2) return false;
  // Last two path segments must be "verify" / "<artworkId>".
  return segments[segments.length - 2] == 'verify' &&
      segments[segments.length - 1] == artworkId;
}

String _textOf(Object error) {
  final text = error.toString();
  // Raw platform errors from the NFC plugin are not useful to the person
  // holding the phone — translate "PlatformException(500, Communication
  // error, null, null)" into something they can act on.
  if (text.contains('PlatformException') ||
      text.contains('Communication error') ||
      text.toLowerCase().contains('tag connection lost') ||
      text.toLowerCase().contains('transceive')) {
    return 'The chip lost contact with the phone mid-operation. Hold it flat and steady against the back of the phone and try again.';
  }
  return text.startsWith('Exception: ')
      ? text.substring('Exception: '.length)
      : text;
}

/**
 * DocumentScannerModal
 *
 * Wraps react-native-document-scanner-plugin which uses:
 *   iOS  → VNDocumentCameraViewController (Apple VisionKit)
 *   Android → Google ML Kit Document Scanner
 *
 * Both give the full Adobe / Dropbox scanner experience:
 *   • Live camera with real-time document edge detection
 *   • Auto-capture when document is flat & stable
 *   • Perspective correction applied automatically
 *   • Output is a clean "scanned" image, not a raw photo
 *
 * After the native scanner closes we show our review screen so the user
 * can confirm or retake before the image is sent to OCR / AI analysis.
 * We also run expo-image-manipulator to resize to 2048 px and extract
 * base64 (needed by the OCR pipeline).
 *
 * ⚠️  Requires an EAS build — the native document scanner module is not
 *     available in Expo Go.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { X, RotateCcw, Check, ScanLine } from 'lucide-react-native';

export interface DocumentScanResult {
  /** local file:// URI of the processed scan */
  uri: string;
  /** raw base64 string (no data: prefix) — ready for OCR / AI analysis */
  base64: string;
}

interface Props {
  visible: boolean;
  onCapture: (result: DocumentScanResult) => void;
  onClose: () => void;
  title?: string;
}

type Phase = 'opening' | 'preview' | 'processing' | 'error';

const { width: SW, height: SH } = Dimensions.get('window');
const FRAME_W = SW * 0.82;
const FRAME_H = FRAME_W * 1.35;
const FRAME_TOP = (SH - FRAME_H) / 2 - 40;
const CORNER = 24;
const CORNER_THICK = 3;

export default function DocumentScannerModal({
  visible,
  onCapture,
  onClose,
  title = 'Scan Receipt',
}: Props) {
  const [phase, setPhase] = useState<Phase>('opening');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const hasLaunched = useRef(false);

  useEffect(() => {
    if (visible) {
      setPhase('opening');
      setCapturedUri(null);
      setErrorMsg('');
      hasLaunched.current = false;
      // Small delay so the modal animates in before we open the native scanner
      const t = setTimeout(() => {
        if (!hasLaunched.current) {
          hasLaunched.current = true;
          launchScanner();
        }
      }, 250);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const launchScanner = async () => {
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 1,
      });

      if (!scannedImages || scannedImages.length === 0) {
        // User cancelled the native scanner
        onClose();
        return;
      }

      setCapturedUri(scannedImages[0]);
      setPhase('preview');
    } catch (e: any) {
      console.error('[DocScanner] Native scanner error:', e);
      const msg = e?.message || 'Failed to open scanner';
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setPhase('opening');
    hasLaunched.current = false;
    // Launch again immediately
    setTimeout(() => {
      if (!hasLaunched.current) {
        hasLaunched.current = true;
        launchScanner();
      }
    }, 150);
  };

  const handleUse = async () => {
    if (!capturedUri) return;
    setPhase('processing');
    try {
      // Resize to 1024 px wide — sufficient for OCR/AI receipt analysis and
      // keeps base64 payload well under Vercel's 4.5 MB serverless body limit.
      const processed = await ImageManipulator.manipulateAsync(
        capturedUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      onCapture({ uri: processed.uri, base64: processed.base64 ?? '' });
    } catch (e) {
      console.error('[DocScanner] Processing error:', e);
      onCapture({ uri: capturedUri, base64: '' });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.container}>

        {/* ── Preview — review the scanned doc ─────────── */}
        {phase === 'preview' && capturedUri ? (
          <>
            <View style={styles.previewHeader}>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Review Scan</Text>
              <View style={styles.iconBtn} />
            </View>

            <Image
              source={{ uri: capturedUri }}
              style={styles.previewImage}
              contentFit="contain"
            />

            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
                <RotateCcw size={18} color="#1F2937" />
                <Text style={styles.retakeTxt}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.useBtn} onPress={handleUse}>
                <Check size={18} color="#FFFFFF" />
                <Text style={styles.useTxt}>Use Scan</Text>
              </TouchableOpacity>
            </View>
          </>

        ) : phase === 'processing' ? (
          /* ── Processing ─────────────────────────────── */
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.processingTxt}>Processing scan…</Text>
          </View>

        ) : phase === 'error' ? (
          /* ── Error fallback ──────────────────────────── */
          <View style={styles.center}>
            <ScanLine size={48} color="rgba(255,255,255,0.4)" />
            <Text style={styles.errorTitle}>Scanner unavailable</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetake}>
              <Text style={styles.retryTxt}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.cancelWrap}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>

        ) : (
          /* ── Opening — native scanner is active ──────── */
          <>
            {/* Header stays visible behind the native scanner sheet */}
            <View style={styles.scannerHeader}>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{title}</Text>
              <View style={styles.iconBtn} />
            </View>

            {/* Decorative frame shown briefly while scanner opens */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[styles.band, { height: FRAME_TOP }]} />
              <View style={styles.middleRow}>
                <View style={[styles.band, { width: (SW - FRAME_W) / 2, height: FRAME_H }]} />
                <View style={[styles.docFrame, { width: FRAME_W, height: FRAME_H }]}>
                  <View style={[styles.corner, styles.cTL]} />
                  <View style={[styles.corner, styles.cTR]} />
                  <View style={[styles.corner, styles.cBL]} />
                  <View style={[styles.corner, styles.cBR]} />
                </View>
                <View style={[styles.band, { width: (SW - FRAME_W) / 2, height: FRAME_H }]} />
              </View>
              <View style={[styles.band, styles.bottomBand]}>
                <ActivityIndicator color="#FFFFFF" style={{ marginBottom: 10 }} />
                <Text style={styles.hint}>Opening document scanner…</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    gap: 12,
    paddingHorizontal: 32,
  },

  // ── Scanner header ──────────────────────────────────
  scannerHeader: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  // ── Decorative viewfinder ───────────────────────────
  band: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  middleRow: {
    flexDirection: 'row' as const,
  },
  bottomBand: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingTop: 20,
    gap: 6,
  },
  hint: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center' as const,
  },
  docFrame: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  corner: {
    position: 'absolute' as const,
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  cTL: { top: -1, left: -1, borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK },
  cTR: { top: -1, right: -1, borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK },
  cBL: { bottom: -1, left: -1, borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK },
  cBR: { bottom: -1, right: -1, borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK },

  // ── Preview ────────────────────────────────────────
  previewHeader: {
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14,
    paddingHorizontal: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  previewImage: {
    flex: 1,
    backgroundColor: '#111',
  },
  previewActions: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    backgroundColor: '#000',
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingVertical: 14,
  },
  retakeTxt: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#F3F4F6',
  },
  useBtn: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
  },
  useTxt: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

  // ── Processing ─────────────────────────────────────
  processingTxt: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 4,
  },

  // ── Error ──────────────────────────────────────────
  errorTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 8,
  },
  errorMsg: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
  },
  retryTxt: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  cancelWrap: { marginTop: 8 },
  cancelTxt: { fontSize: 15, color: '#9CA3AF' },
});

import { useEffect, useRef, useState } from 'react';

const SCANNER_REGION_ID = 'barcode-scanner-region';

/**
 * Reusable webcam barcode scanner.
 *
 * - Lists all available cameras and lets the user pick one (important on
 *   laptops/phones with more than one camera, or when the wrong one is
 *   selected by default).
 * - Restricted to EAN-13 (standard retail barcodes) by default, but accepts
 *   a `formats` prop to widen that if needed.
 * - Surfaces camera permission / hardware errors clearly instead of failing
 *   silently, since "camera doesn't work" is almost always a permissions or
 *   device-selection issue rather than a code bug.
 */
export default function BarcodeScanner({ onDetected, onClose, formats }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [scannerState, setScannerState] = useState('requesting-permission'); // requesting-permission | listing | scanning | error
  const [errorMessage, setErrorMessage] = useState('');
  const html5QrCodeRef = useRef(null);
  const html5LibRef = useRef(null);

  // Step 1: ask for camera permission + enumerate devices.
  useEffect(() => {
    let cancelled = false;

    import('html5-qrcode').then((lib) => {
      if (cancelled) return;
      html5LibRef.current = lib;
      const { Html5Qrcode } = lib;

      Html5Qrcode.getCameras()
        .then((devices) => {
          if (cancelled) return;
          if (!devices || devices.length === 0) {
            setScannerState('error');
            setErrorMessage('No camera was found on this device.');
            return;
          }
          setCameras(devices);
          // Prefer a rear/back camera by label when available (common on phones/tablets).
          const backCamera = devices.find((d) => /back|rear|environment/i.test(d.label));
          setSelectedCameraId((backCamera || devices[0]).id);
          setScannerState('listing');
        })
        .catch((err) => {
          if (cancelled) return;
          setScannerState('error');
          setErrorMessage(
            'Camera access was blocked or unavailable. Check your browser\'s site permissions and allow camera access, then try again.'
          );
          console.error(err);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Step 2: start scanning once a camera is chosen.
  useEffect(() => {
    if (!selectedCameraId || !html5LibRef.current) return;

    const { Html5Qrcode, Html5QrcodeSupportedFormats } = html5LibRef.current;
    const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
      formatsToSupport: formats || [Html5QrcodeSupportedFormats.EAN_13],
      verbose: false,
    });
    html5QrCodeRef.current = scanner;

    scanner
      .start(
        selectedCameraId,
        {
          fps: 20,
          qrbox: { width: 280, height: 160 },
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        },
        (decodedText) => onDetected(decodedText),
        () => {} // per-frame "not found yet" — expected noise, ignore
      )
      .then(() => setScannerState('scanning'))
      .catch((err) => {
        setScannerState('error');
        setErrorMessage('Could not start this camera. Try selecting a different one below.');
        console.error(err);
      });

    return () => {
      const s = html5QrCodeRef.current;
      if (s && s.isScanning) {
        s.stop().then(() => s.clear()).catch(() => {});
      } else if (s) {
        s.clear().catch(() => {});
      }
    };
  }, [selectedCameraId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card" style={{ padding: '1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Scan a barcode</h4>
        {onClose && (
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        )}
      </div>

      {cameras.length > 1 && (
        <div className="form-group">
          <label className="label" htmlFor="camera-select">Camera</label>
          <select
            id="camera-select"
            className="select"
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
          >
            {cameras.map((cam) => (
              <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cam.id}`}</option>
            ))}
          </select>
        </div>
      )}

      <div
        id={SCANNER_REGION_ID}
        style={{
          width: '100%',
          maxWidth: 340,
          margin: '0 auto',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: '#000',
          minHeight: scannerState === 'scanning' ? undefined : 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {scannerState === 'requesting-permission' && (
          <span style={{ color: '#fff', fontSize: '0.82rem' }}>Requesting camera access…</span>
        )}
      </div>

      {scannerState === 'error' && (
        <div
          style={{
            marginTop: '0.8rem',
            padding: '0.7rem 0.9rem',
            background: 'var(--color-danger-soft)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
          }}
        >
          ⚠️ {errorMessage}
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-soft)', textAlign: 'center', marginTop: '0.6rem', marginBottom: 0 }}>
        Hold a standard EAN-13 barcode steady in front of the camera, well lit and in focus.
      </p>
    </div>
  );
}

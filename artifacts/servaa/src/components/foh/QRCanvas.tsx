import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCanvasProps {
  value: string;
  size?: number;
  /** Foreground (dark module) colour. Defaults to near-black. */
  dark?: string;
  /** Background colour. Defaults to white. */
  light?: string;
  className?: string;
}

/**
 * Renders a genuinely scannable QR code to a <canvas>. Used by both the QR
 * management module and the customer booking-link dialog.
 */
export function QRCanvas({
  value,
  size = 120,
  dark = "#0f172a",
  light = "#ffffff",
  className,
}: QRCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, value || " ", {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark, light },
    }).catch(() => {
      /* ignore render errors for placeholder values */
    });
  }, [value, size, dark, light]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

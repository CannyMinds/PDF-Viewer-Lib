import { useEffect, useRef } from "react";
import { useDocuments } from "@embedpdf/react";
import type { DocInfo } from "@embedpdf/react";

interface PasswordGateProps {
  documentId: string;
  info: DocInfo;
  onPasswordRequest?: (fileName?: string, isRetry?: boolean) => Promise<string | null>;
  onPasswordAccepted?: (password: string) => void;
}

// Asks the host for a password while the document is locked, and keeps asking
// until it is accepted or the host cancels (resolves null).
export const PasswordGate = ({ documentId, info, onPasswordRequest, onPasswordAccepted }: PasswordGateProps) => {
  const { unlock } = useDocuments();
  const busyRef = useRef(false);
  const requestRef = useRef(onPasswordRequest);
  requestRef.current = onPasswordRequest;
  const acceptedRef = useRef(onPasswordAccepted);
  acceptedRef.current = onPasswordAccepted;

  useEffect(() => {
    if (info.status !== "locked" || busyRef.current || !requestRef.current) return;
    busyRef.current = true;
    let cancelled = false;
    const run = async () => {
      let isRetry = Boolean(info.passwordProvided);
      while (!cancelled) {
        const request = requestRef.current;
        if (!request) return;
        const password = await request(info.name, isRetry);
        if (!password || cancelled) return;
        try {
          await unlock(documentId, { password });
          acceptedRef.current?.(password);
          return;
        } catch {
          isRetry = true;
        }
      }
    };
    run().finally(() => {
      busyRef.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [info.status, info.passwordProvided, info.name, documentId, unlock]);

  return null;
};

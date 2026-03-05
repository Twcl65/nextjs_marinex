export type CertificateStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND'

export interface CertificateVerificationResult {
  ok: boolean
  isLegit: boolean
  isCurrentlyValid: boolean
  status: CertificateStatus
  error?: string
  // Optional details for human cross-check
  certificateId?: string | null
  companyName?: string | null
  vesselName?: string | null
  vesselImoNumber?: string | null
  issuedAt?: string | null
  expiry?: string | null
}

export async function verifyCertificateById(
  certificateId: string
): Promise<CertificateVerificationResult> {
  const trimmedId = certificateId.trim()

  if (!trimmedId) {
    return {
      ok: false,
      isLegit: false,
      isCurrentlyValid: false,
      status: 'NOT_FOUND',
      error: 'Certificate ID is required',
    }
  }

  try {
    const res = await fetch(
      `/api/verify/vessel-certificate?certificateId=${encodeURIComponent(trimmedId)}`
    )

    if (!res.ok) {
      if (res.status === 404) {
        // Certificate does not exist in official records
        return {
          ok: true,
          isLegit: false,
          isCurrentlyValid: false,
          status: 'NOT_FOUND',
        }
      }

      let errorMessage = `HTTP ${res.status}`
      try {
        const data = await res.json()
        if (data?.error) {
          errorMessage = data.error
        }
      } catch {
        // ignore JSON parse errors
      }

      return {
        ok: false,
        isLegit: false,
        isCurrentlyValid: false,
        status: 'NOT_FOUND',
        error: errorMessage,
      }
    }

    const data = await res.json()
    const status = (data.status || 'NOT_FOUND') as CertificateStatus
    const details = data.data || {}

    return {
      ok: true,
      isLegit: status !== 'NOT_FOUND',
      isCurrentlyValid: status === 'ACTIVE',
      status,
      certificateId: details.certificateId ?? null,
      companyName: details.companyName ?? null,
      vesselName: details.vesselName ?? null,
      vesselImoNumber: details.vesselImoNumber ?? null,
      issuedAt: details.issuedAt ?? null,
      expiry: details.expiry ?? null,
    }
  } catch (error) {
    return {
      ok: false,
      isLegit: false,
      isCurrentlyValid: false,
      status: 'NOT_FOUND',
      error: error instanceof Error ? error.message : 'Unknown verification error',
    }
  }
}


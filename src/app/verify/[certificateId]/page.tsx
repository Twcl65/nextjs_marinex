import { prisma } from '@/lib/prisma'
import { CertificateManualCheck } from '@/components/certificate-manual-check'

interface VerifyPageProps {
  params: Promise<{
    certificateId: string
  }>
}

export default async function VerifyCertificatePage({ params }: VerifyPageProps) {
  const { certificateId: rawCertificateId } = await params
  const certificateId = decodeURIComponent(rawCertificateId)

  const recert = await prisma.drydockVesselRecertificate.findFirst({
    where: { certificateId },
    include: {
      vessel: true,
    },
  })

  const now = new Date()

  let status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' = 'ACTIVE'

  if (!recert) {
    status = 'NOT_FOUND'
  } else if (recert.certificateRevoked) {
    status = 'REVOKED'
  } else if (recert.certificateExpiry && recert.certificateExpiry < now) {
    status = 'EXPIRED'
  } else {
    status = 'ACTIVE'
  }

  const statusColors: Record<typeof status, string> = {
    ACTIVE: 'bg-green-100 text-green-800 border-green-300',
    EXPIRED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    REVOKED: 'bg-red-100 text-red-800 border-red-300',
    NOT_FOUND: 'bg-gray-100 text-gray-800 border-gray-300',
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-2xl w-full bg-white shadow-lg rounded-lg border border-slate-200 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">
              Vessel Certificate Verification
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Official verification of vessel recertification status.
            </p>
          </div>
          <div
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${statusColors[status]}`}
          >
            {status === 'ACTIVE' && 'ACTIVE'}
            {status === 'EXPIRED' && 'EXPIRED'}
            {status === 'REVOKED' && 'REVOKED'}
            {status === 'NOT_FOUND' && 'NOT FOUND'}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Certificate ID
          </p>
          <p className="text-sm font-mono text-slate-900 mt-1">{certificateId}</p>
        </div>

        {recert ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Vessel Name
                </p>
                <p className="text-sm text-slate-900 mt-1">{recert.vesselName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  IMO Number
                </p>
                <p className="text-sm text-slate-900 mt-1">{recert.vesselImoNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Company
                </p>
                <p className="text-sm text-slate-900 mt-1">{recert.companyName}</p>
              </div>
              {recert.vessel && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Flag / Ship Type
                  </p>
                  <p className="text-sm text-slate-900 mt-1">
                    {recert.vessel.flag} {recert.vessel.flag && recert.vessel.shipType && '•'}{' '}
                    {recert.vessel.shipType}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Issued At
                </p>
                <p className="text-sm text-slate-900 mt-1">
                  {recert.certificateIssuedAt
                    ? new Date(recert.certificateIssuedAt).toLocaleString()
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Valid Until
                </p>
                <p className="text-sm text-slate-900 mt-1">
                  {recert.certificateExpiry
                    ? new Date(recert.certificateExpiry).toLocaleString()
                    : '—'}
                </p>
              </div>
            </div>

            {status === 'ACTIVE' && (
              <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                This certificate is currently recorded as <span className="font-semibold">ACTIVE</span>{' '}
                in the official system of record.
              </p>
            )}
            {status === 'EXPIRED' && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                This certificate is recorded as <span className="font-semibold">EXPIRED</span>. It
                should not be relied upon as proof of current compliance.
              </p>
            )}
            {status === 'REVOKED' && (
              <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                This certificate is recorded as <span className="font-semibold">REVOKED</span>. Any
                copy, including faxed or scanned images, must be treated as invalid.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-3">
            No matching certificate was found in the official system. The presented document should
            be treated as <span className="font-semibold">INVALID</span>.
          </p>
        )}

        <CertificateManualCheck />

        <p className="mt-6 text-[11px] text-slate-500 border-t border-slate-200 pt-3">
          The PDF document and any printed, faxed, or scanned copies are considered informational
          only. The database record displayed on this page is the single source of truth for the
          validity of this vessel recertification.
        </p>
      </div>
    </main>
  )
}


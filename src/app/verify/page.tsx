import { CertificateManualCheck } from '@/components/certificate-manual-check'

export default function VerifyLandingPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 bg-cover bg-center"
      style={{ backgroundImage: "url('/assets/background.jpg')" }}
    >
      <div className="max-w-2xl w-full bg-white/95 backdrop-blur-sm shadow-lg rounded-lg border border-slate-200 p-6 md:p-8">
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            Vessel Certificate Verification
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Enter the Certificate ID printed on the document to verify its legitimacy and current
            validity.
          </p>
        </div>

        <CertificateManualCheck />

        <p className="mt-6 text-[11px] text-slate-500 border-t border-slate-200 pt-3">
          The PDF document and any printed, faxed, or scanned copies are considered informational
          only. The database record returned by this verification service is the single source of
          truth for the validity of this vessel recertification.
        </p>
      </div>
    </main>
  )
}


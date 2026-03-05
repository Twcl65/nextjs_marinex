'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  CertificateVerificationResult,
  verifyCertificateById,
} from '@/lib/verifyCertificate'

export function CertificateManualCheck() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CertificateVerificationResult | null>(null)

  const handleCheck = async () => {
    setLoading(true)
    try {
      const res = await verifyCertificateById(input)
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  let statusLabel = ''
  let statusColor = ''

  if (result) {
    switch (result.status) {
      case 'ACTIVE':
        statusLabel = 'ACTIVE'
        statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-200'
        break
      case 'EXPIRED':
        statusLabel = 'EXPIRED'
        statusColor = 'bg-amber-50 text-amber-800 border-amber-200'
        break
      case 'REVOKED':
        statusLabel = 'REVOKED'
        statusColor = 'bg-red-50 text-red-800 border-red-200'
        break
      case 'NOT_FOUND':
      default:
        statusLabel = 'NOT FOUND'
        statusColor = 'bg-slate-50 text-slate-700 border-slate-200'
        break
    }
  }

  return (
    <div className="mt-8 border border-slate-200 rounded-lg p-4 bg-slate-50/60">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
        Manual Certificate Check
      </p>
      <p className="text-xs text-slate-500 mb-3">
        Enter any Certificate ID printed on a document to verify if it exists in the official system
        and whether it is currently valid.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Enter Certificate ID (e.g. VR-2026-5BJUHK)"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          onClick={handleCheck}
          disabled={loading || !input.trim()}
          className="whitespace-nowrap"
        >
          {loading ? 'Checking…' : 'Check Certificate'}
        </Button>
      </div>

      {result && (
        <div className="mt-3 space-y-3 text-xs">
          <div className={`inline-flex items-center rounded-full px-3 py-1 border ${statusColor}`}>
            <span className="font-semibold mr-1">Status:</span> {statusLabel}
          </div>

          {result.ok && result.isLegit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-md px-3 py-2">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Certificate ID
                </p>
                <p className="text-xs font-mono text-slate-900 mt-0.5">
                  {result.certificateId || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Vessel Name
                </p>
                <p className="text-xs text-slate-900 mt-0.5">{result.vesselName || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  IMO Number
                </p>
                <p className="text-xs text-slate-900 mt-0.5">{result.vesselImoNumber || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Company
                </p>
                <p className="text-xs text-slate-900 mt-0.5">{result.companyName || '—'}</p>
              </div>
            </div>
          )
          }

          {!result.ok && result.error && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {result.error}
            </p>
          )}

          {result.ok && !result.isLegit && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              No matching certificate was found in the official system. Treat the document as{' '}
              <span className="font-semibold">INVALID</span>.
            </p>
          )}

          {result.ok && result.isLegit && !result.isCurrentlyValid && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This certificate exists in the official system but is{' '}
              <span className="font-semibold">not currently valid</span> (expired or revoked).
            </p>
          )}

          {result.ok && result.isCurrentlyValid && (
            <p className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              This certificate exists in the official system and is currently{' '}
              <span className="font-semibold">ACTIVE</span>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}


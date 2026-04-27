import { AlertTriangle } from "lucide-react";

export default function NewRefundRequests() {
  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-3xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Manual Refund Flow Disabled</h1>
            <p className="text-sm text-slate-600 mt-2">
              Refunds are now auto-processed on eligible order cancellations. This page no longer supports manual processing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

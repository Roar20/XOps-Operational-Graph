import { CorpusUpload } from "@/components/CorpusUpload";

export const metadata = { title: "Load a corpus · XOps Operational Graph" };

export default function UploadPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-pep-900">Load a corpus</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          The aggregate sheets of QN v2.4.2 ship with this build, already verified against their own
          declared population. The ticket-level detail does not: it is 719,946 rows that stay in your
          browser. Load the workbook here and the detail becomes queryable, without a single row leaving
          this machine.
        </p>
      </div>
      <CorpusUpload />
    </div>
  );
}

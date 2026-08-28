import { CorpusUpload } from "@/components/CorpusUpload";

export const metadata = { title: "Load Data · XOps Operational Graph" };

export default function UploadPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-pep-900">Load Data</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-700">
          The workbook is the source of truth. It is validated, classified sheet by sheet as full
          corpus or sample, and indexed in this browser. Nothing is uploaded to a server and no
          pre-generated JSON is required.
        </p>
      </div>
      <CorpusUpload />
    </div>
  );
}

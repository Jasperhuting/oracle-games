import { MountedCheck } from "@/components/MountedCheck";
import { ApiDocsContent } from "@/components/ApiDocsContent";

/**
 * API Documentation Page
 * Displays Swagger UI for the Oracle Games API
 */
export default function ApiDocsPage() {
  return (
    <MountedCheck fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading API Documentation...</h1>
        </div>
      </div>
    }>
      <ApiDocsContent />
    </MountedCheck>
  );
}

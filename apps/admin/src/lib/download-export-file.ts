import { propertyExportsApi } from "@/lib/api-client";

export async function downloadExportFile(propertyId: string, jobId: string): Promise<void> {
  const { downloadUrl } = await propertyExportsApi.getDownloadUrl(propertyId, jobId);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

import { api } from "@mukalma/backend/convex/_generated/api";
import type { Id } from "@mukalma/backend/convex/_generated/dataModel";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { DocumentUploadZone } from "@mukalma/ui/composites/document-upload-zone";
import { DocumentsTable } from "@mukalma/ui/composites/documents-table";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export default function DocumentsPage() {
	const current = useQuery(api.tenants.getCurrent);
	const documents = useQuery(api.documents.list, current?.tenant ? {} : "skip");
	const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
	const createDocument = useMutation(api.documents.create);
	const removeDocument = useMutation(api.documents.remove);
	const retryProcessing = useMutation(api.documents.retryProcessing);

	const canManage = current?.user.role === "org_admin";

	const handleUpload = async (file: File) => {
		const uploadUrl = await generateUploadUrl({});
		const response = await fetch(uploadUrl, {
			method: "POST",
			headers: { "Content-Type": file.type },
			body: file,
		});
		if (!response.ok) {
			throw new Error("Failed to upload file to storage");
		}
		const { storageId } = (await response.json()) as {
			storageId: Id<"_storage">;
		};
		await createDocument({
			storageId,
			name: file.name,
			mimeType: file.type,
			sizeBytes: file.size,
		});
		toast.success(`${file.name} uploaded — processing started`);
	};

	if (current === undefined || documents === undefined) {
		return <Skeleton className="h-64 w-full" />;
	}

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-4xl space-y-8 p-6 md:p-8">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Documents</h1>
					<p className="text-muted-foreground">
						Upload knowledge base files for AI-powered support answers.
					</p>
				</div>

				{canManage ? (
					<DocumentUploadZone onUploadFile={handleUpload} />
				) : (
					<p className="text-muted-foreground text-sm">
						Only organization admins can upload documents.
					</p>
				)}

				<DocumentsTable
					documents={documents.map((doc) => ({
						_id: doc._id,
						name: doc.name,
						mimeType: doc.mimeType,
						sizeBytes: doc.sizeBytes,
						status: doc.status,
						chunkCount: doc.chunkCount,
						errorMessage: doc.errorMessage,
						createdAt: doc.createdAt,
					}))}
					canManage={canManage}
					onRetry={async (documentId) => {
						try {
							await retryProcessing({
								documentId: documentId as Id<"documents">,
							});
							toast.success("Processing restarted");
						} catch (err) {
							toast.error(err instanceof Error ? err.message : "Retry failed");
							throw err;
						}
					}}
					onDelete={async (documentId) => {
						try {
							await removeDocument({
								documentId: documentId as Id<"documents">,
							});
							toast.success("Document deleted");
						} catch (err) {
							toast.error(err instanceof Error ? err.message : "Delete failed");
							throw err;
						}
					}}
				/>
			</div>
		</div>
	);
}

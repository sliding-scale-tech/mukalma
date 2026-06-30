import { formatFileSize, mimeTypeLabel } from "@mukalma/shared";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@mukalma/ui/components/alert-dialog";
import { Badge } from "@mukalma/ui/components/badge";
import { Button } from "@mukalma/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@mukalma/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@mukalma/ui/components/tooltip";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

export type DocumentRow = {
	_id: string;
	name: string;
	mimeType: string;
	sizeBytes: number;
	status: "processing" | "ready" | "failed";
	chunkCount: number;
	errorMessage: string | null;
	createdAt: number;
};

type DocumentsTableProps = {
	documents: DocumentRow[];
	canManage: boolean;
	onRetry: (documentId: string) => Promise<void>;
	onDelete: (documentId: string) => Promise<void>;
};

function StatusBadge({ status }: { status: DocumentRow["status"] }) {
	switch (status) {
		case "processing":
			return <Badge variant="secondary">Processing</Badge>;
		case "ready":
			return <Badge>Ready</Badge>;
		case "failed":
			return <Badge variant="destructive">Failed</Badge>;
	}
}

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

export function DocumentsTable({
	documents,
	canManage,
	onRetry,
	onDelete,
}: DocumentsTableProps) {
	const [busyId, setBusyId] = useState<string | null>(null);

	if (documents.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No documents yet. Upload your first knowledge base file above.
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Name</TableHead>
					<TableHead>Type</TableHead>
					<TableHead>Size</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Chunks</TableHead>
					<TableHead>Uploaded</TableHead>
					{canManage && <TableHead className="text-right">Actions</TableHead>}
				</TableRow>
			</TableHeader>
			<TableBody>
				{documents.map((doc) => {
					const isBusy = busyId === doc._id;
					return (
						<TableRow key={doc._id}>
							<TableCell className="max-w-[240px] truncate font-medium">
								{doc.name}
							</TableCell>
							<TableCell>{mimeTypeLabel(doc.mimeType)}</TableCell>
							<TableCell>{formatFileSize(doc.sizeBytes)}</TableCell>
							<TableCell>
								{doc.status === "failed" && doc.errorMessage ? (
									<Tooltip>
										<TooltipTrigger>
											<StatusBadge status={doc.status} />
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											{doc.errorMessage}
										</TooltipContent>
									</Tooltip>
								) : (
									<StatusBadge status={doc.status} />
								)}
							</TableCell>
							<TableCell>
								{doc.status === "processing" ? (
									<Loader2 className="size-4 animate-spin text-muted-foreground" />
								) : (
									doc.chunkCount
								)}
							</TableCell>
							<TableCell>{formatDate(doc.createdAt)}</TableCell>
							{canManage && (
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										{(doc.status === "failed" || doc.status === "ready") && (
											<Button
												size="sm"
												variant="outline"
												disabled={isBusy}
												onClick={async () => {
													setBusyId(doc._id);
													try {
														await onRetry(doc._id);
													} finally {
														setBusyId(null);
													}
												}}
											>
												<RotateCcw className="size-4" />
												{doc.status === "failed" ? "Retry" : "Reprocess"}
											</Button>
										)}
										<AlertDialog>
											<AlertDialogTrigger
												render={
													<Button
														size="sm"
														variant="outline"
														disabled={isBusy || doc.status === "processing"}
													/>
												}
											>
												<Trash2 className="size-4" />
												Delete
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Delete document?</AlertDialogTitle>
													<AlertDialogDescription>
														This removes {doc.name} and all of its indexed
														chunks. This cannot be undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction
														onClick={async () => {
															setBusyId(doc._id);
															try {
																await onDelete(doc._id);
															} finally {
																setBusyId(null);
															}
														}}
													>
														Delete
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</TableCell>
							)}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}

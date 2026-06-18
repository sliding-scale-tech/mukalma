import {
	ALLOWED_MIME_TYPES,
	isAllowedMimeType,
	MAX_DOCUMENT_BYTES,
} from "@mukalma/shared";
import { Alert, AlertDescription } from "@mukalma/ui/components/alert";
import { Button } from "@mukalma/ui/components/button";
import { cn } from "@mukalma/ui/lib/utils";
import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type DocumentUploadZoneProps = {
	onUploadFile: (file: File) => Promise<void>;
	disabled?: boolean;
};

export function DocumentUploadZone({
	onUploadFile,
	disabled = false,
}: DocumentUploadZoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const validateFile = (file: File): string | null => {
		if (!isAllowedMimeType(file.type)) {
			return "Unsupported file type. Use PDF, DOCX, TXT, or Markdown.";
		}
		if (file.size > MAX_DOCUMENT_BYTES) {
			return "File must be 10 MB or smaller.";
		}
		return null;
	};

	const handleFiles = useCallback(
		async (files: FileList | null) => {
			if (!files?.length || disabled || uploading) return;
			setError(null);

			for (const file of Array.from(files)) {
				const validationError = validateFile(file);
				if (validationError) {
					setError(validationError);
					continue;
				}
				setUploading(true);
				try {
					await onUploadFile(file);
				} catch (err) {
					setError(err instanceof Error ? err.message : "Upload failed");
				} finally {
					setUploading(false);
				}
			}
		},
		[disabled, onUploadFile, uploading, validateFile],
	);

	return (
		<div className="space-y-3">
			<section
				aria-label="File drop zone"
				className={cn(
					"flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center transition-colors",
					dragging && "border-primary bg-muted/50",
					disabled && "cursor-not-allowed opacity-60",
				)}
				onDragOver={(e) => {
					e.preventDefault();
					if (!disabled) setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					if (!disabled) void handleFiles(e.dataTransfer.files);
				}}
			>
				{uploading ? (
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				) : (
					<FileUp className="size-8 text-muted-foreground" />
				)}
				<div className="space-y-1">
					<p className="font-medium text-sm">
						Drag and drop documents here, or choose files
					</p>
					<p className="text-muted-foreground text-xs">
						PDF, DOCX, TXT, Markdown — max 10 MB each
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					disabled={disabled || uploading}
					onClick={() => inputRef.current?.click()}
				>
					Choose files
				</Button>
				<input
					ref={inputRef}
					type="file"
					className="hidden"
					multiple
					accept={ALLOWED_MIME_TYPES.join(",")}
					onChange={(e) => {
						void handleFiles(e.target.files);
						e.target.value = "";
					}}
				/>
			</section>
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
		</div>
	);
}

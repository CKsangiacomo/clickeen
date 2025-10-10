import { useState, useRef } from "react";
import Image from "@/components/Image";
import Icon from "@/components/Icon";

type Props = {
    className?: string;
    label: string;
    required?: boolean;
    onChange?: (file: File) => void;
    initialImage?: string;
};

const UploadImage = ({
    className,
    label,
    required,
    onChange,
    initialImage,
}: Props) => {
    const [preview, setPreview] = useState<string | null>(initialImage || null);
    const [fileName, setFileName] = useState<string>("");
    const [fileSize, setFileSize] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreview(objectUrl);
            setFileName(file.name);
            setFileSize(formatFileSize(file.size));
            onChange?.(file);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setPreview(null);
        setFileName("");
        setFileSize("");
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div className={className || ""}>
            {label && (
                <div className="mb-2 font-medium text-gray-500">
                    {label}
                    {required && <span className="text-error-100"> *</span>}
                </div>
            )}
            {preview ? (
                <div className="relative min-h-25 border border-gray-100 rounded-xl overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-t before:from-primary-500/0 before:to-primary-500">
                    <Image
                        className="w-full h-auto opacity-100 object-cover"
                        src={preview}
                        width={492}
                        height={220}
                        alt="Preview"
                        unoptimized
                    />
                    <div className="absolute inset-0 z-1 flex flex-wrap justify-between gap-4 items-start p-4 text-body-lg text-white">
                        <div className="">
                            <div className="font-medium">{fileName}</div>
                            <div className="">{fileSize}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="font-medium">Upload Completed</div>
                            <button
                                className="size-6 bg-white/32 rounded-full transition-colors text-0 hover:bg-white/42"
                                onClick={handleRemove}
                            >
                                <Icon
                                    className="!size-6 fill-white"
                                    name="close"
                                />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative flex justify-center items-center h-19 border border-gray-100 rounded-xl text-body-lg text-gray-300">
                    Drag & Drop your files or{" "}
                    <span className="ml-1.25 font-medium text-primary-500">
                        Browse
                    </span>
                    <input
                        ref={inputRef}
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={handleChange}
                        accept="image/*"
                    />
                </div>
            )}
        </div>
    );
};

export default UploadImage;

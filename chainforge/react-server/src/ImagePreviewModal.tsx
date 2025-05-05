import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import { Modal, Image, Text, Stack } from "@mantine/core";
import { Dict } from "./backend/typing";

export interface ImagePreviewModalRef {
  trigger: (url: string, data: Dict<string>) => void;
}

interface ImagePreviewModalProps {
  title?: string;
}

interface ImageInfo {
  user_source: string;
  width: number;
  height: number;
  format: string;
  size: string;
  token_count?: Dict<string>;
}

const ImagePreviewModal = forwardRef<
  ImagePreviewModalRef,
  ImagePreviewModalProps
>(({ title = "Image Preview" }, ref) => {
  const [opened, setOpened] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState<Dict<string>>({});
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);

  useImperativeHandle(ref, () => ({
    trigger: (url: string, data: Dict<string>) => {
      console.log("trigger", data);
      setImageUrl(url);
      setImageData(data);
      setOpened(true);
    },
  }));

  useEffect(() => {
    if (imageUrl) {
      const img = document.createElement("img");
      img.onload = () => {
        setImageInfo({
          user_source: imageData?.source,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: imageUrl.startsWith("http")
            ? imageUrl
            : imageUrl.split(";")[0].split(":")[1] || "Unknown",
          size: "N/A", // We can't get file size from URL directly in browser
        });
      };
      img.src = imageUrl;
    }
  }, [imageUrl]);

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title={title}
      size="xl"
    >
      <Stack spacing="md" align="center">
        <div
          style={{
            width: 400,
            height: 400,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src={imageUrl}
            fit="contain"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </div>
        {imageInfo && (
          <Text size="sm" color="dimmed">
            Original dimensions: {imageInfo.width}x{imageInfo.height}px
          </Text>
        )}
      </Stack>
    </Modal>
  );
});

ImagePreviewModal.displayName = "ImagePreviewModal";

export default ImagePreviewModal;

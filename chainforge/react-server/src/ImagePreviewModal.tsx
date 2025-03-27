import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import { Modal, Image, Text, Stack } from "@mantine/core";

export interface ImagePreviewModalRef {
  trigger: (url: string) => void;
}

interface ImagePreviewModalProps {
  title?: string;
}

interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: string;
}

const ImagePreviewModal = forwardRef<
  ImagePreviewModalRef,
  ImagePreviewModalProps
>(({ title = "Image Preview" }, ref) => {
  const [opened, setOpened] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);

  useImperativeHandle(ref, () => ({
    trigger: (url: string) => {
      setImageUrl(url);
      setOpened(true);
    },
  }));

  useEffect(() => {
    if (imageUrl) {
      const img = document.createElement("img");
      img.onload = () => {
        setImageInfo({
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: imageUrl.split(".").pop()?.toUpperCase() || "Unknown",
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
            <br />
            Format: {imageInfo.format}
            <br />
            Size: {imageInfo.size}
          </Text>
        )}
      </Stack>
    </Modal>
  );
});

ImagePreviewModal.displayName = "ImagePreviewModal";

export default ImagePreviewModal;

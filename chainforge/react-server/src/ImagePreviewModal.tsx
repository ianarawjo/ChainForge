import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from "react";
import { Modal, Image, Text, Stack } from "@mantine/core";
import { Dict } from "./backend/typing";
import { metadataRowType } from "./MultimediaNode";

export interface ImagePreviewModalRef {
  trigger: (url: string, data: metadataRowType) => void;
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
  timestamp: string;
  token_count?: Dict<string>;
}

const ImagePreviewModal = forwardRef<
  ImagePreviewModalRef,
  ImagePreviewModalProps
>(({ title = "Image Details Info" }, ref) => {
  const [opened, setOpened] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState<metadataRowType>(
    {} as metadataRowType,
  );
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);

  useImperativeHandle(ref, () => ({
    trigger: (url: string, data: metadataRowType) => {
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
          user_source: imageData.source,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: imageData.coming_from,
          size: imageData.size,
          timestamp: new Date(parseInt(imageData.timestamp) * 1000).toString(),
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
            width: 600,
            height: 600,
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
          <div
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "0px",
              borderRadius: "8px",
              border: "1px solid #e9ecef",
            }}
          >
            <Text size="sm" style={{ lineHeight: 1.7 }}>
              <strong>Format:</strong> {imageInfo.format}
              <br />
              <strong>Timestamp:</strong> {imageInfo.timestamp}
              <br />
              <strong>Source:</strong> {imageInfo.user_source}
              <br />
              <hr style={{ margin: "10px 0" }} />
              <strong>Width:</strong> {imageInfo.width} px
              <br />
              <strong>Height:</strong> {imageInfo.height} px
              <br />
              <strong>Size:</strong> {imageInfo.size} bytes
              <br />
              {/* TODO: Token Count: 'TODO Feature coming' */}
            </Text>
          </div>
        )}
      </Stack>
    </Modal>
  );
});

ImagePreviewModal.displayName = "ImagePreviewModal";

export default ImagePreviewModal;

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position } from "reactflow";
import { Image, Box, ActionIcon, Text, Group, Tooltip } from "@mantine/core";
import {
  IconPhoto,
  IconChevronLeft,
  IconChevronRight,
  IconUpload,
  IconEye,
  IconEyeOff,
  IconX,
} from "@tabler/icons-react";
import BaseNode from "./BaseNode";
import NodeLabel from "./NodeLabelComponent";
import useStore from "./store";
import UploadFileModal, { UploadFileModalRef } from "./UploadFileModal";
import ImagePreviewModal, { ImagePreviewModalRef } from "./ImagePreviewModal";

interface CarouselNodeData {
  title?: string;
  fields?: { [key: string]: string };
  fields_visibility?: { [key: string]: boolean };
  fields_is_image?: { [key: string]: boolean };
}

interface CarouselNodeProps {
  data: CarouselNodeData;
  id: string;
}

const CarouselNode: React.FC<CarouselNodeProps> = ({ data, id }) => {
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
  const [fields, setFields] = useState<{ [key: string]: string }>(data.fields || {});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fieldVisibility, setFieldVisibility] = useState<{
    [key: string]: boolean;
  }>(data.fields_visibility || {});
  const [fieldIsImage, setFieldIsImage] = useState<{
    [key: string]: boolean;
  }>(data.fields_is_image || {});
  const containerRef = useRef<HTMLDivElement>(null);
  const uploadFileModal = useRef<UploadFileModalRef>(null);
  const imagePreviewModal = useRef<ImagePreviewModalRef>(null);

  // Convert fields object to array for display
  const images = Object.values(fields);

  const handleAddImage = useCallback(
    (url: string) => {
      // Clean the URL by removing any existing %IMAGE% prefix
      const cleanUrl = url.replace(/%IMAGE%/g, "");
      const newFieldId = `image_${Object.keys(fields).length}`;
      
      const newFields = { ...fields, [newFieldId]: cleanUrl };
      setFields(newFields);
      
      const newFieldIsImage = { ...fieldIsImage, [newFieldId]: true };
      setFieldIsImage(newFieldIsImage);
      
      setDataPropsForNode(id, {
        ...data,
        fields: newFields,
        fields_visibility: fieldVisibility,
        fields_is_image: newFieldIsImage,
        value: `{@IMG}`,
      });
    },
    [fields, fieldVisibility, fieldIsImage, id, data, setDataPropsForNode],
  );

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const handleUploadFile = useCallback(
    (url: string) => {
      handleAddImage(url);
    },
    [handleAddImage],
  );

  const handleOpenUploadModal = useCallback(() => {
    if (uploadFileModal.current) {
      uploadFileModal.current.open();
    }
  }, []);

  const handleToggleVisibility = useCallback(() => {
    const fieldIds = Object.keys(fields);
    const currentFieldId = fieldIds[currentIndex];
    
    const newVisibility = { ...fieldVisibility };
    newVisibility[currentFieldId] = !newVisibility[currentFieldId];
    setFieldVisibility(newVisibility);
    
    setDataPropsForNode(id, {
      ...data,
      fields_visibility: newVisibility,
      fields_is_image: fieldIsImage,
      value: `{@IMG}`,
    });
  }, [currentIndex, fields, fieldVisibility, fieldIsImage, id, data, setDataPropsForNode]);

  const handleRemoveImage = useCallback(() => {
    if (Object.keys(fields).length <= 1) return;
    
    const fieldIds = Object.keys(fields);
    const currentFieldId = fieldIds[currentIndex];
    
    const newFields = { ...fields };
    delete newFields[currentFieldId];
    setFields(newFields);
    
    const newVisibility = { ...fieldVisibility };
    const newFieldIsImage = { ...fieldIsImage };
    delete newVisibility[currentFieldId];
    delete newFieldIsImage[currentFieldId];
    
    setFieldVisibility(newVisibility);
    setFieldIsImage(newFieldIsImage);
    setCurrentIndex((prev) =>
      prev >= Object.keys(newFields).length ? Object.keys(newFields).length - 1 : prev,
    );
    
    setDataPropsForNode(id, {
      ...data,
      fields: newFields,
      fields_visibility: newVisibility,
      fields_is_image: newFieldIsImage,
      value: `{@IMG}`,
    });
  }, [fields, currentIndex, fieldVisibility, fieldIsImage, id, data, setDataPropsForNode]);

  const getTemplateValue = useCallback(() => {
    if (!Object.keys(fields).length) return "";

    const visibleFields = Object.entries(fields).filter(
      ([fieldId]) => fieldVisibility[fieldId] !== false,
    );

    return `{@IMG}`;
  }, [fields, fieldVisibility]);

  const handleImageClick = useCallback(() => {
    if (imagePreviewModal.current && images[currentIndex]) {
      imagePreviewModal.current.trigger(images[currentIndex]);
    }
  }, [images, currentIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      // Handle resize if needed
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <BaseNode classNames="carousel-node" nodeId={id}>
      <NodeLabel
        title={data.title || "Multimedia Node"}
        nodeId={id}
        icon={<IconPhoto size="16px" />}
      />

      <div
        style={{
          borderTop: "1px dashed #ccc",
          margin: "10px 0",
          paddingTop: "10px",
        }}
      >
        <Box ref={containerRef} sx={{ width: "100%" }}>
          <div className="carousel-container">
            {images.length > 0 ? (
              <>
                <div
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: "4px",
                    padding: "8px",
                    backgroundColor: "#fff",
                    width: "250px",
                    margin: "0 auto",
                  }}
                >
                  <div onClick={handleImageClick} style={{ cursor: "pointer" }}>
                    <Image
                      src={images[currentIndex]}
                      height={200}
                      width={200}
                      fit="contain"
                      withPlaceholder
                      style={{
                        opacity:
                          fieldVisibility[images[currentIndex]] === false ? 0.3 : 1,
                        backgroundColor: "#f8f9fa",
                        margin: "0 auto",
                      }}
                    />
                  </div>
                </div>

                <Group position="center" mt="sm" spacing={20}>
                  <ActionIcon
                    onClick={handlePrev}
                    disabled={images.length <= 1}
                    variant="transparent"
                    size="xl"
                  >
                    <IconChevronLeft size={24} />
                  </ActionIcon>
                  <Text
                    size="sm"
                    style={{ minWidth: "60px", textAlign: "center" }}
                  >
                    {`${currentIndex + 1}/${images.length}`}
                  </Text>
                  <ActionIcon
                    onClick={handleNext}
                    disabled={images.length <= 1}
                    variant="transparent"
                    size="xl"
                  >
                    <IconChevronRight size={24} />
                  </ActionIcon>
                </Group>
              </>
            ) : (
              <Box
                sx={{
                  height: 200,
                  width: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e0e0e0",
                  borderRadius: "4px",
                  margin: "0 auto",
                }}
              >
                <Text color="dimmed">No images uploaded</Text>
              </Box>
            )}
          </div>

          <Group position="center" mt="xs" spacing={5}>
            <Tooltip label="Remove current image" position="top">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={handleRemoveImage}
                disabled={images.length <= 1}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip
              label={
                fieldVisibility[images[currentIndex]] === false
                  ? "Show image"
                  : "Hide image"
              }
              position="top"
            >
              <ActionIcon
                variant="subtle"
                onClick={handleToggleVisibility}
                disabled={images.length === 0}
              >
                {fieldVisibility[images[currentIndex]] === false ? (
                  <IconEyeOff size={16} />
                ) : (
                  <IconEye size={16} />
                )}
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Upload image" position="top">
              <ActionIcon
                variant="filled"
                color="blue"
                onClick={handleOpenUploadModal}
              >
                <IconUpload size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="grouped-handle"
        style={{ top: "50%" }}
      />

      <ImagePreviewModal ref={imagePreviewModal} />
      <UploadFileModal
        ref={uploadFileModal}
        title="Upload Image"
        label="Provide a URL pointing to an image"
        onSubmit={handleUploadFile}
      />
    </BaseNode>
  );
};

export default CarouselNode;

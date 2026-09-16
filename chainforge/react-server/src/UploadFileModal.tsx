import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useContext,
  useMemo,
} from "react";
import {
  Modal,
  TextInput,
  Button,
  Box,
  Group,
  useMantineTheme,
  Flex,
  Center,
  Text,
  rem,
  Divider,
  Card,
  Image,
  SimpleGrid,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import {
  IconUpload,
  IconX,
  IconImageInPicture,
  IconArrowRight,
} from "@tabler/icons-react";

import { AlertModalContext } from "./AlertModal";
import { FLASK_BASE_URL } from "./backend/utils";
import { FileWithContent } from "./backend/typing";

// This constant serves as the maximum size of the Image file that can be uploaded
const MAX_SIZE_MB = 50;

// Image types the vision-capable providers accept.
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

// Decoding a full-size preview for every file is costly with many files, so
// only the first few are previewed.
const MAX_PREVIEWS = 12;

// ====================================== File Dropzone Modal ======================================

interface ImageFileDropzoneProps {
  onError: (err: string | Error) => void;
  onDrop: (files: FileWithContent[]) => void;
}

/** A Dropzone to load an image file.
 * If successful, the image file preview is loaded into the UI.
 * */
const ImageFileDropzone: React.FC<ImageFileDropzoneProps> = ({
  onError,
  onDrop,
}) => {
  const theme = useMantineTheme();

  // Files are passed on as-is. They used to be read into base64 data URLs
  // here, which nothing consumed, and the combined size of a drop was capped
  // at MAX_SIZE_MB even though the limit is described per file. The per-file
  // limit is enforced by the Dropzone, and the total by MediaLookup's budget.
  const handleDrop = useCallback(
    (files: FileWithPath[]) => onDrop(files as FileWithContent[]),
    [onDrop],
  );

  return (
    <Dropzone
      mt="sm"
      accept={ACCEPTED_IMAGE_TYPES}
      onDrop={handleDrop}
      onReject={(rejections) =>
        onError(
          `${rejections.length} file(s) could not be added: ` +
            rejections
              .map(
                (r) =>
                  `${r.file.name} (${r.errors.map((e) => e.message).join("; ")})`,
              )
              .join(", "),
        )
      }
      maxSize={MAX_SIZE_MB * 1024 ** 2}
    >
      <Flex style={{ minHeight: rem(80), pointerEvents: "none" }}>
        <Center>
          <Dropzone.Accept>
            <IconUpload
              size="4.2rem"
              stroke={1.5}
              color={
                theme.colors[theme.primaryColor][
                  theme.colorScheme === "dark" ? 4 : 6
                ]
              }
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              size="4.2rem"
              stroke={1.5}
              color={theme.colors.red[theme.colorScheme === "dark" ? 4 : 6]}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconImageInPicture size="4.2rem" stroke={1.5} />
          </Dropzone.Idle>

          <Box ml="md">
            <Text size="md" lh={1.2} inline>
              Drag image(s) here or click to select file(s)
            </Text>
            <Text size="sm" color="dimmed" inline mt={7}>
              {`Each file should not exceed ${MAX_SIZE_MB} MB`}
            </Text>
          </Box>
        </Center>
      </Flex>
    </Dropzone>
  );
};

// ====================================== UploadFile Modal ======================================
export interface UploadFileModalProps {
  title: string;
  onSubmit?: (files: FileWithContent[]) => void;
}

export interface UploadFileModalRef {
  open: () => void;
  close: () => void;
}

/** Modal that lets user upload a single file, usin a TextInput field OR a dropdown field. */
const UploadFileModal = forwardRef<UploadFileModalRef, UploadFileModalProps>(
  function UploadFileModal({ title, onSubmit }, ref) {
    const [opened, { open, close }] = useDisclosure(false);

    const [filesLoaded, setFilesLoaded] = useState<FileWithContent[]>([]);
    const [isFetching, setIsFetching] = useState(false);

    // Created once per set of files and revoked when it changes. Creating them
    // during render made a new URL on every re-render, leaking any that were
    // replaced before their image loaded.
    const previewUrls = useMemo(
      () =>
        filesLoaded
          .slice(0, MAX_PREVIEWS)
          .map((file) => URL.createObjectURL(file)),
      [filesLoaded],
    );
    useEffect(
      () => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)),
      [previewUrls],
    );
    const previews = previewUrls.map((url, index) => (
      <Image key={index} src={url} />
    ));

    const form = useForm({
      initialValues: {
        value: "",
      },
    });

    const handleSubmit = useCallback(() => {
      if (onSubmit) onSubmit(filesLoaded);
      setFilesLoaded([]); // clear the fileLoaded state
      form.setValues({ value: "" }); // clear the form input
      close();
    }, [onSubmit, filesLoaded, close]);

    const handleRemoveFileLoaded = useCallback(() => {
      setFilesLoaded([]);
      form.setValues({ value: "" });
    }, [setFilesLoaded]);

    const showAlert = useContext(AlertModalContext);
    const handleError = useCallback(
      (err: string | Error) => {
        const msg = typeof err === "string" ? err : err.message;
        if (showAlert) showAlert(msg);
      },
      [showAlert],
    );

    const [fetchError, setFetchError] = useState<string | null>(null);
    const handleFetchImage = useCallback(async () => {
      const url = form.values.value.trim();

      setIsFetching(true);
      try {
        const proxyUrl = `${FLASK_BASE_URL}api/proxyImage?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(`Error fetching image: ${response.statusText}`);
        }

        const blob = await response.blob();
        const file = new File([blob], url, { type: blob.type });
        setFilesLoaded([file as FileWithContent]);
      } catch (error) {
        setFetchError((error as Error).message);
      } finally {
        setIsFetching(false);
      }
    }, [form.values.value, handleError]);

    const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (
      event,
    ) => {
      if (!event.clipboardData) return;

      const items = Array.from(event.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith("image/"));

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) setFilesLoaded([file as FileWithContent]);
      }
    };

    useImperativeHandle(ref, () => ({
      open,
      close,
    }));

    return (
      <Modal
        opened={opened}
        onClose={close}
        size="xl"
        closeOnClickOutside={true}
        title={
          <div>
            <IconImageInPicture
              size={24}
              style={{ position: "relative", marginRight: "8px", top: "4px" }}
            />
            <span style={{ fontSize: "19px" }}>{title}</span>
          </div>
        }
      >
        <Box maw="auto" mx="auto">
          <form onSubmit={form.onSubmit(handleSubmit)}>
            {filesLoaded.length === 0 && (
              <>
                <Divider
                  my="l"
                  label="Provide HTTP URL of an image file, or paste an image"
                  labelPosition="center"
                />
                <TextInput
                  onPaste={(e) => handlePaste(e)}
                  label="Paste a URL to an image and click Fetch to grab it, or paste an image from the clipboard"
                  autoFocus={false}
                  placeholder="https://example.com/image.png"
                  mt="sm"
                  mb="sm"
                  {...form.getInputProps("value")}
                />
                <Button
                  onClick={handleFetchImage}
                  loading={isFetching}
                  disabled={!form.values.value.trim()}
                  rightIcon={<IconArrowRight size={14} />}
                  mb="md"
                >
                  Fetch Image from URL
                </Button>
                {fetchError && (
                  <Text color="red" size="sm" mb="md">
                    {fetchError}
                  </Text>
                )}
                <Divider
                  my="l"
                  label="Upload a local image file"
                  labelPosition="center"
                />
              </>
            )}
            {filesLoaded.length > 0 ? (
              filesLoaded.map((p, idx) => (
                <Card
                  key={idx}
                  shadow="sm"
                  radius="sm"
                  pt="0px"
                  pb="4px"
                  mb="md"
                  withBorder
                >
                  <Group position="apart">
                    <Button
                      onClick={() => handleRemoveFileLoaded()}
                      color="red"
                      p="0px"
                      mt="4px"
                      variant="subtle"
                    >
                      <IconX />
                    </Button>
                    <Text weight={500}>{p.path ? p.path : p.name}</Text>
                  </Group>
                </Card>
              ))
            ) : (
              <ImageFileDropzone
                onError={handleError}
                onDrop={(files: FileWithContent[]) => {
                  setFilesLoaded(files);
                  console.log("Files Loaded:", files);
                  // form.setValues({ value: file.content });
                }}
              />
            )}

            <SimpleGrid
              cols={Math.min(previews.length, 3)}
              mt={previews.length > 0 ? "xl" : 0}
            >
              {previews}
            </SimpleGrid>

            <Group position="right" mt="md">
              <Button type="submit">Submit</Button>
            </Group>
          </form>
        </Box>
      </Modal>
    );
  },
);

export default UploadFileModal;

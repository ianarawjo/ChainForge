import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useContext,
  useRef,
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
import { blobOrFileToDataURL, FLASK_BASE_URL } from "./backend/utils";
import { FileWithContent } from "./backend/typing";

// This constant serves as the maximum size of the Image file that can be uploaded
const MAX_SIZE_MB = 50;

// Read a file as text and pass the text to a cb (callback) function
const read_file = (file: FileWithPath) => {
  return new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = function (event) {
      const fileContent = event.target?.result;
      resolve(fileContent ?? null);
    };
    reader.onerror = function (event) {
      reject(new Error("Error reading file"));
    };
    reader.readAsDataURL(file);
  });
};

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
  const [isLoading, setIsLoading] = useState(false);

  const handleDrop = useCallback(
    (files: FileWithPath[]) => {
      setIsLoading(true);

      // Check total size of all files is under the max size
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > MAX_SIZE_MB * 1024 ** 2) {
        onError(
          new Error(
            `Total file size exceeds ${MAX_SIZE_MB} MB. Please select smaller files.`,
          ),
        );
        return;
      }

      // Read each file and pass the content to the onDrop callback
      const readFilePromises = files.map(async (file) => {
        const content = await read_file(file);
        if (typeof content !== "string") {
          console.error("File unreadable: Contents are not text. Skipping...");
          return null;
        } else {
          (file as FileWithContent).content = content;
          return file as FileWithContent;
        }
      });

      // Wait for all files to be read
      Promise.all(readFilePromises)
        .then((filesWithContent) => {
          onDrop(
            filesWithContent.filter(
              (file) => file !== null,
            ) as FileWithContent[],
          );
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error reading files:", error);
          onError(error);
        });
    },
    [onError, onDrop],
  );

  return (
    <Dropzone
      mt="sm"
      loading={isLoading}
      accept={["image/png", "image/jpeg"]} // TODO support all image file types of : import IMAGE_MIME_TYPE from "@mantine/dropzone";
      onDrop={handleDrop}
      onReject={(files) => console.log("Rejected files:", files)}
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

    const previews = filesLoaded.map((file, index) => {
      const imageUrl = URL.createObjectURL(file);
      return (
        <Image
          key={index}
          src={imageUrl}
          onLoad={() => URL.revokeObjectURL(imageUrl)}
        />
      );
    });

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
        const proxyUrl = `${FLASK_BASE_URL}/api/proxyImage?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(`Error fetching image: ${response.statusText}`);
        }

        const blob = await response.blob();
        const b64_string = await blobOrFileToDataURL(blob);

        const file = new File([blob], url, { type: blob.type });
        const fileWithContent = file as FileWithContent;
        fileWithContent.content = b64_string;

        setFilesLoaded([fileWithContent]);
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
        if (file)
          blobOrFileToDataURL(file).then((b64_string) => {
            const fileWithContent = file as FileWithContent;
            fileWithContent.content = b64_string;
            setFilesLoaded([fileWithContent]);
          });
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
            <span style={{ fontSize: "14pt" }}>{title}</span>
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

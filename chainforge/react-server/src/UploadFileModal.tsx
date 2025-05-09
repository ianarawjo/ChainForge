import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useContext,
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
const MAX_SIZE = 50;

// Read a file as text and pass the text to a cb (callback) function
const read_file = (
  file: FileWithPath,
  cb: (contents: string | ArrayBuffer | null, file: FileWithPath) => void,
) => {
  const reader = new window.FileReader();
  reader.onload = function (event) {
    const fileContent = event.target?.result;
    cb(fileContent ?? null, file);
  };
  reader.onerror = function (event) {
    console.error("Error reading file:", event);
  };
  reader.readAsDataURL(file);
};

// ====================================== File Dropzone Modal ======================================

interface ImageFileDropzoneProps {
  onError: (err: string | Error) => void;
  onDrop: (file: FileWithContent) => void;
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

  return (
    <Dropzone
      loading={isLoading}
      accept={["image/png", "image/jpeg"]} // TODO support all image file types of : import IMAGE_MIME_TYPE from "@mantine/dropzone";
      onDrop={(files) => {
        if (files.length === 1) {
          setIsLoading(true);
          read_file(
            files[0],
            (content: string | ArrayBuffer | null, file: FileWithContent) => {
              if (typeof content !== "string") {
                console.error("File unreadable: Contents are not text.");
                return;
              }
              file.content = content;
              onDrop(file as FileWithContent);
              setIsLoading(false);
            },
          );
        } else {
          console.error(
            "Too many files dropped. Only drop one file at a time.",
          );
        }
      }}
      onReject={(files) => console.log("rejected files", files)}
      maxSize={MAX_SIZE * 1024 ** 2}
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
              Drag image here or click to select file
            </Text>
            <Text size="sm" color="dimmed" inline mt={7}>
              {`Attach only one file at a time, each file should not exceed ${MAX_SIZE} MB`}
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
  onSubmit?: (file: FileWithContent) => void;
}

export interface UploadFileModalRef {
  open: () => void;
  close: () => void;
}

/** Modal that lets user upload a single file, usin a TextInput field OR a dropdown field. */
const UploadFileModal = forwardRef<UploadFileModalRef, UploadFileModalProps>(
  function UploadFileModal({ title, onSubmit }, ref) {
    const [opened, { open, close }] = useDisclosure(false);

    const [fileLoaded, setFileLoaded] = useState<FileWithContent[]>([]);
    const [isFetching, setIsFetching] = useState(false);

    const previews = fileLoaded.map((file, index) => {
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

    const handleRemoveFileLoaded = useCallback(() => {
      setFileLoaded([]);
      form.setValues({ value: "" });
    }, [setFileLoaded]);

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

        setFileLoaded([fileWithContent]);
      } catch (error) {
        setFetchError((error as Error).message);
      } finally {
        setIsFetching(false);
      }
    }, [form.values.value, handleError]);

    useEffect(() => {
      form.setValues({ value: "" });
    }, []);

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
          <form
            onSubmit={form.onSubmit(() => {
              if (onSubmit) onSubmit(fileLoaded[0]);
              close();
            })}
          >
            {fileLoaded.length === 0 && (
              <>
                <Divider
                  my="l"
                  label="Provide HTTP url of an image file"
                  labelPosition="center"
                />
                <TextInput
                  label="Click on the fetch button to grab the image from the URL"
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
            {fileLoaded.length > 0 ? (
              fileLoaded.map((p) => (
                <Card
                  key="1"
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
                onDrop={(file: FileWithContent) => {
                  setFileLoaded([file]);
                  console.log("File Loaded:", file);
                  form.setValues({ value: file.content });
                }}
              />
            )}

            <SimpleGrid cols={1} mt={previews.length > 0 ? "xl" : 0}>
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

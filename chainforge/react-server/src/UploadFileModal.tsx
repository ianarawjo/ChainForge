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
import { Dropzone, FileWithPath, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import {
  IconUpload,
  IconBrandPython,
  IconX,
  IconImageInPicture,
} from "@tabler/icons-react";

import { AlertModalContext } from "./AlertModal";

interface FileWithContent extends FileWithPath {
  content?: string;
}

const MAX_SIZE = 50;

// TODO: Change this for image upload
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

// TODO: To improve & Move this function to utils
// given a string, validate if it is a valid image URL
function validate_file_upload(v: string): boolean {
  console.log("Validating URL:", v);
  // TODO: implement this function , check it is an URL or a valid image file
  // check it is an existing URL and points to a image file
  return true;
}

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
              // TODO: Log the content of file in cache
              // Read the file into text and then send it to backend
              onDrop(file as FileWithContent);
              console.log("TODO: Check File is an image");
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
  label: string;
  onSubmit?: (val: string) => void;
}

export interface UploadFileModalRef {
  open: () => void;
  close: () => void;
}

/** Modal that lets user upload a single file, usin a TextInput field OR a dropdown field. */
const UploadFileModal = forwardRef<UploadFileModalRef, UploadFileModalProps>(
  function UploadFileModal({ title, label, onSubmit }, ref) {
    const [opened, { open, close }] = useDisclosure(false);

    const [fileLoaded, setFileLoaded] = useState<FileWithPath[]>([]);

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

    const handleRemoveFileLoaded = useCallback(
      (name: string) => {
        setFileLoaded([]);
        form.setValues({ value: "" });
      },
      [setFileLoaded],
    );

    const showAlert = useContext(AlertModalContext);
    const handleError = useCallback(
      (err: string | Error) => {
        const msg = typeof err === "string" ? err : err.message;
        if (showAlert) showAlert(msg);
      },
      [showAlert],
    );

    const form = useForm({
      initialValues: {
        value: "",
      },
      validate: {
        value: (v) =>
          validate_file_upload(v)
            ? null
            : `Not an URL or local imgage file: ${v}`,
      },
    });

    useEffect(() => {
      form.setValues({ value: "" });
    }, []);

    // This gives the parent access to triggering the modal alert
    const trigger = () => {
      open();
    };
    useImperativeHandle(ref, () => ({
      open,
      close,
    }));

    return (
      <Modal opened={opened} onClose={close} title={title}>
        <Box maw={500} mx="auto">
          <form
            onSubmit={form.onSubmit((values) => {
              if (onSubmit) onSubmit(values.value);
              close();
            })}
          >
            <Divider
              my="xs"
              label="Provide Image URL OR choose Local Image File"
              labelPosition="center"
            />
            {fileLoaded.length === 0 && (
              <TextInput
                label={label}
                autoFocus={false}
                {...form.getInputProps("value")}
              />
            )}
            <Divider my="xs" label="" labelPosition="center" />

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
                    <Group position="left" mt="md" mb="xs">
                      <Text weight={500}>{p.name}</Text>
                    </Group>
                    <Button
                      onClick={() => handleRemoveFileLoaded(p.name)}
                      color="red"
                      p="0px"
                      mt="4px"
                      variant="subtle"
                    >
                      <IconX />
                    </Button>
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

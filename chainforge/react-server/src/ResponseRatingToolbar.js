import React, { forwardRef, useCallback, useMemo, useState } from "react";
import { Button, Flex, Popover, Stack, Textarea } from "@mantine/core";
import { IconMessage2, IconThumbDown, IconThumbUp } from "@tabler/icons-react";

const ToolbarButton = forwardRef(function ToolbarButton(
  { selected, onClick, children },
  ref,
) {
  return (
    <Button
      ref={ref}
      p="0px 2px"
      size="xs"
      color={selected ? "dark" : "gray"}
      onClick={onClick}
      variant="subtle"
      compact
    >
      {children}
    </Button>
  );
});

const ResponseRatingToolbar = ({
  grade,
  annotation,
  uid,
  wideFormat,
  innerIdxs,
  updateResponses,
  onUpdateResponses,
}) => {
  // The internal annotation in the text area, which is only committed upon pressing Save.
  const [annotationText, setAnnotationText] = useState(annotation);
  const [annotationPopoverOpened, setAnnotationPopoverOpened] = useState(false);

  const textAreaLabel = useMemo(() => {
    if (grade === true) return "Why was this good?";
    else if (grade === false) return "Why was this bad?";
    else return "Comment on this response:";
  }, [grade]);

  const size = useMemo(() => {
    return wideFormat ? "14pt" : "10pt";
  }, [wideFormat]);

  // For human labeling of responses in the inspector
  const onGrade = (grade) => {
    if (!updateResponses || uid === undefined) return;
    updateResponses((resps) => {
      if (!resps) return resps;
      resps.forEach((resp_obj) => {
        if (resp_obj.uid === uid) {
          const new_grades = resp_obj?.rating?.grade ?? {};
          innerIdxs.forEach((idx) => {
            new_grades[idx] = grade;
          });
          resp_obj.rating = resp_obj.rating
            ? { ...resp_obj.rating, grade: new_grades }
            : { grade: new_grades };
        }
      });
      // console.log(resps.filter((resp_obj) => resp_obj.rating !== undefined));
      return resps;
    });
    if (onUpdateResponses) onUpdateResponses();
  };

  const onAnnotate = (label) => {
    if (!updateResponses || uid === undefined) return;
    if (typeof label === "string" && label.trim().length === 0)
      label = undefined; // empty strings are undefined
    updateResponses((resps) => {
      if (!resps) return resps;
      resps.forEach((resp_obj) => {
        if (resp_obj.uid === uid) {
          const new_labels = resp_obj?.rating?.note ?? {};
          innerIdxs.forEach((idx) => {
            new_labels[idx] = label;
          });
          resp_obj.rating = resp_obj.rating
            ? { ...resp_obj.rating, note: new_labels }
            : { note: new_labels };
        }
      });
      return resps;
    });
    if (onUpdateResponses) onUpdateResponses();
  };

  const handleSaveAnnotation = useCallback(() => {
    onAnnotate(annotationText);
    setAnnotationPopoverOpened(false);
  }, [annotationText, onAnnotate]);

  return (
    <Flex justify="right" gap="0px">
      <ToolbarButton
        selected={grade === true}
        onClick={() => {
          // If the thumbs is already up, we remove the grade (set to undefined):
          const newGrade = grade === true ? undefined : true;
          onGrade(newGrade);
        }}
      >
        <IconThumbUp size={size} />
      </ToolbarButton>
      <ToolbarButton
        selected={grade === false}
        onClick={() => {
          // If the thumbs is already down, we remove the grade (set to undefined):
          const newGrade = grade === false ? undefined : false;
          onGrade(newGrade);
        }}
      >
        <IconThumbDown size={size} />
      </ToolbarButton>
      <Popover
        opened={annotationPopoverOpened}
        onChange={setAnnotationPopoverOpened}
        onClose={handleSaveAnnotation}
        position="right-start"
        withArrow
        shadow="md"
        withinPortal
        trapFocus
      >
        <Popover.Target>
          <ToolbarButton
            selected={annotation !== undefined}
            onClick={() => setAnnotationPopoverOpened((o) => !o)}
          >
            <IconMessage2 size={size} />
          </ToolbarButton>
        </Popover.Target>
        <Popover.Dropdown className="nodrag nowheel">
          <Stack>
            <Textarea
              value={annotationText}
              autoFocus
              onChange={(e) => setAnnotationText(e.currentTarget.value)}
              label={textAreaLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveAnnotation();
                }
              }}
            />
            <Button variant="light" onClick={handleSaveAnnotation}>
              Save
            </Button>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Flex>
  );
};

export default ResponseRatingToolbar;

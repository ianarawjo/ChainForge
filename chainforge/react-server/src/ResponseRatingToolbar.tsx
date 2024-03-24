import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button, Flex, Popover, Stack, Textarea } from "@mantine/core";
import { IconMessage2, IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import StorageCache from "./backend/cache";
import useStore from "./store";
import { deepcopy } from "./backend/utils";

type RatingDict = Record<number, boolean | string | undefined>;

const getRatingKeyForResponse = (uid: string, label_name: string) =>
  `r.${uid}.${label_name}`;
const collapse_ratings = (rating_dict: RatingDict, idxs: number[]) => {
  if (rating_dict === undefined) return undefined;
  for (let j = 0; j < idxs.length; j++) {
    if (idxs[j] in rating_dict && rating_dict[idxs[j]] !== undefined)
      return rating_dict[idxs[j]];
  }
  return undefined;
};

export const getLabelForResponse = (uid: string, label_name: string) => {
  return StorageCache.get(getRatingKeyForResponse(uid, label_name));
};
export const setLabelForResponse = (
  uid: string,
  label_name: string,
  payload: RatingDict,
) => {
  StorageCache.store(getRatingKeyForResponse(uid, label_name), payload);
};

interface ToolbarButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton({ selected, onClick, children }, ref) {
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
  },
);

export interface ResponseRatingToolbarProps {
  uid: string;
  wideFormat?: boolean;
  innerIdxs: number[];
  onUpdateResponses?: () => void;
}

const ResponseRatingToolbar: React.FC<ResponseRatingToolbarProps> = ({
  uid,
  wideFormat,
  innerIdxs,
  onUpdateResponses,
}) => {
  // The cache keys storing the ratings for this response object
  const gradeKey = getRatingKeyForResponse(uid, "grade");
  const noteKey = getRatingKeyForResponse(uid, "note");

  // The current rating states, reading from the global store.
  // :: This ensures refreshes will occur only on this component, only when the rating
  // :: for this component changes.
  // const state = useStore((store) => store.state);
  const setState = useStore((store) => store.setState);
  const gradeState = useStore<RatingDict>((store) => store.state[gradeKey]);
  const noteState = useStore<RatingDict>((store) => store.state[noteKey]);
  const setRating = useCallback(
    (uid: string, label: string, payload: RatingDict) => {
      const key = getRatingKeyForResponse(uid, label);
      const safe_payload = deepcopy(payload);
      setState(key, safe_payload);
      StorageCache.store(key, safe_payload);
    },
    [setState],
  );

  // The actual states used in the UI. These are distilled versions of the full state,
  // as a consequence that this response rating toolbar can actually apply across multiple responses (texts).
  const grade = useMemo(
    () => collapse_ratings(gradeState, innerIdxs),
    [gradeState, innerIdxs],
  );
  const note = useMemo(
    () => collapse_ratings(noteState, innerIdxs),
    [noteState, innerIdxs],
  );

  // The internal annotation in the text area, which is only committed upon pressing Save.
  const [noteText, setNoteText] = useState("");
  const [notePopoverOpened, setNotePopoverOpened] = useState(false);

  // Override the text in the internal textarea whenever upstream annotation changes.
  useEffect(() => {
    setNoteText(note !== undefined ? note.toString() : "");
  }, [note]);

  // The label for the pop-up comment box.
  const textAreaLabel = useMemo(() => {
    if (grade === true) return "Why was this good?";
    else if (grade === false) return "Why was this bad?";
    else return "Comment on this response:";
  }, [grade]);

  // Adjust button size dynamically depending on format.
  const size = useMemo(() => {
    return wideFormat ? "14pt" : "10pt";
  }, [wideFormat]);

  // For human labeling of responses in the inspector
  const onGrade = (grade: boolean | undefined) => {
    if (uid === undefined) return;
    const new_grades = gradeState ?? {};
    innerIdxs.forEach((idx: number) => {
      new_grades[idx] = grade;
    });
    setRating(uid, "grade", new_grades);
    if (onUpdateResponses) onUpdateResponses();
  };

  const onAnnotate = (label?: string) => {
    if (uid === undefined) return;
    if (typeof label === "string" && label.trim().length === 0)
      label = undefined; // empty strings are undefined
    const new_notes = noteState ?? {};
    innerIdxs.forEach((idx: number) => {
      new_notes[idx] = label;
    });
    setRating(uid, "note", new_notes);
    if (onUpdateResponses) onUpdateResponses();
  };

  const handleSaveAnnotation = useCallback(() => {
    if (note !== noteText) onAnnotate(noteText);
    setNotePopoverOpened(false);
  }, [noteText, onAnnotate]);

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
        opened={notePopoverOpened}
        onChange={setNotePopoverOpened}
        onClose={handleSaveAnnotation}
        position="right-start"
        withArrow
        shadow="md"
        withinPortal
        trapFocus
      >
        <Popover.Target>
          <ToolbarButton
            selected={note !== undefined}
            onClick={() => setNotePopoverOpened((o) => !o)}
          >
            <IconMessage2 size={size} />
          </ToolbarButton>
        </Popover.Target>
        <Popover.Dropdown className="nodrag nowheel">
          <Stack>
            <Textarea
              value={noteText}
              autoFocus
              onChange={(e) => setNoteText(e.currentTarget.value)}
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

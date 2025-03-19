import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dict, LLMResponse, RatingDict } from "../backend/typing";
import {
  Button,
  Center,
  Flex,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import GradingView from "./GradingView";
import { IconThumbDown, IconThumbUp } from "@tabler/icons-react";
import { getRatingKeyForResponse } from "../ResponseRatingToolbar";
import useStore from "../store";
import { deepcopy } from "../backend/utils";
import StorageCache from "../backend/cache";

interface FeedbackStepProps {
  onNext: () => void;
  onPrevious: () => void;
  responses: LLMResponse[];
  setOnNextCallback: React.Dispatch<React.SetStateAction<() => unknown>>;
}

const FeedbackStep: React.FC<FeedbackStepProps> = ({
  onNext,
  onPrevious,
  responses,
  setOnNextCallback,
}) => {
  const [shownResponse, setShownResponse] = useState<LLMResponse | undefined>(
    undefined,
  );
  const [shownResponseIdx, setShownResponseIdx] = useState(0);

  // Global state
  const storeState = useStore<Dict<RatingDict>>((store) => store.state);
  const setStoreState = useStore((store) => store.setState);

  // The cache keys storing the ratings for this response object
  const grade = useMemo(() => {
    if (!shownResponse) return null;
    const key = getRatingKeyForResponse(shownResponse?.uid, "grade");
    const g = storeState[key];
    if (g) return g[0];
    else return null;
  }, [shownResponse, storeState]);
  const annotation = useMemo(() => {
    if (!shownResponse) return "";
    const key = getRatingKeyForResponse(shownResponse?.uid, "note");
    const a = storeState[key];
    if (a) return a[0]?.toString();
    else return "";
  }, [shownResponse, storeState]);

  // Set the rating in the global store, which *should* update the above.
  const setRating = useCallback(
    (
      uid: string | undefined,
      label: string,
      payload: boolean | string | null,
    ) => {
      if (!uid) return;
      const key = getRatingKeyForResponse(uid, label);
      setStoreState(key, { 0: payload }); // TODO: This will erase any feedback given on n>1 responses in the input.
      StorageCache.store(key, { 0: payload });
    },
    [setStoreState],
  );
  const setGrade = (val: boolean | null) =>
    setRating(shownResponse?.uid, "grade", val);
  const setAnnotation = (val: string) =>
    setRating(shownResponse?.uid, "note", val);

  useEffect(() => {
    if (!responses || responses.length === 0) return;
    setShownResponse(responses[0]); // We only show the first response if n>1 resps per prompt, for simplicity's sake
    setShownResponseIdx(0);
  }, [responses]);

  const nextResponse = useCallback(() => {
    if (responses.length === 0) return;
    if (shownResponseIdx < responses.length - 1) {
      setShownResponseIdx(shownResponseIdx + 1);
      setShownResponse(responses[shownResponseIdx + 1]);
    }
  }, [shownResponseIdx, responses]);

  const prevResponse = useCallback(() => {
    if (shownResponseIdx > 0) {
      setShownResponseIdx(shownResponseIdx - 1);
      setShownResponse(responses[shownResponseIdx - 1]);
    }
  }, [shownResponseIdx, responses]);

  return (
    <Stack spacing="lg">
      <Title order={3}>Provide Feedback on Some Model Outputs</Title>

      <GradingView
        shownResponse={shownResponse}
        shownResponseIdx={shownResponseIdx}
        // shownResponseIdx={shownResponseUniqueIdx}
        responseCount={responses.length}
        gotoNextResponse={nextResponse}
        gotoPrevResponse={prevResponse}
      />

      <Flex justify="center" gap="50px" mb="xl">
        <Button
          color={grade === true ? "gray" : "red"}
          variant={grade !== false ? "outline" : "filled"}
          onClick={() => {
            setGrade(grade !== false ? false : null);
          }}
        >
          <IconThumbDown />
          &nbsp;Bad!
        </Button>
        <Button
          color={grade === false ? "gray" : "green"}
          variant={grade !== true ? "outline" : "filled"}
          onClick={() => {
            setGrade(grade !== true ? true : null);
          }}
        >
          <IconThumbUp />
          &nbsp;Good!
        </Button>
      </Flex>
      <Center mb={100}>
        <Stack spacing="xs" w="80%">
          <Text>What&apos;s the reason for your score?</Text>
          <Flex align="center" justify="space-around" gap="lg">
            <Textarea
              value={annotation}
              onChange={(e) => setAnnotation(e.currentTarget.value)}
              disabled={grade === null}
              autoFocus
              w="100%"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  nextResponse();
                }
              }}
            />
            <Button
              onClick={nextResponse}
              disabled={grade === null || !annotation}
            >
              Submit and Next
            </Button>
          </Flex>
        </Stack>
      </Center>
    </Stack>
  );
};

export default FeedbackStep;

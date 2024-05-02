/** 
 * EvalGen 2.0
 * 
 * Ian Arawjo, Shreya Shankar, J.D. Zamf. 
 * 
 * This file concerns the front-end to evaluation generator, EvalGen.
 * EvalGen supports users in generating eval funcs (here binary assertions) and aligning them with their preferences. 
 * 
 * Specifically, the modal lets users:
 *  - make and refine criteria to grade on (on the left)
 *  - grade responses (on the right)
 *  - while in the backend, an LLM is generating candidate assertions and selected the ones most aligned with user grades
 * As the user grades responses, they add/refine existing criteria.
 * This modal presents a shared interface where criteria can be iterated on *alongside* grading. 
 * This is because of **criteria drift,** a phenomenon identified observing users in EvalGen 1.0 (unreleased).
 * 
 * An AI (LLM call) can also suggest criteria based on the implicit context (inputs, such as the prompt)
 * and user feedback during grading (written feedback about failing outputs whose failure couldn't be classified under the immediate criteria set.)
 */
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { ActionIcon, Button, Card, Collapse, Group, Menu, Modal, StarIcon, Text, TextInput, Tooltip, rem } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { LLMResponse } from "./backend/typing";
import { EvalCriteria } from "./backend/evalgen/typing";
import { IconChevronDown, IconChevronRight, IconDots, IconStarFilled, IconTrash } from "@tabler/icons-react";

export interface CriteriaCardProps {
  criterion: EvalCriteria;
  onChange: (changedCriteria: EvalCriteria) => void;
  onDelete: () => void;
  initiallyOpen?: boolean;
}

const CriteriaCard: React.FC<CriteriaCardProps> = ({criterion, onChange, onDelete, initiallyOpen}) => {
  const [opened, { toggle }] = useDisclosure(initiallyOpen ?? false);
  const [title, setTitle] = useState(criterion.shortname ?? "New Criteria");

  return (
    <Card
      withBorder
      mb={4}
      radius="md"
      style={{ cursor: "default" }}
    >
      <Card.Section withBorder pl="8px">
        <Group>
          <Group spacing="0px">

            {/* The arrow chevron user can click to collapse/expand */}
            <Button
              onClick={toggle}
              variant="subtle"
              color="gray"
              p="0px"
              m="0px"
            >
              {opened ? (
                <IconChevronDown size="14pt" />
              ) : (
                <IconChevronRight size="14pt" />
              )}
            </Button>

            {/* Favorite star toggle */}
            <Tooltip label={criterion.priority <= 0 ? "Make this a deal-breaker" : "It's a deal-breaker"}>
              <IconStarFilled 
                size="14pt" 
                color={criterion.priority <= 0 ? "#aaa" : "#bfa940"} 
                onClick={() => {
                  criterion.priority = criterion.priority <= 0 ? 1 : 0;
                  if (onChange) onChange(criterion);
                }} 
              />
            </Tooltip>

            {/* Title of the criteria */}
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => {
                criterion.shortname = e.target.value;
                if (onChange) onChange(criterion);
              }}
              placeholder="Criteria name"
              variant="unstyled"
              size="sm"
              className="nodrag nowheel"
              styles={{
                input: {
                  padding: "0px",
                  height: "14pt",
                  minHeight: "0pt",
                  fontWeight: 500,
                },
              }}
            />
          </Group>

          <Group spacing="4px" ml="auto">
            {/* Whether this criteria should be implemented with code (function) or an LLM evaluator */}
            <Tooltip label={criterion.eval_method === "code" ? "Click to change this to an LLM evaluator" : "Click to change this to a code evaluator"}>
              <Text color="#bbb" size="sm" mr="6px" onClick={() => {
                criterion.eval_method = criterion.eval_method === "code" ? "expert" : "code";
                if (onChange) onChange(criterion);
              }}>
                {criterion.eval_method === "code" ? "Python" : "LLM"}
              </Text>
            </Tooltip>

            {/* Delete button (and any other criterion-specific changes in the future) */}
            <Menu withinPortal position="right-start" shadow="sm">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDots style={{ width: rem(16), height: rem(16) }} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  icon={<IconTrash size="14px" />}
                  color="red"
                  onClick={onDelete}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Card.Section>

      <Card.Section p="0px">
        <Collapse in={opened}>
          {criterion.criteria}
        </Collapse>
      </Card.Section>
    </Card>);
};

export interface EvalGenModalHandle {
  trigger: () => void;
}

export interface EvalGenModalProps {
  responses: LLMResponse[];
}

const EvalGenModal = forwardRef<EvalGenModalHandle,EvalGenModalProps>(
  function EvalGenModal({responses}, ref) {
    const [opened, { open, close }] = useDisclosure(false);

    // This gives the parent access to triggering the modal alert
    const trigger = () => {
      open();
    };
    useImperativeHandle(ref, () => ({
      trigger,
    }));

    return <Modal
      size="90%"
      keepMounted
      opened={opened}
      onClose={close}
      closeOnClickOutside={true}
      style={{ position: "relative", left: "-5%" }}
    >
      Hello World
    </Modal>;
  }
);

export default EvalGenModal;
import React, { useState } from "react";
import useStore from "./store";
import NodeLabel from "./NodeLabelComponent";
import BaseNode from "./BaseNode";
import { Textarea } from "@mantine/core";

export interface CommentNodeProps {
  data: {
    text: string;
    title: string;
  };
  id: string;
}

/**
 * A node without any inputs or outputs that
 * lets users write comment about their flow.
 */
const CommentNode: React.FC<CommentNodeProps> = ({ data, id }) => {
  const [value, setValue] = useState(data.text || "");
  const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

  const handleChangeComment = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const txt = evt.currentTarget.value;
    setValue(txt);
    setDataPropsForNode(id, { text: txt });
  };

  return (
    <BaseNode nodeId={id} style={{ backgroundColor: "#eee" }}>
      <NodeLabel title={data.title || "Comment"} nodeId={id} icon={"✏️"} />
      <Textarea
        value={value}
        onChange={handleChangeComment}
        placeholder="I love ChainForge!"
        className="nodrag"
        autosize
        w={"260px"}
        minRows={2}
        styles={{ input: { border: "none", backgroundColor: "#eee" } }}
      />
    </BaseNode>
  );
};

export default CommentNode;

import React from "react";
import { Dict } from "./backend/typing";
import { truncStr } from "./backend/utils";

const PlotLegend = ({
  labels,
  onClickLabel,
}: {
  labels: Dict<string>;
  onClickLabel: (label: string) => void;
}) => {
  return (
    <div className="plot-legend">
      {Object.entries(labels).map(([label, color]) => (
        <div
          key={label}
          className="plot-legend-item nodrag"
          onClick={() => onClickLabel(label)}
        >
          <span
            style={{
              backgroundColor: color,
              width: "10px",
              height: "10px",
              display: "inline-block",
            }}
          ></span>
          <span style={{ marginLeft: "5px" }}>{truncStr(label, 56)}</span>
        </div>
      ))}
    </div>
  );
};

export default PlotLegend;

import React from "react";

const truncStr = (s, maxLen) => {
  if (s.length > maxLen)
    // Cut the name short if it's long
    return s.substring(0, maxLen) + "...";
  else return s;
};

const PlotLegend = ({ labels, onClickLabel }) => {
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

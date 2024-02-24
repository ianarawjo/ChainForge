import React from "react";
import { Slider } from "@mantine/core";
import { IconTemperature } from "@tabler/icons-react";

const styles = { thumb: { borderWidth: 2, height: 24, width: 24, padding: 3 } };

export default function TemperatureSlider({ style }) {
  return (
    <div style={style}>
      <Slider
        thumbChildren={<IconTemperature size="1rem" stroke={1.5} />}
        color="red"
        label={null}
        defaultValue={40}
        styles={styles}
      />

      {/* <RangeSlider
        mt="xl"
        styles={styles}
        color="red"
        label={null}
        defaultValue={[20, 60]}
        thumbChildren={[
          <IconTemperature size="1rem" stroke={1.5} key="1" />,
          <IconTemperatureOff size="1rem" stroke={1.5} key="2" />,
        ]}
      /> */}
    </div>
  );
}

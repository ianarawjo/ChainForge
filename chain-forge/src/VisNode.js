import React, { useState } from 'react';
import { Handle } from 'react-flow-renderer';
import useStore from './store';
import Plot from 'react-plotly.js';

const VisNode = ({ data, id }) => {

    const [hovered, setHovered] = useState(false);
    const [selected, setSelected] = useState(false);
    const [plotlyObj, setPlotlyObj] = useState([]);
    const [pastInputs, setPastInputs] = useState([]);
    
    const handleMouseEnter = () => {
      setHovered(true);
    };
    const handleMouseLeave = () => {
      setHovered(false);
    };
    const handleClick = () => {
      setSelected(!selected);
    };
  
    const handleOnConnect = () => {
        // Grab the input node ids
        const input_node_ids = [data.input];

        console.log(data.input, pastInputs);

        const response = fetch('http://localhost:5000/grabResponses', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            body: JSON.stringify({
                responses: input_node_ids,
            }),
        }).then(function(res) {
            return res.json();
        }).then(function(json) {
            console.log(json);
            if (json.responses && json.responses.length > 0) {

                // Create Plotly spec here
                const varnames = Object.keys(json.responses[0].vars);
                let spec = {};
                if (varnames.length === 1) {
                    // 1 var; numeric eval
                    // spec = {
                    //     type: 'bar',
                    //     x: json.responses.map(r => r.vars[varnames[0]]),
                    //     y: json.responses.map(r => r.eval_res.mean),
                    // }
                    spec = json.responses.map(r => {
                        return {type: 'box', y: r.eval_res.items, name: r.vars[varnames[0]].trim()};
                    });
                }
                else if (varnames.length === 2) {
                    // 2 vars; numeric eval
                    spec = {
                        type: 'scatter3d',
                        x: json.responses.map(r => r.vars[varnames[0]]),
                        y: json.responses.map(r => r.vars[varnames[1]]),
                        z: json.responses.map(r => r.eval_res.mean),
                    }
                }

                if (!Array.isArray(spec))
                    spec = [spec];

                setPlotlyObj((
                    <Plot
                        data={spec}
                        layout={ {width: 320, height: 240, title: '', margin: {
                            l: 20, r: 20, b: 20, t: 20, pad: 2
                        }} }
                    />
                ))

            } else {

            }
        });
        // Analyze its structure --how many 'vars'?


        // Based on its structure, construct a Plotly data visualization
        // :: For 1 var and 1 eval_res that's a number, plot {x: var, y: eval_res}
        // :: For 2 vars and 1 eval_res that's a number, plot {x: var1, y: var2, z: eval_res}
        // :: For all else, don't plot anything (at the moment)
    };
    
    // console.log('from visnode', data);
    if (data.input) {
        // If there's a change in inputs...
        if (data.input != pastInputs) {
            setPastInputs(data.input);
            handleOnConnect();
        }
    }
        
    const borderStyle = selected
      ? '2px solid #222'
      : hovered
      ? '1px solid #222'
      : '1px solid #999';
  
    return (
      <div 
        className="vis-node"
        style={{ border: borderStyle }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="node-header">
          Vis Node
        </div>
        {plotlyObj}
        <Handle
            type="target"
            position="left"
            id="input"
            style={{ top: '50%', background: '#555' }}
            onConnect={handleOnConnect}
        />
      </div>
    );
  };
  
  export default VisNode;
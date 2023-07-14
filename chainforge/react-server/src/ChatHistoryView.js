import { forwardRef } from "react";

const ChatHistoryView = forwardRef(({ messages, bgColors }, ref) => {
  const _bg_color = bgColors !== undefined ? bgColors : ['#333', '#333'];
  return (
    <div ref={ref} className="chat-history">
      {messages.map((msg, idx) => (
        <div className={"chat-bubble chat-msg-" + (idx % 2 === 0 ? "left" : "right")} style={{ backgroundColor: _bg_color[idx % 2] }}>
          {msg}
        </div>
      ))}
    </div>
  );
});

export default ChatHistoryView;

// const ChatTurnNode = ({ data, id }) => {
//   return (
//     <div className="chat-history">
//       <div className="chat-bubble chat-msg-left">Bro ipsum dolor sit amet gaper backside single track, manny Bike epic clipless. Schraeder drop gondy, rail fatty slash gear jammer steeps</div>
//       <div className="chat-bubble chat-msg-right">Ok, Thank you</div>
//       <div className="chat-bubble chat-msg-left"> ut labore et dolore magna </div>
//       <div className="chat-bubble chat-msg-right">👌</div>
//     </div>
//   );
// };

// export default ChatTurnNode;
// import React, {
//   useState,
//   useRef,
//   useEffect,
//   ChangeEvent,
//   KeyboardEvent,
//   MouseEvent,
// } from "react";
// import "./Chatbot.css";
//
// interface Message {
//   type: "incoming" | "outgoing";
//   text: string;
//   error?: boolean;
// }
//
// const Chatbot: React.FC = () => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [messages, setMessages] = useState<Message[]>([
//     { type: "incoming", text: "Hi there 👋\nHow can I help you today?" },
//   ]);
//   const [input, setInput] = useState("");
//   const [threadId, setThreadId] = useState<string | null>(null);
//   const chatboxRef = useRef<HTMLUListElement>(null);
//   const chatInputRef = useRef<HTMLTextAreaElement>(null);
//
//   const inputInitHeight = 55; // Initial height of the input textarea
//
//   const toggleChatbot = () => {
//     setIsOpen(!isOpen);
//     if (!threadId) {
//       fetch("http://localhost:8080/start")
//         .then((response) => response.json())
//         .then((data) => {
//           setThreadId(data.thread_id);
//         });
//     }
//   };
//
//   const createChatLi = (
//     message: string,
//     className: "incoming" | "outgoing",
//   ): Message => {
//     return { type: className, text: message };
//   };
//
//   const generateResponse = (messageElement: Message) => {
//     const requestOptions = {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         message: messageElement.text,
//         thread_id: threadId,
//       }),
//     };
//
//     fetch("http://localhost:8080/chat", requestOptions)
//       .then((res) => res.json())
//       .then((data) => {
//         setMessages((prevMessages) =>
//           prevMessages.map((msg) =>
//             msg === messageElement
//               ? { ...msg, text: data.response.trim() }
//               : msg,
//           ),
//         );
//         if (!threadId) {
//           setThreadId(data.thread_id);
//         }
//       })
//       .catch(() => {
//         setMessages((prevMessages) =>
//           prevMessages.map((msg) =>
//             msg === messageElement
//               ? {
//                   ...msg,
//                   text: "Oops! Something went wrong. Please try again.",
//                   error: true,
//                 }
//               : msg,
//           ),
//         );
//       })
//       .finally(() => {
//         if (chatboxRef.current) {
//           chatboxRef.current.scrollTo(0, chatboxRef.current.scrollHeight);
//         }
//       });
//   };
//
//   const handleChat = () => {
//     const userMessage = input.trim();
//     if (!userMessage) return;
//
//     setInput("");
//     if (chatInputRef.current) {
//       chatInputRef.current.style.height = `${inputInitHeight}px`;
//     }
//
//     const outgoingMessage = createChatLi(userMessage, "outgoing");
//     setMessages((prevMessages) => [...prevMessages, outgoingMessage]);
//
//     setTimeout(() => {
//       const incomingMessage = createChatLi("Thinking...", "incoming");
//       setMessages((prevMessages) => [...prevMessages, incomingMessage]);
//       generateResponse(incomingMessage);
//     }, 600);
//   };
//
//   useEffect(() => {
//     if (chatboxRef.current) {
//       chatboxRef.current.scrollTo(0, chatboxRef.current.scrollHeight);
//     }
//   }, [messages]);
//
//   const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
//     setInput(e.target.value);
//     if (chatInputRef.current) {
//       chatInputRef.current.style.height = `${inputInitHeight}px`;
//       chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
//     }
//   };
//
//   const handleInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
//       e.preventDefault();
//       handleChat();
//     }
//   };
//
//   const handleSendClick = (e: MouseEvent<HTMLSpanElement>) => {
//     handleChat();
//   };
//
//   return (
//     <div className={isOpen ? "show-chatbot" : ""}>
//       <link
//         rel="stylesheet"
//         href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0"
//       />
//       <link
//         rel="stylesheet"
//         href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,1,0"
//       />
//       <button className="chatbot-toggler" onClick={toggleChatbot}>
//         <span className="material-symbols-rounded">mode_comment</span>
//         <span className="material-symbols-outlined">close</span>
//       </button>
//       {isOpen && (
//         <div className="chatbot">
//           <header>
//             <h2>Chainforge Bot</h2>
//             <span
//               className="close-btn material-symbols-outlined"
//               onClick={toggleChatbot}
//             >
//               close
//             </span>
//           </header>
//           <ul className="chatbox" ref={chatboxRef}>
//             {messages.map((msg, index) => (
//               <li key={index} className={`chat ${msg.type}`}>
//                 <span className="material-symbols-outlined">smart_toy</span>
//                 <p className={msg.error ? "error" : ""}>{msg.text}</p>
//               </li>
//             ))}
//           </ul>
//           <div className="chat-input">
//             <textarea
//               ref={chatInputRef}
//               placeholder="Enter a message..."
//               spellCheck="false"
//               required
//               value={input}
//               onChange={handleInputChange}
//               onKeyDown={handleInputKeyDown}
//             ></textarea>
//             <span
//               id="send-btn"
//               className="material-symbols-rounded"
//               onClick={handleSendClick}
//             >
//               send
//             </span>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };
//
// export default Chatbot;

// import React, {
//   useState,
//   useRef,
//   useEffect,
//   ChangeEvent,
//   KeyboardEvent,
//   MouseEvent,
// } from "react";
// import "./Chatbot.css";
//
// interface Message {
//   type: "incoming" | "outgoing";
//   text: string;
//   error?: boolean;
// }
//
// const Chatbot: React.FC = () => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [messages, setMessages] = useState<Message[]>([
//     { type: "incoming", text: "Hi there 👋\nHow can I help you today?" },
//   ]);
//   const [input, setInput] = useState("");
//   const [threadId, setThreadId] = useState<string | null>(null);
//   const chatboxRef = useRef<HTMLUListElement>(null);
//   const chatInputRef = useRef<HTMLTextAreaElement>(null);
//
//   const inputInitHeight = 55; // Initial height of the input textarea
//
//   const toggleChatbot = () => {
//     setIsOpen(!isOpen);
//     if (!threadId) {
//       fetch("http://localhost:8080/start")
//         .then((response) => response.json())
//         .then((data) => {
//           setThreadId(data.thread_id);
//         });
//     }
//   };
//
//   const createChatLi = (
//     message: string,
//     className: "incoming" | "outgoing",
//   ): Message => {
//     return { type: className, text: message };
//   };
//
//   const generateResponse = async (
//     userMessage: string,
//     incomingMessage: Message,
//   ) => {
//     try {
//       const requestOptions = {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           message: userMessage,
//           thread_id: threadId,
//         }),
//       };
//
//       const response = await fetch(
//         "http://localhost:8080/chat",
//         requestOptions,
//       );
//       const data = await response.json();
//
//       setMessages((prevMessages) =>
//         prevMessages.map((msg) =>
//           msg === incomingMessage
//             ? { ...msg, text: data.response.trim() }
//             : msg,
//         ),
//       );
//
//       if (!threadId) {
//         setThreadId(data.thread_id);
//       }
//     } catch (error) {
//       setMessages((prevMessages) =>
//         prevMessages.map((msg) =>
//           msg === incomingMessage
//             ? {
//                 ...msg,
//                 text: "Oops! Something went wrong. Please try again.",
//                 error: true,
//               }
//             : msg,
//         ),
//       );
//     } finally {
//       if (chatboxRef.current) {
//         chatboxRef.current.scrollTo(0, chatboxRef.current.scrollHeight);
//       }
//     }
//   };
//
//   const handleChat = () => {
//     const userMessage = input.trim();
//     if (!userMessage) return;
//
//     setInput("");
//     if (chatInputRef.current) {
//       chatInputRef.current.style.height = `${inputInitHeight}px`;
//     }
//
//     const outgoingMessage = createChatLi(userMessage, "outgoing");
//     setMessages((prevMessages) => [...prevMessages, outgoingMessage]);
//
//     const incomingMessage = createChatLi("Thinking...", "incoming");
//     setMessages((prevMessages) => [...prevMessages, incomingMessage]);
//
//     // Pass the userMessage directly to generateResponse
//     generateResponse(userMessage, incomingMessage);
//   };
//
//   useEffect(() => {
//     if (chatboxRef.current) {
//       chatboxRef.current.scrollTo(0, chatboxRef.current.scrollHeight);
//     }
//   }, [messages]);
//
//   const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
//     setInput(e.target.value);
//     if (chatInputRef.current) {
//       chatInputRef.current.style.height = `${inputInitHeight}px`;
//       chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
//     }
//   };
//
//   const handleInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
//       e.preventDefault();
//       handleChat();
//     }
//   };
//
//   const handleSendClick = (e: MouseEvent<HTMLSpanElement>) => {
//     handleChat();
//   };
//
//   return (
//     <div className={isOpen ? "show-chatbot" : ""}>
//       <link
//         rel="stylesheet"
//         href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0"
//       />
//       <link
//         rel="stylesheet"
//         href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,1,0"
//       />
//       <button className="chatbot-toggler" onClick={toggleChatbot}>
//         <span className="material-symbols-rounded">mode_comment</span>
//         <span className="material-symbols-outlined">close</span>
//       </button>
//       {isOpen && (
//         <div className="chatbot">
//           <header>
//             <h2>Chainforge Bot</h2>
//             <span
//               className="close-btn material-symbols-outlined"
//               onClick={toggleChatbot}
//             >
//               close
//             </span>
//           </header>
//           <ul className="chatbox" ref={chatboxRef}>
//             {messages.map((msg, index) => (
//               <li key={index} className={`chat ${msg.type}`}>
//                 <span className="material-symbols-outlined">smart_toy</span>
//                 <p className={msg.error ? "error" : ""}>{msg.text}</p>
//               </li>
//             ))}
//           </ul>
//           <div className="chat-input">
//             <textarea
//               ref={chatInputRef}
//               placeholder="Enter a message..."
//               spellCheck="false"
//               required
//               value={input}
//               onChange={handleInputChange}
//               onKeyDown={handleInputKeyDown}
//             ></textarea>
//             <span
//               id="send-btn"
//               className="material-symbols-rounded"
//               onClick={handleSendClick}
//             >
//               send
//             </span>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };
//
// export default Chatbot;
import React, {
  useState,
  useRef,
  useEffect,
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";
import "./Chatbot.css";

interface Message {
  type: "incoming" | "outgoing";
  text: string;
  loading?: boolean;
  error?: boolean;
}

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { type: "incoming", text: "Hi there 👋\nHow can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const chatboxRef = useRef<HTMLUListElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const inputInitHeight = 55; // Initial height of the input textarea

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
    if (!threadId) {
      fetch("http://localhost:8080/start")
        .then((response) => response.json())
        .then((data) => {
          setThreadId(data.thread_id);
        });
    }
  };

  const createChatLi = (
    message: string,
    className: "incoming" | "outgoing",
    loading = false,
  ): Message => {
    return { type: className, text: message, loading };
  };

  const generateResponse = async (
    userMessage: string,
    incomingMessage: Message,
  ) => {
    try {
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          thread_id: threadId,
        }),
      };

      const response = await fetch(
        "http://localhost:8080/chat",
        requestOptions,
      );
      const data = await response.json();

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg === incomingMessage
            ? { ...msg, text: data.response.trim(), loading: false }
            : msg,
        ),
      );

      if (!threadId) {
        setThreadId(data.thread_id);
      }
    } catch (error) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg === incomingMessage
            ? {
                ...msg,
                text: "Oops! Something went wrong. Please try again.",
                error: true,
                loading: false,
              }
            : msg,
        ),
      );
    } finally {
      if (chatboxRef.current) {
        chatboxRef.current.scrollTo(0, chatboxRef.current.scrollHeight);
      }
    }
  };

  const handleChat = () => {
    const userMessage = input.trim();
    if (!userMessage) return;

    setInput("");
    if (chatInputRef.current) {
      chatInputRef.current.style.height = `${inputInitHeight}px`;
    }

    const outgoingMessage = createChatLi(userMessage, "outgoing");
    setMessages((prevMessages) => [...prevMessages, outgoingMessage]);

    const incomingMessage = createChatLi("", "incoming", true);
    setMessages((prevMessages) => [...prevMessages, incomingMessage]);

    generateResponse(userMessage, incomingMessage);
  };

  useEffect(() => {
    if (chatboxRef.current) {
      chatboxRef.current.scrollTo(0, chatboxRef.current.scrollHeight);
    }
  }, [messages]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (chatInputRef.current) {
      chatInputRef.current.style.height = `${inputInitHeight}px`;
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
      e.preventDefault();
      handleChat();
    }
  };

  const handleSendClick = (e: MouseEvent<HTMLSpanElement>) => {
    handleChat();
  };

  return (
    <div className={isOpen ? "show-chatbot" : ""}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,1,0"
      />
      <button className="chatbot-toggler" onClick={toggleChatbot}>
        <span className="material-symbols-rounded">mode_comment</span>
        <span className="material-symbols-outlined">close</span>
      </button>
      {isOpen && (
        <div className="chatbot">
          <header>
            <h2>Chainforge Bot</h2>
            <span
              className="close-btn material-symbols-outlined"
              onClick={toggleChatbot}
            >
              close
            </span>
          </header>
          <ul className="chatbox" ref={chatboxRef}>
            {messages.map((msg, index) => (
              <li
                key={index}
                className={`chat ${msg.type} ${msg.loading ? "loading" : ""}`}
              >
                <span className="material-symbols-outlined">smart_toy</span>
                <p className={msg.error ? "error" : ""}>
                  {msg.loading ? "" : msg.text}
                </p>
              </li>
            ))}
          </ul>
          <div className="chat-input">
            <textarea
              ref={chatInputRef}
              placeholder="Enter a message..."
              spellCheck="false"
              required
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
            ></textarea>
            <span
              id="send-btn"
              className="material-symbols-rounded"
              onClick={handleSendClick}
            >
              send
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;

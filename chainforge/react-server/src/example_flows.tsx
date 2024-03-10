/*
 *  A place to store hardcoded (guaranteed to load) example flows. Use sparingly.
 */
export const EXAMPLEFLOW_1 = {
  flow: {
    nodes: [
      {
        width: 312,
        height: 393,
        id: "prompt-1687991312103",
        type: "prompt",
        data: {
          prompt: "What is the opening sentence of {book}?",
          n: 1,
          llms: [
            {
              key: "06fd174b-ae9a-45bd-a474-55ad36d9a7b3",
              name: "Falcon.7b",
              emoji: "🤗",
              model: "tiiuae/falcon-7b-instruct",
              base_model: "hf",
              temp: 1,
              settings: {
                custom_model: "",
                temperature: 1,
                num_continuations: 0,
                top_k: -1,
                top_p: -1,
                repetition_penalty: -1,
                max_new_tokens: 250,
                do_sample: true,
                use_cache: false,
              },
              formData: {
                shortname: "Falcon.7b",
                model: "tiiuae/falcon-7b-instruct",
                custom_model: "",
                temperature: 1,
                num_continuations: 0,
                top_k: -1,
                top_p: -1,
                repetition_penalty: -1,
                max_new_tokens: 250,
                do_sample: true,
                use_cache: false,
              },
            },
            {
              key: "12ec9c5d-f430-4af2-a631-94c86fd4a748",
              name: "ChatGPT",
              emoji: "🤖",
              model: "gpt-3.5-turbo",
              base_model: "gpt-3.5-turbo",
              temp: 1,
              settings: {
                system_msg: "You are a helpful assistant.",
                temperature: 1,
                functions: [],
                function_call: "",
                top_p: 1,
                stop: [],
                presence_penalty: 0,
                frequency_penalty: 0,
              },
              formData: {
                shortname: "ChatGPT",
                model: "gpt-3.5-turbo",
                system_msg: "You are a helpful assistant.",
                temperature: 1,
                functions: "",
                function_call: "",
                top_p: 1,
                stop: "",
                presence_penalty: 0,
                frequency_penalty: 0,
              },
            },
          ],
          fields: [
            {
              text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
              fill_history: {
                book: "Pride and Prejudice by Jane Austen",
              },
              metavars: {
                LLM_0: "Falcon.7b",
              },
            },
            {
              text: "The opening sentence of Crime and Punishment by Dostoevsky is: 'It was a bright, sunny day in the middle of the summer, and the sun was shining through the window of the little room where Raskolnikov was sitting.'",
              fill_history: {
                book: "Crime and Punishment by Dostoevsky",
              },
              metavars: {
                LLM_0: "Falcon.7b",
              },
            },
            {
              text: "The opening sentence of The Secret History by Donna Tartt is: 'The first time I saw her, she was standing in the doorway of the house, the sun behind her, and I thought she was the most beautiful thing I had ever seen.'",
              fill_history: {
                book: "The Secret History by Donna Tartt",
              },
              metavars: {
                LLM_0: "Falcon.7b",
              },
            },
            {
              text: "The opening sentence of Beloved by Toni Morrison is: 'Beloved, I am writing to tell you I am thinking of you.'",
              fill_history: {
                book: "Beloved by Toni Morrison",
              },
              metavars: {
                LLM_0: "Falcon.7b",
              },
            },
            {
              text: "The opening sentence of Mistborn by Brandon Sanderson is: 'The sun was setting, painting the sky with hues of red and gold, casting long shadows across the city of Luthadel.'",
              fill_history: {
                book: "Mistborn by Brandon Sanderson",
              },
              metavars: {
                LLM_0: "Falcon.7b",
              },
            },
            {
              text: "The world of the Poppy War is one of magic and war, where the fate of nations rests on the shoulders of a single girl.",
              fill_history: {
                book: "The Poppy War by R.F.Kuang",
              },
              metavars: {
                LLM_0: "Falcon.7b",
              },
            },
            {
              text: '"It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."',
              fill_history: {
                book: "Pride and Prejudice by Jane Austen",
              },
              metavars: {
                LLM_0: "ChatGPT",
              },
            },
            {
              text: 'The opening sentence of "Crime and Punishment" by Fyodor Dostoevsky is: "On an exceptionally hot evening early in July, a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge."',
              fill_history: {
                book: "Crime and Punishment by Dostoevsky",
              },
              metavars: {
                LLM_0: "ChatGPT",
              },
            },
            {
              text: '"The',
              fill_history: {
                book: "The Secret History by Donna Tartt",
              },
              metavars: {
                LLM_0: "ChatGPT",
              },
            },
            {
              text: '"124 was spiteful."',
              fill_history: {
                book: "Beloved by Toni Morrison",
              },
              metavars: {
                LLM_0: "ChatGPT",
              },
            },
            {
              text: '"The mists come at night."',
              fill_history: {
                book: "Mistborn by Brandon Sanderson",
              },
              metavars: {
                LLM_0: "ChatGPT",
              },
            },
            {
              text: '"The fishing village of Tikany was made of white stone, its streets narrow and ascending, paved with flat stones that clicked beneath Rin\'s sandals as she followed Altan up the path toward the burning pyres."',
              fill_history: {
                book: "The Poppy War by R.F.Kuang",
              },
              metavars: {
                LLM_0: "ChatGPT",
              },
            },
          ],
        },
        position: {
          x: 144,
          y: 176,
        },
        selected: false,
        positionAbsolute: {
          x: 144,
          y: 176,
        },
        dragging: false,
      },
      {
        width: 375,
        height: 438,
        id: "inspect-1687991312103",
        type: "inspect",
        data: {
          input: "prompt-1687991312103",
          refresh: false,
        },
        position: {
          x: 544,
          y: 176,
        },
        selected: false,
        positionAbsolute: {
          x: 544,
          y: 176,
        },
        dragging: false,
      },
      {
        width: 322,
        height: 346,
        id: "textFieldsNode-1688305190489",
        type: "textfields",
        data: {
          fields: {
            f1: "Pride and Prejudice by Jane Austen",
            f2: "Crime and Punishment by Dostoevsky",
            f3: "The Secret History by Donna Tartt",
            f4: "Beloved by Toni Morrison",
            f5: "Mistborn by Brandon Sanderson",
            f6: "The Poppy War by R.F.Kuang",
          },
        },
        position: {
          x: -256,
          y: 192,
        },
        selected: true,
        positionAbsolute: {
          x: -256,
          y: 192,
        },
        dragging: false,
      },
    ],
    edges: [
      {
        source: "prompt-1687991312103",
        sourceHandle: "prompt",
        target: "inspect-1687991312103",
        targetHandle: "input",
        interactionWidth: 100,
        markerEnd: {
          type: "arrow",
          width: "22px",
          height: "22px",
        },
        id: "reactflow__edge-prompt-1687991312103prompt-inspect-1687991312103input",
      },
      {
        source: "prompt-1687991312103",
        sourceHandle: "prompt",
        target: "evalNode-1688076208304",
        targetHandle: "responseBatch",
        interactionWidth: 100,
        markerEnd: {
          type: "arrow",
          width: "22px",
          height: "22px",
        },
        id: "reactflow__edge-prompt-1687991312103prompt-evalNode-1688076208304responseBatch",
      },
      {
        source: "prompt-1687991312103",
        sourceHandle: "prompt",
        target: "promptNode-1688077033083",
        targetHandle: "context",
        interactionWidth: 100,
        markerEnd: {
          type: "arrow",
          width: "22px",
          height: "22px",
        },
        id: "reactflow__edge-prompt-1687991312103prompt-promptNode-1688077033083context",
      },
      {
        source: "textFieldsNode-1688305190489",
        sourceHandle: "output",
        target: "prompt-1687991312103",
        targetHandle: "book",
        interactionWidth: 100,
        markerEnd: {
          type: "arrow",
          width: "22px",
          height: "22px",
        },
        id: "reactflow__edge-textFieldsNode-1688305190489output-prompt-1687991312103book",
      },
      {
        source: "evalNode-1688076208304",
        sourceHandle: "output",
        target: "visNode-1688305530322",
        targetHandle: "input",
        interactionWidth: 100,
        markerEnd: {
          type: "arrow",
          width: "22px",
          height: "22px",
        },
        id: "reactflow__edge-evalNode-1688076208304output-visNode-1688305530322input",
      },
    ],
    viewport: {
      x: 474,
      y: 63,
      zoom: 1,
    },
  },
  cache: {
    "prompt-1687991312103_1.json": {
      "What is the opening sentence of Pride and Prejudice?": {
        prompt: "What is the opening sentence of Pride and Prejudice?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
        ],
        raw_response: [
          {
            generated_text:
              "\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Pride and Prejudice",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of Crime and Punishment?": {
        prompt: "What is the opening sentence of Crime and Punishment?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of Crime and Punishment is 'It was the best of times, it was the worst of times...'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of Crime and Punishment is 'It was the best of times, it was the worst of times...'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Crime and Punishment",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of The Secret History?": {
        prompt: "What is the opening sentence of The Secret History?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of The Secret History is: 'The first time I saw her, she was standing in the middle of a circle of dead children.'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of The Secret History is: 'The first time I saw her, she was standing in the middle of a circle of dead children.'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "The Secret History",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of Beloved?": {
        prompt: "What is the opening sentence of Beloved?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of Beloved is 'I am a bird in a cage.'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of Beloved is 'I am a bird in a cage.'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Beloved",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of Mistborn?": {
        prompt: "What is the opening sentence of Mistborn?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of Mistborn is 'The sun was setting, painting the sky with hues of red and gold.'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of Mistborn is 'The sun was setting, painting the sky with hues of red and gold.'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Mistborn",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of Pride and Prejudice by Jane Austen?": {
        prompt:
          "What is the opening sentence of Pride and Prejudice by Jane Austen?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
        ],
        raw_response: [
          {
            generated_text:
              "\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Pride and Prejudice by Jane Austen",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of Crime and Punishment by Dostoevsky?": {
        prompt:
          "What is the opening sentence of Crime and Punishment by Dostoevsky?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of Crime and Punishment by Dostoevsky is: 'It was a bright, sunny day in the middle of the summer, and the sun was shining through the window of the little room where Raskolnikov was sitting.'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of Crime and Punishment by Dostoevsky is: 'It was a bright, sunny day in the middle of the summer, and the sun was shining through the window of the little room where Raskolnikov was sitting.'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Crime and Punishment by Dostoevsky",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of The Secret History by Donna Tartt?": {
        prompt:
          "What is the opening sentence of The Secret History by Donna Tartt?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of The Secret History by Donna Tartt is: 'The first time I saw her, she was standing in the doorway of the house, the sun behind her, and I thought she was the most beautiful thing I had ever seen.'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of The Secret History by Donna Tartt is: 'The first time I saw her, she was standing in the doorway of the house, the sun behind her, and I thought she was the most beautiful thing I had ever seen.'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "The Secret History by Donna Tartt",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of Beloved by Toni Morrison?": {
        prompt: "What is the opening sentence of Beloved by Toni Morrison?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of Beloved by Toni Morrison is: 'Beloved, I am writing to tell you I am thinking of you.'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of Beloved by Toni Morrison is: 'Beloved, I am writing to tell you I am thinking of you.'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Beloved by Toni Morrison",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of Mistborn by Brandon Sanderson?": {
        prompt:
          "What is the opening sentence of Mistborn by Brandon Sanderson?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The opening sentence of Mistborn by Brandon Sanderson is: 'The sun was setting, painting the sky with hues of red and gold, casting long shadows across the city of Luthadel.'",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe opening sentence of Mistborn by Brandon Sanderson is: 'The sun was setting, painting the sky with hues of red and gold, casting long shadows across the city of Luthadel.'",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "Mistborn by Brandon Sanderson",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
      "What is the opening sentence of The Poppy War by R.F.Kuang?": {
        prompt: "What is the opening sentence of The Poppy War by R.F.Kuang?",
        query: {
          temperature: 1,
          return_full_text: false,
          max_new_tokens: 250,
        },
        responses: [
          "The world of the Poppy War is one of magic and war, where the fate of nations rests on the shoulders of a single girl.",
        ],
        raw_response: [
          {
            generated_text:
              "\nThe world of the Poppy War is one of magic and war, where the fate of nations rests on the shoulders of a single girl.",
          },
        ],
        llm: "Falcon.7b",
        info: {
          book: "The Poppy War by R.F.Kuang",
        },
        metavars: {
          LLM_0: "Falcon.7b",
        },
      },
    },
    "prompt-1687991312103_2.json": {
      "What is the opening sentence of Beloved by Toni Morrison?": {
        prompt: "What is the opening sentence of Beloved by Toni Morrison?",
        query: {
          model: "gpt-3.5-turbo",
          n: 1,
          temperature: 1,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content:
                "What is the opening sentence of Beloved by Toni Morrison?",
            },
          ],
        },
        responses: ['"124 was spiteful."'],
        raw_response: {
          id: "chatcmpl-7XrfW9dyolVbol1CcegRyjPTvf0gF",
          object: "chat.completion",
          created: 1688305482,
          model: "gpt-3.5-turbo-0613",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: '"124 was spiteful."',
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 29,
            completion_tokens: 6,
            total_tokens: 35,
          },
        },
        llm: "ChatGPT",
        info: {
          book: "Beloved by Toni Morrison",
        },
        metavars: {
          LLM_0: "ChatGPT",
        },
      },
      "What is the opening sentence of Mistborn by Brandon Sanderson?": {
        prompt:
          "What is the opening sentence of Mistborn by Brandon Sanderson?",
        query: {
          model: "gpt-3.5-turbo",
          n: 1,
          temperature: 1,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content:
                "What is the opening sentence of Mistborn by Brandon Sanderson?",
            },
          ],
        },
        responses: ['"The mists come at night."'],
        raw_response: {
          id: "chatcmpl-7XrfWMImafidgqDxLAX5GcRAwSsTC",
          object: "chat.completion",
          created: 1688305482,
          model: "gpt-3.5-turbo-0613",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: '"The mists come at night."',
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 30,
            completion_tokens: 7,
            total_tokens: 37,
          },
        },
        llm: "ChatGPT",
        info: {
          book: "Mistborn by Brandon Sanderson",
        },
        metavars: {
          LLM_0: "ChatGPT",
        },
      },
      "What is the opening sentence of Pride and Prejudice by Jane Austen?": {
        prompt:
          "What is the opening sentence of Pride and Prejudice by Jane Austen?",
        query: {
          model: "gpt-3.5-turbo",
          n: 1,
          temperature: 1,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content:
                "What is the opening sentence of Pride and Prejudice by Jane Austen?",
            },
          ],
        },
        responses: [
          '"It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."',
        ],
        raw_response: {
          id: "chatcmpl-7XrfWae55kYw1y1jS2Gj0MN846RJq",
          object: "chat.completion",
          created: 1688305482,
          model: "gpt-3.5-turbo-0613",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content:
                  '"It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."',
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 33,
            completion_tokens: 26,
            total_tokens: 59,
          },
        },
        llm: "ChatGPT",
        info: {
          book: "Pride and Prejudice by Jane Austen",
        },
        metavars: {
          LLM_0: "ChatGPT",
        },
      },
      "What is the opening sentence of The Secret History by Donna Tartt?": {
        prompt:
          "What is the opening sentence of The Secret History by Donna Tartt?",
        query: {
          model: "gpt-3.5-turbo",
          n: 1,
          temperature: 1,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content:
                "What is the opening sentence of The Secret History by Donna Tartt?",
            },
          ],
        },
        responses: ['"The'],
        raw_response: {
          id: "chatcmpl-7XrfWFcNzp3CsiRzvm2nqfWKsgJMd",
          object: "chat.completion",
          created: 1688305482,
          model: "gpt-3.5-turbo-0613",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: '"The',
              },
              finish_reason: "content_filter",
            },
          ],
          usage: {
            prompt_tokens: 31,
            completion_tokens: 1,
            total_tokens: 32,
          },
        },
        llm: "ChatGPT",
        info: {
          book: "The Secret History by Donna Tartt",
        },
        metavars: {
          LLM_0: "ChatGPT",
        },
      },
      "What is the opening sentence of Crime and Punishment by Dostoevsky?": {
        prompt:
          "What is the opening sentence of Crime and Punishment by Dostoevsky?",
        query: {
          model: "gpt-3.5-turbo",
          n: 1,
          temperature: 1,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content:
                "What is the opening sentence of Crime and Punishment by Dostoevsky?",
            },
          ],
        },
        responses: [
          'The opening sentence of "Crime and Punishment" by Fyodor Dostoevsky is: "On an exceptionally hot evening early in July, a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge."',
        ],
        raw_response: {
          id: "chatcmpl-7XrfWQjVJ8GqPtkRkXTN7F1RdbLfK",
          object: "chat.completion",
          created: 1688305482,
          model: "gpt-3.5-turbo-0613",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content:
                  'The opening sentence of "Crime and Punishment" by Fyodor Dostoevsky is: "On an exceptionally hot evening early in July, a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge."',
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 34,
            completion_tokens: 62,
            total_tokens: 96,
          },
        },
        llm: "ChatGPT",
        info: {
          book: "Crime and Punishment by Dostoevsky",
        },
        metavars: {
          LLM_0: "ChatGPT",
        },
      },
      "What is the opening sentence of The Poppy War by R.F.Kuang?": {
        prompt: "What is the opening sentence of The Poppy War by R.F.Kuang?",
        query: {
          model: "gpt-3.5-turbo",
          n: 1,
          temperature: 1,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content:
                "What is the opening sentence of The Poppy War by R.F.Kuang?",
            },
          ],
        },
        responses: [
          '"The fishing village of Tikany was made of white stone, its streets narrow and ascending, paved with flat stones that clicked beneath Rin\'s sandals as she followed Altan up the path toward the burning pyres."',
        ],
        raw_response: {
          id: "chatcmpl-7XrhHkye6bZftKm88SIh1qzbTpY7x",
          object: "chat.completion",
          created: 1688305591,
          model: "gpt-3.5-turbo-0613",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content:
                  '"The fishing village of Tikany was made of white stone, its streets narrow and ascending, paved with flat stones that clicked beneath Rin\'s sandals as she followed Altan up the path toward the burning pyres."',
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 33,
            completion_tokens: 42,
            total_tokens: 75,
          },
        },
        llm: "ChatGPT",
        info: {
          book: "The Poppy War by R.F.Kuang",
        },
        metavars: {
          LLM_0: "ChatGPT",
        },
      },
    },
    "prompt-1687991312103.json": {
      cache_files: {
        "prompt-1687991312103_1.json": {
          key: "06fd174b-ae9a-45bd-a474-55ad36d9a7b3",
          name: "Falcon.7b",
          emoji: "🤗",
          model: "tiiuae/falcon-7b-instruct",
          base_model: "hf",
          temp: 1,
          settings: {
            custom_model: "",
            temperature: 1,
            num_continuations: 0,
            top_k: -1,
            top_p: -1,
            repetition_penalty: -1,
            max_new_tokens: 250,
            do_sample: true,
            use_cache: false,
          },
          formData: {
            shortname: "Falcon.7b",
            model: "tiiuae/falcon-7b-instruct",
            custom_model: "",
            temperature: 1,
            num_continuations: 0,
            top_k: -1,
            top_p: -1,
            repetition_penalty: -1,
            max_new_tokens: 250,
            do_sample: true,
            use_cache: false,
          },
          progress: {
            success: 0,
            error: 0,
          },
        },
        "prompt-1687991312103_2.json": {
          key: "12ec9c5d-f430-4af2-a631-94c86fd4a748",
          name: "ChatGPT",
          emoji: "🤖",
          model: "gpt-3.5-turbo",
          base_model: "gpt-3.5-turbo",
          temp: 1,
          settings: {
            system_msg: "You are a helpful assistant.",
            temperature: 1,
            functions: [],
            function_call: "",
            top_p: 1,
            stop: [],
            presence_penalty: 0,
            frequency_penalty: 0,
          },
          formData: {
            shortname: "ChatGPT",
            model: "gpt-3.5-turbo",
            system_msg: "You are a helpful assistant.",
            temperature: 1,
            functions: "",
            function_call: "",
            top_p: 1,
            stop: "",
            presence_penalty: 0,
            frequency_penalty: 0,
          },
          progress: {
            success: 0,
            error: 0,
          },
        },
      },
      responses_last_run: [
        {
          vars: {
            book: "Pride and Prejudice by Jane Austen",
          },
          metavars: {
            LLM_0: "Falcon.7b",
          },
          llm: "Falcon.7b",
          prompt:
            "What is the opening sentence of Pride and Prejudice by Jane Austen?",
          responses: [
            "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
          ],
          tokens: {},
        },
        {
          vars: {
            book: "Crime and Punishment by Dostoevsky",
          },
          metavars: {
            LLM_0: "Falcon.7b",
          },
          llm: "Falcon.7b",
          prompt:
            "What is the opening sentence of Crime and Punishment by Dostoevsky?",
          responses: [
            "The opening sentence of Crime and Punishment by Dostoevsky is: 'It was a bright, sunny day in the middle of the summer, and the sun was shining through the window of the little room where Raskolnikov was sitting.'",
          ],
          tokens: {},
        },
        {
          vars: {
            book: "The Secret History by Donna Tartt",
          },
          metavars: {
            LLM_0: "Falcon.7b",
          },
          llm: "Falcon.7b",
          prompt:
            "What is the opening sentence of The Secret History by Donna Tartt?",
          responses: [
            "The opening sentence of The Secret History by Donna Tartt is: 'The first time I saw her, she was standing in the doorway of the house, the sun behind her, and I thought she was the most beautiful thing I had ever seen.'",
          ],
          tokens: {},
        },
        {
          vars: {
            book: "Beloved by Toni Morrison",
          },
          metavars: {
            LLM_0: "Falcon.7b",
          },
          llm: "Falcon.7b",
          prompt: "What is the opening sentence of Beloved by Toni Morrison?",
          responses: [
            "The opening sentence of Beloved by Toni Morrison is: 'Beloved, I am writing to tell you I am thinking of you.'",
          ],
          tokens: {},
        },
        {
          vars: {
            book: "Mistborn by Brandon Sanderson",
          },
          metavars: {
            LLM_0: "Falcon.7b",
          },
          llm: "Falcon.7b",
          prompt:
            "What is the opening sentence of Mistborn by Brandon Sanderson?",
          responses: [
            "The opening sentence of Mistborn by Brandon Sanderson is: 'The sun was setting, painting the sky with hues of red and gold, casting long shadows across the city of Luthadel.'",
          ],
          tokens: {},
        },
        {
          vars: {
            book: "The Poppy War by R.F.Kuang",
          },
          metavars: {
            LLM_0: "Falcon.7b",
          },
          llm: "Falcon.7b",
          prompt: "What is the opening sentence of The Poppy War by R.F.Kuang?",
          responses: [
            "The world of the Poppy War is one of magic and war, where the fate of nations rests on the shoulders of a single girl.",
          ],
          tokens: {},
        },
        {
          vars: {
            book: "Pride and Prejudice by Jane Austen",
          },
          metavars: {
            LLM_0: "ChatGPT",
          },
          llm: "ChatGPT",
          prompt:
            "What is the opening sentence of Pride and Prejudice by Jane Austen?",
          responses: [
            '"It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife."',
          ],
          tokens: {
            prompt_tokens: 33,
            completion_tokens: 26,
            total_tokens: 59,
          },
        },
        {
          vars: {
            book: "Crime and Punishment by Dostoevsky",
          },
          metavars: {
            LLM_0: "ChatGPT",
          },
          llm: "ChatGPT",
          prompt:
            "What is the opening sentence of Crime and Punishment by Dostoevsky?",
          responses: [
            'The opening sentence of "Crime and Punishment" by Fyodor Dostoevsky is: "On an exceptionally hot evening early in July, a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge."',
          ],
          tokens: {
            prompt_tokens: 34,
            completion_tokens: 62,
            total_tokens: 96,
          },
        },
        {
          vars: {
            book: "The Secret History by Donna Tartt",
          },
          metavars: {
            LLM_0: "ChatGPT",
          },
          llm: "ChatGPT",
          prompt:
            "What is the opening sentence of The Secret History by Donna Tartt?",
          responses: ['"The'],
          tokens: {
            prompt_tokens: 31,
            completion_tokens: 1,
            total_tokens: 32,
          },
        },
        {
          vars: {
            book: "Beloved by Toni Morrison",
          },
          metavars: {
            LLM_0: "ChatGPT",
          },
          llm: "ChatGPT",
          prompt: "What is the opening sentence of Beloved by Toni Morrison?",
          responses: ['"124 was spiteful."'],
          tokens: {
            prompt_tokens: 29,
            completion_tokens: 6,
            total_tokens: 35,
          },
        },
        {
          vars: {
            book: "Mistborn by Brandon Sanderson",
          },
          metavars: {
            LLM_0: "ChatGPT",
          },
          llm: "ChatGPT",
          prompt:
            "What is the opening sentence of Mistborn by Brandon Sanderson?",
          responses: ['"The mists come at night."'],
          tokens: {
            prompt_tokens: 30,
            completion_tokens: 7,
            total_tokens: 37,
          },
        },
        {
          vars: {
            book: "The Poppy War by R.F.Kuang",
          },
          metavars: {
            LLM_0: "ChatGPT",
          },
          llm: "ChatGPT",
          prompt: "What is the opening sentence of The Poppy War by R.F.Kuang?",
          responses: [
            '"The fishing village of Tikany was made of white stone, its streets narrow and ascending, paved with flat stones that clicked beneath Rin\'s sandals as she followed Altan up the path toward the burning pyres."',
          ],
          tokens: {
            prompt_tokens: 33,
            completion_tokens: 42,
            total_tokens: 75,
          },
        },
      ],
    },
    "inspect-1687991312103.json": {},
    "textFieldsNode-1688305190489.json": {},
  },
};

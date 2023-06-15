import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { SimpleGrid, Card, Modal, Image, Group, Text, Button, Badge, Tabs, Alert, Code } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChartDots3, IconAlertCircle } from '@tabler/icons-react';
import { BASE_URL } from './store';

/** The preconverted OpenAI evals we can load from,
 * along with their descriptions, extracted from the evals registry. */
const OAIEVALS = {
  "2d_movement": "Test the model's ability to keep track of position and orientation in a 2D environment.",
  "adultery_state_laws": "This evaluation checks the model's ability to accurately answer true or false questions about adultery laws in various states.",
  "afrikaans-lexicon": "Test the model's ability to distinguish between existing Afrikaans words.",
  "aime_evaluation": "Test the model's ability to solve math problems from the AIME competition.",
  "algebra-word-problems": "Test the model's ability to perform basic algebra word problems",
  "ambiguous-sentences": "test pair of sentences that differ in only one or two words and that contain an ambiguity that is resolved in opposite ways in the two sentences and requires the use of world knowledge and reasoning for its resolution.",
  "arithmetical_puzzles": "Test the model's ability to solve complex arithmetical puzzles stated in natural language.",
  "asl-classifiers": "Test the model's ability to understand the usage of ASL classifiers.",
  "atpl_exams": null,
  "balance-chemical-equation": null,
  "banking77": null,
  "beam-analysis": "Test the model's ability to solve beam analysis questions",
  "belarusian-grammar": "Test the model's ability to distinguish between grammatically well-formed and ungrammatical Belarusian sentences.",
  "belarusian-lexicon": "Test the model's ability to distinguish between existing and hallucinated Belarusian words.",
  "belarusian-proverbs": "Test the model's ability to complete proverbs in belarusian language",
  "belarusian-russian-translation": "Test the model's ability to recover Belarusian sentences by translating into Russian and back.",
  "belarusian-syllable-count": "Test the model's ability to count syllables in Belarusian words.",
  "belarusian-synonyms": "Test the model's ability to classify if the Belarusian words are synonyms or not.",
  "bitwise": "Test the model's ability to simulate a simple bitwise operating machine",
  "body-movement": "Test the model's ability to understand human body movement",
  "born-first": "Test the model's ability to determine who was born first.",
  "brazilian_laws": null,
  "building_floorplan": null,
  "bulgarian-lexicon": "Test the model's ability to distinguish between existing and hallucinated Bulgarian words.",
  "canto_wu_pronunciation": "Test the model's knowledge of Cantonenese and Wu Chinese pronounciation in a zero-shot setting",
  "chess": "Test the model's ability to play chess",
  "chess-piece-count": "Test the model's ability to understand chess moves, rules and theory",
  "chinese_tang_poetries": "Evaluate the mobel's ability of identifying the accurate author of Chinese Tang Poetries.",
  "chinese_zodiac": null,
  "color_theory_complementary": "Test the model's ability to accurately recognize complementary colors in the color theory.",
  "compare-countries-area": "Test the model's ability to determine which country has the largest area.",
  "comprehensive-graph-reasoning": "Test the model's ability to identify the number of rings and clusters, and the shortest path between two random nodes in undirected, weighted graphs.",
  "count_intersections_polynomial": "Test the models ability to count the intersections between the x-axis and a polynomial of third degree, with simple inputs that humans would be able to do in their head.",
  "count_token_freq_dna": "Test the model's ability to count the occurrence of a specific nucleotide (A, T, G, or C) within provided DNA sequences.",
  "counterfactual-reasoning": "Example eval that uses fuzzy matching to score completions.",
  "countries": null,
  "crepe": null,
  "cricket_situations": "Tests the models ability to apply rules of the sport cricket to different situations",
  "crontab": null,
  "cube-pack": null,
  "date-booking": null,
  "date-calculator": null,
  "day-of-week-from-date": null,
  "determinant": null,
  "diagrammatic_logic": null,
  "directions": "Eval that tests the models ability to keep state of direction after a series of turns",
  "dna-melting-calculation": "Test the model's ability to solve DNA melting temperature problems.",
  "dutch-lexicon": "Test the model's ability to distinguish between existing and often misspelled and hallucinated Dutch words.",
  "emoji-riddle": "Test the model's ability to solve emoji riddles.",
  "escher-sentences": null,
  "european-date-format-challenge": "This performance evaluation examines the model's ability to reasonably assume that a date in a text follows the DD/MM/YYYY format when a subsequent date in the text is invalid for the MM/DD/YYYY format (e.g., 27/2/2024).",
  "fcc_amateur_extra": "Multiple choice questions (with answers) about from the US FCC Amateur Radio License question pool.",
  "finance": "Test the model's ability to understand financial concepts and do math.",
  "financial-derivatives": "Testing the models ability to answer derivative questions correctly.",
  "find-letter": null,
  "find-thirukkural": "Accurately finds the correct Thirukkural in Tamil which the user asks for in English.",
  "find_country_from_svg": "Test the model's ability to distinguish a country based on its svg shape (from wikimedia svg file).",
  "finnish-rhyme": "Composite task that involves translation and rhyming.",
  "first-letters": null,
  "food": null,
  "formal-grammar-to-regex": null,
  "french-lexicon": "Test the model's ability to distinguish between existing French words.",
  "french-part-of-speech": "Test the model's knowledge what part of speech a given word can have in French, using data from fr.wiktionary.org (as of 2023-05-20)",
  "geometry_puzzle": "Assesses the model's performance in solving spatial and geometrical puzzles that require imagination, logic, and pattern recognition.",
  "german-part-of-speech": "Test the model's knowledge what part of speech a given word can have in German, using data from de.wiktionary.org (as of 2023-05-20)",
  "gol": "Robust test. Evaluate model's ability to determine the next state in a simple game of life board",
  "greek-vocabulary": null,
  "guess-the-singer": "Test the model's ability to predict singer by the first 10 words of the song",
  "heart-disease": "Test model's capability of predicting the presence of heart disease.",
  "hebrew-bible": "Simple questions on the bible, similar to preliminary questions in the international yearly bible contest in Israel.",
  "hebrew-rhyme": "Composite task that involves translation and rhyming.",
  "hebrew-same-noun-gender": "Do these hebrew nouns have the same grammatical gender?",
  "hindi_shuddha": null,
  "hindi_words": null,
  "historical-kana-orthography-reading": "Test the model's ability to reading historical kana orthography.",
  "imperial_date_to_string": null,
  "indonesian_numbers": null,
  "infiniteloop-match": "Test the model's ability to recognized if a piece of code can get into a state where it would run forever.",
  "internal_representations": null,
  "invert_word_wise": "Logically, inverting strings twice just results in the original string again. The LLMs find it very difficult to deduce it, and somehow (at least up to GPT-3.5) mix things up.",
  "invoice_due_date_leap_day_adjustment": null,
  "irony": "Tests the ability to identify one of three types of irony, situational, verbal, or dramatic.",
  "islands": "Testing the models ability to answer prefecture of given Japanese remote island.",
  "isosceles-right-triangle": null,
  "italian-new-words": "Test the model's ability to distinguish Italian words that have recently entered the language.",
  "italian-rhyme": "Composite task that involves translation and rhyming.",
  "japanese-itpassport-exam01": "source from IT\u30d1\u30b9\u30dd\u30fc\u30c8\u8a66\u9a13 \u4ee4\u548c5\u5e74\u5ea6\u5206(IT Passport Examination for FY2023) in https://www3.jitec.ipa.go.jp/JitesCbt/html/openinfo/questions.html",
  "japanese-national-medical-exam01": null,
  "japanese-national-medical-exam02": null,
  "japanese_driving_license": "Test the model's ability to correctly answer Japanese Driving licence exam.",
  "japanese_number_reading": "Test the model's ability to translate japanese written number into arabic numerals.",
  "japanese_populer_video_game_title_and_the_publisher": "Test the model's ability to identify game publisher published popular japanese video games.",
  "jee-math": null,
  "job_listing_title_for_a_caregiver_in_japan": "Test to identify the job listing title for a caregiver in Japan.",
  "json_patch_object": "Test the model's ability to create minimal, correct JSON Patches for nested objects.",
  "kanji-idioms": "Test the model's ability to recognize kanji idioms.",
  "korean-consonant-vowel-combination": "Evaluating the model's ability to accurately combine Korean consonants and vowels to form Hangul character.",
  "korean_spelling": null,
  "korean_yaminjeongeum": "Yamin-Jeongeum is a leetspeak for Korean. Test your ability to translate it to proper Korean.",
  "largest_country": "Determining the largest country by the area from the list",
  "last-word-nth": "Test the model's ability to tell what the last word of a sentence is, but by asking it indirectly based on its index.",
  "lat_long_identify": null,
  "linear-equations": null,
  "list_comparison_missing_name": "Test the model's ability to determine which name is present in list 1 but not in list 2. List 1 is formatted 'First Last' while list two is formatted 'Last First'. Lists are between 20-35 names long.",
  "logic-statements": null,
  "logiqa": null,
  "mandaliof-table": "Test the model's ability to determine which atom has the largest atomic number.",
  "map-electronic-component-part-to-fact": null,
  "mate-in-one": "Find the checkmating move for various board positions",
  "matrix-mult-rows": "Test the model's mathematical ability to infer what is needed to multiply two matrices.",
  "medmcqa": null,
  "missing-operators": "Example eval that checks sampled text matches the expected output.",
  "moral_exceptQA": "This eval tests the models ability to align with human intuition on when is it acceptable to break an established moral norm.",
  "multi-step-equations": null,
  "multistep-word-problems": "Test the model's ability to solve complex, multistep math word problems",
  "music-theory-chord-notes": "Test the model's ability to spell out the notes in a given chord name",
  "music_theory_scale_modes": "Test the model's ability to identify which western music scale a series of 8 notes belongs to",
  "nepali-song-singer": "Test the model's ability to understand English transliteration of Nepali phrase and provide us the singer of that particular title.",
  "newsology": "Ask the model to pick a fruit, when telling the model that we have provided a list of vegetables. And then vice versa (pick vegetable, from basket of fruit).",
  "next-val-series": "Test the model's ability to predict the next value in a series.",
  "norwegian-lexicon": "Test the model's ability to distinguish old Norwegian words.",
  "number-pattern": null,
  "number-reading": "Test the model's ability to translate chinese written number into arabic numerals.",
  "numbers_game": "Test the model's ability to solve permutation questions",
  "numeral-type-comparisons": "Evaluate the LLM's ability to compare similar or identical numerals across formats in arithmetic and linguistic contexts",
  "ordered-history-events": null,
  "partially_solved_crossword_clues": null,
  "passing-balls": "Tests the model's ability to correctly determine the last player holding a ball after a sequence of passes.",
  "pattern_identification": null,
  "ph_calculation": "Test the model's ability to apply basic mathematics to chemistry problems.",
  "physics-interaction": "Test the model's ability to predict the direction in which an object is likely to fall towards.",
  "points-on-line": "Tests the model's ability to calculate three points (start, center, end) on a line.",
  "poker_analysis": "Examine the model's capacity to strategize & make probabilistic reasoning within the framework of poker.",
  "polish-lexicon": "Test the model's ability to distinguish between existing and hallucinated Polish words.",
  "polish-syllable-count": null,
  "portuguese-sarcasm": "An evaluation on sarcasm detection in Portuguese sentences",
  "portuguese-syllable-count": "Evaluates how many syllabels a given word has.",
  "probability_questions": "A collection of probability questions that ChatGPT fails.  Let's see if GPT-4 can do better.",
  "pure_korean": "Evaluates GPT can identify pure Korean words.",
  "python_list_comprehension": "Test model's ability to understand a basic usage of python's list comprehension syntax.",
  "rare-and-loanwords-dutch-lexicon": "Test the model's ability to distinguish between existing Dutch words, including rare words and loanwords.",
  "regex-match": null,
  "resistor-ohm-calculator": "Test the model's ability to calculate resistance (in ohms) of a resistor, given color of each band",
  "reverse-polish-notation": "Test the model's ability to parse expression and create reverse polish notation.",
  "reverse-string": "Test the model's ability to reverse complex and simple strings.",
  "rhetorical-devices": "Evaluate model's understanding of rhetorical device usage in sentences",
  "rock-climbing": null,
  "rot13": "Test the model's ability to perform the simple ROT13 character level operation.",
  "russian-english-homonym-context-resolution": null,
  "russian-lexicon": "Test the model's ability to distinguish between existing Russian words.",
  "russian-rhyme": "Composite task that involves translation and rhyming.",
  "russian_medical": null,
  "seating_arrangements": "Test the model's spatial reasoning ability using seating arrangement questions with limited solution sets.",
  "shape-in-shape": "Test the model's ability to check whether a given shape will fit within another shape.",
  "shared-borders": "Test the model's ability to list the countries that share a land border with a given pair of countries. This tests the model's ability to intersect sets known within its weights.",
  "shopping_discount_comparison": "Test the model's ability to compare discounts and select the best one",
  "simple-knowledge-mongolian": "Test the model's ability to understand simple world knowledge in mongolian language cyrillic and latin variants",
  "simple_physics_engine": "Test the model's ability to reason about and simulate a simplified physics model in a 2d environment.",
  "solve-for-variable": "Multiple-choice questions about solving a mathematical equation for a variable.",
  "sort-numeric": "Tests performance sorting different comma-separated values under different circumstances (integers/decimals, positives/negatives, as well as currency-formatted values).",
  "south-african-bands": "Test the model's ability to understand that we are providing the name of a South African band, find the supplied band, and if the band has a lead vocalist provide the stage name or real name of the vocalist.",
  "spanish_feminine_noun_masculine_article": "In Spanish there are are a number of nouns like \"agua\" which are feminine but use the masculine article, \"El agua\" is correct and \"La agua\" is incorrect",
  "split_chinese_characters": null,
  "squares-gpt": "Test the model's ability to solve basic geometric reasoning questions.",
  "stats-tests": null,
  "svg_understanding": "Test visual understanding of SVG files.",
  "swap-words": null,
  "swedish-spelling": "Test the model's ability to identify misspelled Swedish words.",
  "swedish_sat": "Test the model's ability to answer questions from the Swedish h\u00f6gskoleprovet, kind of like the SATs in the US. The 30 questions are from the spring test 2023 verbal part, test number 3.",
  "syllables_long_words": null,
  "syntax-check": "Test the model's ability to determine programming language from a snippet.",
  "taxes": null,
  "tempo_to_measure_count": "Test the model's ability to calculate the number of measures in a song, based on the tempo of each note and the corresponding time signature of the piece.",
  "test-comp-sci": "Testing the models ability to answer multiple choice computer science questions correctly.",
  "test_japanese_radical": "In Japan, the radical changes depending on the type of kanji. Test your reading of various radicals.",
  "test_japanese_units": "In Japan, when counting things, the unit changes depending on the type. Test your use of complex units.",
  "tetris": "Tests the models ability of spacial awareness by rotating tetris cubes. Tests all 7 classic tetris blocks and performs clockwise and counterclockwise rotations from different starting points.",
  "three-pt-mapping": "Test the model's ability to calculate gene positions given a three-point cross using the laws of genetics",
  "track_objects": "Test the model's ability to track objects after being moved around",
  "tracking-shuffled-objects": null,
  "turkish_characters": "Eval that checks ability to identify non-english characters in a Turkish text.",
  "unified-patch": null,
  "unsolvable_questions": null,
  "utility_price_parsing": null,
  "vigenere": "Test the model's ability to perform the simple Vigenere character operation.",
  "vintage_phone_keyboard_decode": "An array of correspondence between letters and numbers on the mobile phone keyboard evals, examining the model the ability to distinguish and analyze the relationship within groups in multiple groups composed of English letters and numbers.",
  "which-is-heavier": "Test the model's ability to determine which of two quantities is heavier when the heavier quantity is made up of lighter objects (and vice versa).",
  "wkt_understanding": "Test understanding of Multipolygon WKT (Well-Known Text) representation of vector geometry objects (https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry).",
  "word_vector_over_reliance": "Example eval that checks sampled text matches the expected output."
}

/** Example flows to help users get started and see what CF can do */
const ExampleFlowCard = ({ title, description, buttonText, filename, onSelect }) => {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder >
      {/* <Card.Section>
        <Image
          src="..."
          height={160}
          alt="Alt text"
        />
      </Card.Section> */}

      <Text mb="xs" weight={500}>{title}</Text>

      <Text size="sm" color="dimmed" lh={1.3}>
        {description}
      </Text>

      <Button onClick={() => onSelect(filename)} variant="light" color="blue" fullWidth size='sm' mt="md" radius="md">
        {buttonText ? buttonText : 'Try me'}
      </Button>
      
    </Card>
  );
};

const ExampleFlowsModal = forwardRef((props, ref) => {
  // Mantine modal popover for alerts
  const [opened, { open, close }] = useDisclosure(false);

  // Callback for when an example flow is selected. Passed the name of the selected flow.
  const onSelect = props.onSelect ? (
    (filename, category) => {close(); props.onSelect(filename, category);}
  ) : undefined;

  // This gives the parent access to triggering the modal alert
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal size='xl' opened={opened} onClose={close} title={<div><IconChartDots3 size={24} style={{position:'relative', marginRight: '8px', top: '4px'}} /><span style={{fontSize: '14pt'}}>Example Flows</span></div>} closeOnClickOutside={true} style={{position: 'relative', 'left': '-100px'}}>      
      <Tabs defaultValue="examples">
        <Tabs.List>
          <Tabs.Tab value="examples" >Basic Examples</Tabs.Tab>
          <Tabs.Tab value="openai-evals" >OpenAI Evals</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="examples" pt="xs">
          <SimpleGrid cols={3} spacing='sm' verticalSpacing='sm'>
            <ExampleFlowCard title="Compare length of responses across LLMs"
                            description="A simple evaluation with a prompt template, some inputs, and three models to prompt. Visualizes variability in response length." 
                            filename="basic-comparison"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Robustness to prompt injection attacks"
                            description="Get a sense of different model's robustness against prompt injection attacks." 
                            filename="prompt-injection-test"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Use an LLM as an evaluator"
                            description="Chain one prompt into another to extract entities from a text response. Plots number of entities." 
                            filename="chaining-prompts"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Measure impact of system message on response"
                            description="Compares response quality across different ChatGPT system prompts. Visualizes how well it sticks to the instructions to only print Racket code."
                            filename="comparing-system-msg"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Ground truth evaluation for math problems"
                            description="Uses a tabular data node to evaluate LLM performance on basic math problems. Compares responses to expected answer and plots performance across LLMs."
                            filename="basic-math"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Detect whether OpenAI function call was triggered"
                            description="Basic example showing whether a given prompt triggered an OpenAI function call. Also shows difference between ChatGPT prior to function calls, and function call version."
                            filename="basic-function-calls"
                            onSelect={onSelect}
            />
            {/* <ExampleFlowCard title="Test mathematical ability"
                            description="Evaluate the ability of different LLMs to perform basic math and get the correct answer. Showcases chaining prompt templates and using prompt variables in Evaluate nodes."
            />
            <ExampleFlowCard title="Does it conform to spec?"
                            description="Test how well a prompt and model conforms to a specification (instructed to format its output a certain way). Extracts and parses JSON outputs."
            /> */}
          </SimpleGrid> 
        </Tabs.Panel>

        <Tabs.Panel value="openai-evals" pt="xs">
          <Text size='sm' pl='sm'>
            These flows are generated from the <a href='https://github.com/openai/evals' target='_blank'>OpenAI evals</a> benchmarking package. 
            We currently load evals with a common system message, a single 'turn' (prompt), and evaluation types of 'includes', 'match', and 'fuzzy match',
            and a reasonable number of prompts. &nbsp;<i>Warning: some evals include tables with 1000 prompts or more. </i>
          </Text>
          <SimpleGrid cols={3} spacing='sm' verticalSpacing='sm' mt="md">
          {
            Object.keys(OAIEVALS).map(evalname => (
              <ExampleFlowCard title={evalname}
                            description={OAIEVALS[evalname] || 'No description was provided.'}
                            filename={evalname}
                            onSelect={(name) => onSelect(name, 'openai-eval')}
              /> 
            ))
          }
          </SimpleGrid>
          {/* <Alert icon={<IconAlertCircle size="2rem" />} title="Bummer!" color="orange" mt="md" pl="sm" styles={{message: {fontSize: '12pt'}, title: {fontSize: '12pt'}}}>
            We detected that you do not have the <Code>evals</Code> package installed. To load ChainForge flows from OpenAI evals, install <Code>evals</Code> in the Python environment where you are running ChainForge:
            <Code style={{fontSize: '12pt'}} block mt="sm">pip install evals</Code>
          </Alert> */}
        </Tabs.Panel>
      </Tabs>
      
    </Modal>
  );
});

export default ExampleFlowsModal;
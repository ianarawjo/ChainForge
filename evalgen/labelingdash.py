import copy
from datetime import datetime
import json
import streamlit as st
import pandas as pd
import os

from openai import AzureOpenAI


# Load data
@st.cache_data
def load_data(dataset_name):
    curr_dir = os.path.dirname(__file__)
    data_folder = os.path.join(curr_dir, "flows/outputs")
    if dataset_name not in ["medical", "product"]:
        raise ValueError("Invalid dataset name")
    data_path = os.path.join(data_folder, f"{dataset_name}.csv")
    df = pd.read_csv(data_path)
    if "grade" not in df.columns:
        df["grade"] = None  # Initialize the grade column if it doesn't exist
    if "grading_feedback" not in df.columns:  # Ensure there is a column for feedback
        df["grading_feedback"] = None
    return {"data": df, "index_to_show": 0}


def set_grade(val: bool, feedback=None):
    data.at[index, "grade"] = val
    if feedback is not None:  # If there is feedback, save it
        data.at[index, "grading_feedback"] = feedback
        st.session_state.show_feedback_input = False  # Reset the feedback input display
    st.session_state.data_and_index = {"data": data, "index_to_show": index + 1}
    st.rerun()


# Function to save the updated DataFrame to CSV
def save_grades(df, dataset_name):
    curr_dir = os.path.dirname(__file__)
    data_folder = os.path.join(curr_dir, "graded_data/.cache")

    # Make the folder if it doesn't exist
    if not os.path.exists(data_folder):
        os.makedirs(data_folder)

    # Get curr timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    data_path = os.path.join(data_folder, f"{dataset_name}_graded_{timestamp}.csv")
    # Drop null grades
    df = df.dropna(subset=["grade"])

    df.to_csv(data_path, index=False)

    return df


# Streamlit App Layout
st.title("Labeling Dashboard")
st.write("This app is used to label data for the evaluation generator.")

dataset_name = st.selectbox("Select dataset", ["medical", "product"], index=None)

if dataset_name:
    if "data_and_index" not in st.session_state:
        st.session_state.data_and_index = load_data(dataset_name)

    data = st.session_state.data_and_index["data"]
    index = st.session_state.data_and_index["index_to_show"]

    if index < len(data):
        row = data.iloc[index]
        st.markdown(f"## Row {index + 1} of {len(data)}")
        st.write(f"ID: {row['Metavar: id']}")

        with st.expander("See InputDocument"):
            st.markdown(row["Var: document"])
        # Prompt using an expander with pretty-printed JSON
        with st.expander("See Prompt"):
            st.write(row["Prompt"])

        # Response
        st.markdown("### LLM Response")
        st.write(row["Response"])
        num_words = len(row["Response"].split())
        st.markdown(
            f"_(Note: The response above contains {num_words} words.)_"
        )  # Clarification for word count

        if st.button("Ask Grading Assistant"):
            with st.chat_message("assistant"):
                client = AzureOpenAI(
                    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
                    api_key=os.getenv("AZURE_OPENAI_KEY"),
                    api_version="2024-02-15-preview",
                )

                if dataset_name == "medical":
                    evaluator_system_prompt = f"You are an expert evaluator, deciding whether an LLM response appropriately answers an LLM  prompt:\n\n{row['Prompt']}\n\nCriteria for a good response includes: No PII present in the output (e.g., names, addresses, phone numbers, emails). Each bullet has some information associated with it (or N/A). Dosage included with medicines listed. Response under 200 words"

                elif dataset_name == "product":
                    evaluator_system_prompt = f"You are an expert evaluator, deciding whether an LLM response appropriately answers an LLM  prompt:\n\n{row['Prompt']}\n\nCriteria for a good response includes: Incorporates SEO keywords naturally. Differentiates between product features (lightweight, USB-chargeable) and benefits (convenience, nutritious drinks on-the-go). No exaggeration or overpromising. Don't say bad things about the product. ~200 word response. Active voice usage. Appropriate subheadings. Includes a call to action. No links. Markdown formatting."

                stream = client.chat.completions.create(
                    model="gpt-4-2",
                    messages=[
                        {
                            "role": "system",
                            "content": evaluator_system_prompt,
                        },
                        {
                            "role": "user",
                            "content": f"The LLM responded with:\n\n{row['Response']}\n\nDid it follow all instructions in the prompt? Explain succinctly. Don't correct the response.",
                        },
                    ],
                    stream=True,
                )
                response = st.write_stream(stream)

        # Grading buttons with emojis and next to each other
        col1, col2 = st.columns(2)
        with col1:
            if st.button("👍 Good response", key="thumbs_up"):
                set_grade(True)

        with col2:
            if st.button("👎 Bad response", key="thumbs_down"):
                st.session_state.show_feedback_input = True

        # Conditional feedback input
        if st.session_state.get("show_feedback_input", False):
            feedback = st.text_area(
                "Please provide feedback for the bad response:", key="feedback_input"
            )
            if st.button("Submit Feedback"):
                set_grade(False, feedback)

        # Save button
        graded_df = save_grades(data, dataset_name)
        st.download_button(
            "💾 Save Grades",
            type="primary",
            data=graded_df.to_csv(index=False).encode("utf-8"),
            file_name=f"grades_{dataset_name}.csv",
            mime="text/csv",
        )
    else:
        st.write("No more data to label, or data is fully labeled!")
        graded_df = save_grades(data, dataset_name)
        st.download_button(
            "💾 Save Grades",
            type="primary",
            data=graded_df.to_csv(index=False).encode("utf-8"),
            file_name=f"grades_{dataset_name}.csv",
            mime="text/csv",
        )

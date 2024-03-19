import pandas as pd
import os
import json

DATASET_NAME = "medical"


def print_json_keys(obj, indent=0):
    """
    Recursively prints all keys in a JSON-like dictionary object.

    Parameters:
    - obj: The JSON object (dictionary in Python)
    - indent: The current indentation level (used for pretty-printing)
    """
    if isinstance(obj, dict):  # If the current object is a dictionary
        for key in obj:
            print(" " * indent + str(key))  # Print the key with indentation
            print_json_keys(
                obj[key], indent + 2
            )  # Recursively print keys of the nested object

    elif isinstance(obj, list):  # If the current object is a list
        for item in obj:
            print_json_keys(
                item, indent
            )  # Recursively print keys of each item in the list


def enrich_json_with_grades(obj, graded_data, parent_key=None):
    """
    Recursively processes a JSON object to add grade and grading feedback
    where the keys 'id' and 'split' are present, and the parent key is 'metavars'.

    Parameters:
    - obj: The JSON object (dictionary in Python)
    - graded_data: Dictionary with grading information
    - parent_key: The key of the parent object
    """
    if isinstance(obj, dict):  # If the current object is a dictionary
        if parent_key == "metavars" and "id" in obj and "split" in obj:
            # Check if this dictionary meets the criteria for adding grading info
            id_value = obj["id"]
            if id_value in graded_data:
                # Add grading information from the graded_data dictionary
                obj["grade"] = graded_data[id_value]["grade"]
                obj["grading_feedback"] = graded_data[id_value]["grading_feedback"]

        for key, value in obj.items():
            # Process each item in the dictionary
            enrich_json_with_grades(value, graded_data, parent_key=key)

    elif isinstance(obj, list):  # If the current object is a list
        for item in obj:
            # Process each item in the list
            enrich_json_with_grades(item, graded_data, parent_key=parent_key)


if __name__ == "__main__":
    # Get curr dir
    curr_dir = os.path.dirname(os.path.realpath(__file__))
    graded_data = os.path.join(curr_dir, f"graded_data/{DATASET_NAME}.csv")

    # Load data
    graded_data = pd.read_csv(graded_data)

    # Turn into dict
    graded_data = graded_data[["Metavar: id", "grade", "grading_feedback"]].to_dict(
        orient="records"
    )
    graded_data = {
        item["Metavar: id"]: {
            "grade": item["grade"],
            "grading_feedback": (
                item["grading_feedback"] if pd.notna(item["grading_feedback"]) else ""
            ),
        }
        for item in graded_data
    }

    # Load flow data
    flow_path = os.path.join(curr_dir, f"flows/{DATASET_NAME}.cforge")
    flow = json.load(open(flow_path))

    enrich_json_with_grades(flow, graded_data)
    print_json_keys(flow)

    # Save enriched flow
    new_flow_path = os.path.join(curr_dir, f"flows/{DATASET_NAME}_graded.cforge")
    with open(new_flow_path, "w") as f:
        json.dump(flow, f, indent=2)

from datasets import load_dataset
from rich import print
import pandas as pd

dataset = load_dataset(
    "McAuley-Lab/Amazon-Reviews-2023",
    "raw_review_All_Beauty",
)
meta_dataset = load_dataset("McAuley-Lab/Amazon-Reviews-2023", "raw_meta_All_Beauty")

# parent_asin is the join key

# Convert dataset into a dataframe
df = pd.DataFrame(dataset["full"])
print(df.columns)


# Iterate through meta_dataset to collect 150 samples with non-empty descritions and > 10 ratings and price
sample_metadata = []
for i in range(len(meta_dataset["full"])):
    if (
        meta_dataset["full"][i]["rating_number"] > 10
        and meta_dataset["full"][i]["description"]
        and meta_dataset["full"][i]["price"]
        and meta_dataset["full"][i]["price"] != "None"
        and float(meta_dataset["full"][i]["price"]) > 0
    ):
        sample_metadata.append(meta_dataset["full"][i])

    if len(sample_metadata) == 150:
        break

print(sample_metadata[0])
avg_rating = sum([x["average_rating"] for x in sample_metadata]) / len(sample_metadata)
print(f"Average rating: {avg_rating}")

# Turn sample_metadata into a dataframe
meta_df = pd.DataFrame(sample_metadata)

# Filter df to only include rows with parent_asin in sample_metadata
df = df[df["parent_asin"].isin(meta_df["parent_asin"].values)]

# Limit 10 reviews per parent_asin
df = df.groupby("parent_asin").head(10).reset_index(drop=True)

# Groupby parent_asin and concatenate all review texts
df = df.groupby("parent_asin").agg({"text": " ".join}).reset_index()

# Merge the two dataframes
df = df.merge(meta_df, on="parent_asin")


# Save to curr_dir + raw_data/products/All_Beauty.csv
import os

curr_dir = os.path.dirname(os.path.abspath(__file__))

df.to_csv(os.path.join(curr_dir, "raw_data/products/All_Beauty.csv"), index=False)

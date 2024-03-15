# This file contains the dataset class for our evaluation experiments.

from abc import ABC, abstractmethod
import asyncio

import os
import pandas as pd
import json

from rich import print
from openai import AsyncAzureOpenAI

from uuid import uuid4


class Dataset(ABC):
    @abstractmethod
    def get_train(self):
        pass

    @abstractmethod
    def get_test(self):
        pass

    def gen_and_save_splits(self, data_dir: str):
        os.makedirs(data_dir, exist_ok=True)

        # Generate and save the train and test splits
        train_records = self.get_train()
        test_records = self.get_test()

        # Make uuids for each record
        train_records = [
            {"id": uuid4().hex, "document": record} for record in train_records[:80]
        ]
        test_records = [
            {"id": uuid4().hex, "document": record} for record in test_records[:20]
        ]

        # Create a big json file with all the records
        all_records = {"train": train_records, "test": test_records}

        # Save to data_dir
        task_name = self.__class__.__name__
        with open(os.path.join(data_dir, f"{task_name}.json"), "w") as f:
            json.dump(all_records, f)

    def iter(self, data_dir: str, split="train"):
        # Check if the data_dir exists
        if not os.path.exists(data_dir):
            raise ValueError(f"Data directory {data_dir} does not exist")

        # Load the data
        task_name = self.__class__.__name__
        with open(os.path.join(data_dir, f"{task_name}.json"), "r") as f:
            all_records = json.load(f)

        # Return an interator over the split records
        for record in all_records[split]:
            yield record


class MedicalDataset(Dataset):
    def __init__(self):
        curr_path = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(curr_path, "raw_data/medical")

    def format_medical_document(self, data):
        document = f"Patient ID: {data['id']}\n"
        document += (
            f"Patient Name: {data['patient_firstname']} {data['patient_familyname']}\n"
        )
        document += f"Age: {data['patient_age']}\n"
        document += f"Gender: {data['patient_gender']}\n"
        document += f"Chief Complaint: {data['cc']}\n"
        document += f"Secondary Complaints: {data['2nd_complaints']}\n\n"
        document += "---------------------------------------------\n"
        document += "MEDICAL NOTE:\n\n"
        document += data["note"]
        document += "\n\n---------------------------------------------\n"
        document += "DIALOGUE:\n\n"
        document += data["dialogue"]
        return document

    def get_data(self, prefix):
        train_csv = os.path.join(self.data_dir, f"{prefix}.csv")
        df = pd.read_csv(train_csv)

        # Join on the metadata
        metadata_csv = os.path.join(self.data_dir, f"{prefix}_metadata.csv")
        metadata_df = pd.read_csv(metadata_csv)
        id_cols = ["dataset", "encounter_id"]

        df = df.merge(metadata_df, on=id_cols)

        # Convert id_cols to a single column and drop the original columns
        df["id"] = df[id_cols + ["id"]].apply(lambda x: "-".join(x), axis=1)
        df = df.drop(columns=id_cols)

        # Move id to the front
        cols = list(df.columns)
        cols.remove("id")
        cols.remove("doctor_name")
        df = df[["id"] + cols]

        # Convert to list of dicts with keys "dialogue" and "note"
        records = df.to_dict(orient="records")
        return [self.format_medical_document(record) for record in records]

    def get_train(self):
        return self.get_data("train")

    def get_test(self):
        return self.get_data("valid")


class AmazonProductsDataset(Dataset):
    def __init__(self):
        curr_path = os.path.dirname(os.path.abspath(__file__))
        self.data_dir = os.path.join(curr_path, "raw_data/products")
        self.columns = [
            "parent_asin",
            "title",
            "average_rating",
            "rating_number",
            "features",
            "description",
            "price",
            "store",
            "details",
            "text",
        ]

    def format_amazon_product(self, product_data):
        formatted_string = f"""
Product ID: {product_data['id']}
Title: {product_data['title']}
Average Rating: {product_data['average_rating']}
Number of Ratings: {product_data['rating_number']}
Features: {product_data['features']}
Description: {product_data['description']}
Price: {product_data['price']}
Store: {product_data['store']}
Review Text: {product_data['text']}
"""
        return formatted_string

    def get_data(self, prefix):
        csv = os.path.join(self.data_dir, "All_Beauty.csv")
        df = pd.read_csv(csv)
        df = df[self.columns]

        # Turn parent_asin into id
        df["id"] = df["parent_asin"]
        df = df.drop(columns=["parent_asin"])

        # Reorder columns
        cols = list(df.columns)
        cols.remove("id")
        df = df[["id"] + cols]

        # If prefix is "train", return the first 80% of the dataset
        if prefix == "train":
            df = df[: int(len(df) * 0.8)]

        # If prefix is "test", return the last 20% of the dataset
        else:
            df = df[int(len(df) * 0.8) :]

        # convert to list of dicts
        records = df.to_dict(orient="records")
        return [self.format_amazon_product(record) for record in records]

    def get_train(self):
        return self.get_data("train")

    def get_test(self):
        return self.get_data("test")


def gen_splits():
    # print(f"------ Testing Medical Dataset ------")
    # dataset = MedicalDataset()
    # train_records = dataset.get_train()[:65]
    # print(f"Train records: {len(train_records)}")
    # print(train_records[0])
    # val_records = dataset.get_test()[:20]
    # print(f"Test records: {len(val_records)}")
    # print(val_records[0])

    # # Save the splits
    save_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "processed_data"
    )
    # dataset.gen_and_save_splits(save_dir)

    print(f"------ Testing Amazon Products Dataset ------")
    dataset = AmazonProductsDataset()
    train_records = dataset.get_train()[:80]
    print(f"Train records: {len(train_records)}")
    print(train_records[0])
    test_records = dataset.get_test()[:20]
    print(f"Test records: {len(test_records)}")
    print(test_records[0])

    dataset.gen_and_save_splits(save_dir)


async def query_openai_api(user_message: str):
    # This function will query the OpenAI API and return the response
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": user_message},
    ]

    client = AsyncAzureOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_key=os.getenv("AZURE_OPENAI_KEY"),
        api_version="2024-02-15-preview",
    )

    completion = await client.chat.completions.create(
        model="gpt-35-turbo",
        messages=messages,
    )

    # Parse the response
    return messages, completion.choices[0].message.content


async def run_medical_prompts():
    full_prompt_template = 'You are extracting insights from some medical records. The records contain a medical note and a dialogue between a doctor and a patient. You need to extract values for the following: Chief complaint, History of present illness, Physical examination, Symptoms experienced by the patient, New medications prescribed or changed, including dosages (N/A if not provided), and Follow-up instructions (N/A if not provided). Your answer should not include any personal identifiable information (PII) such as name, age, gender, or ID. Use "the patient" instead of their name, for example. Return your answer as a bullet list, where each bullet is formatted like `chief complaint: xx.` If there is no value for the key, the value should be `N/A`. Keep your response around 150 words (you may have to summarize some extracted values to stay within the word limit).\n\n{document}'

    dataset = MedicalDataset()
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(curr_dir, "processed_data")
    records_to_write = []

    for split in ["train", "test"]:
        openai_tasks = []
        records = []

        for record in dataset.iter(data_dir, split=split):
            records.append(record)
            openai_tasks.append(
                query_openai_api(
                    full_prompt_template.format(document=record["document"])
                )
            )

        # Wait for all the tasks to complete
        results = await asyncio.gather(*openai_tasks, return_exceptions=True)
        for record, result in zip(records, results):
            if isinstance(result, Exception):
                print(f"Error processing record")
                continue

            try:
                prompt, response = result
                records_to_write.append(
                    {
                        "id": record["id"],
                        "document": record["document"],
                        "prompt": prompt,
                        "response": response,
                        "split": split,
                    }
                )
                print("Wrote prompt and response")
            except Exception as e:
                print(f"Error processing record: {record}, error: {e}")

    # Write the results to a csv
    df = pd.DataFrame(records_to_write)
    df.to_csv(os.path.join(data_dir, "medical_prompts_responses.csv"), index=False)


async def run_product_seo():
    full_prompt_template = "You are an expert copywriter. You need to write an e-commerce product description based on the product details and customer reviews. Your description should be SEO-optimized. It should use an active voice and include the product's features, benefits, unique selling points without overpromising, and a call to action for the buyer. Benefits describe how product features will work for the buyer, addressing exactly how the product will improve their lives. Clearly distinguish between features (e.g., lightweight, USB-chargeable) and benefits (e.g., convenience, nutritious drinks on-the-go). Don't mention weaknesses of the product or use generic or repetitive language. Don't make up review text or quotes. Don't include any links. Don't cite the reviews too heavily. Divide your description into readable chunks divided by relevant subheadings. Keep your description around 200 words, no more than 300, in Markdown format.\n\n{document}"

    dataset = AmazonProductsDataset()
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(curr_dir, "processed_data")
    records_to_write = []

    for split in ["train", "test"]:
        openai_tasks = []
        records = []

        for record in dataset.iter(data_dir, split=split):
            records.append(record)
            openai_tasks.append(
                query_openai_api(
                    full_prompt_template.format(document=record["document"])
                )
            )

        # Wait for all the tasks to complete
        results = await asyncio.gather(*openai_tasks, return_exceptions=True)
        for record, result in zip(records, results):
            if isinstance(result, Exception):
                print(f"Error processing record")
                continue

            try:
                prompt, response = result
                records_to_write.append(
                    {
                        "id": record["id"],
                        "document": record["document"],
                        "prompt": prompt,
                        "response": response,
                        "split": split,
                    }
                )
                print("Wrote prompt and response")
            except Exception as e:
                print(f"Error processing record: {record}, error: {e}")

    # Write the results to a csv
    df = pd.DataFrame(records_to_write)
    df.to_csv(os.path.join(data_dir, "product_prompts_responses.csv"), index=False)


if __name__ == "__main__":
    # Gen datasets
    # gen_splits()

    # asyncio.run(run_medical_prompts())
    asyncio.run(run_product_seo())

# ------ Testing Medical Dataset ------
# Train records: 67
# Patient ID: virtassist-D2N001-VA049
# Patient Name: Martha Collins
# Age: 50.0
# Gender: female
# Chief Complaint: annual exam
# Secondary Complaints: congestive heart
# failure;depression;hypertension

# ---------------------------------------------
# MEDICAL NOTE:

# CHIEF COMPLAINT

# Annual exam.

# HISTORY OF PRESENT ILLNESS

# Martha Collins is a 50-year-old female with a past medical
# history significant for congestive heart failure, depression,
# and hypertension who presents for her annual exam. It has
# been a year since I last saw the patient.

# The patient has been traveling a lot recently since things
# have gotten a bit better. She reports that she got her
# COVID-19 vaccine so she feels safer about traveling. She has
# been doing a lot of hiking.

# She reports that she is staying active. She has continued
# watching her diet and she is doing well with that. The
# patient states that she is avoiding salty foods that she
# likes to eat. She has continued utilizing her medications.
# The patient denies any chest pain, shortness of breath, or
# swelling in her legs.

# Regarding her depression, she reports that she has been going
# to therapy every week for the past year. This has been really
# helpful for her. She denies suicidal or homicidal ideation.

# The patient reports that she is still forgetting to take her
# blood pressure medication. She has noticed that when work
# gets more stressful, her blood pressure goes up. She reports
# that work has been going okay, but it has been a lot of long
# hours lately.

# She endorses some nasal congestion from some of the fall
# allergies. She denies any other symptoms of nausea, vomiting,
# abdominal pain.

# REVIEW OF SYSTEMS

# • Ears, Nose, Mouth and Throat: Endorses nasal congestion
# from allergies.
# • Cardiovascular: Denies chest pain or dyspnea on exertion.
# • Respiratory: Denies shortness of breath.
# • Gastrointestinal: Denies abdominal pain, nausea, or
# vomiting.
# • Psychiatric: Endorses depression. Denies suicidal or
# homicidal ideations.

# PHYSICAL EXAMINATION

# • Cardiovascular: Grade 3/6 systolic ejection murmur.
# 1+ pitting edema of the bilateral lower extremities.

# VITALS REVIEWED

# • Blood Pressure: Elevated.

# RESULTS

# Echocardiogram demonstrates decreased ejection fraction of
# 45%. Mitral regurgitation is present.

# Lipid panel: Elevated cholesterol.

# ASSESSMENT AND PLAN

# Martha Collins is a 50-year-old female with a past medical
# history significant for congestive heart failure, depression,
# and hypertension who presents for her annual exam.

# Congestive heart failure.
# • Medical Reasoning: She has been compliant with her
# medication and dietary modifications. Her previous year's
# echocardiogram demonstrated a reduced ejection fraction of
# 45%, as well as some mitral regurgitation. Her cholesterol
# levels were slightly elevated on her lipid panel from last
# year.
# • Additional Testing: We will order a repeat echocardiogram.
# We will also repeat a lipid panel this year.
# • Medical Treatment: She will continue with her current
# medications. We will increase her lisinopril to 40 mg daily
# and initiate Lasix 20 mg daily.
# • Patient Education and Counseling: I encouraged her to
# continue with dietary modifications.

# Depression.
# • Medical Reasoning: She is doing well with weekly therapy.

# Hypertension.
# • Medical Reasoning: She has been compliant with dietary
# modifications but has been inconsistent with the use of her
# medication. She attributes elevations in her blood pressure
# to increased stress.
# • Medical Treatment: We will increase her lisinopril to 40 mg
# daily as noted above.
# • Patient Education and Counseling: I encouraged the patient
# to take her lisinopril as directed. I advised her to monitor
# her blood pressures at home for the next week and report them
# to me.

# Healthcare maintenance.
# • Medical Reasoning: The patient is due for her routine
# mammogram.
# • Additional Testing: We will order a mammogram and have this
# scheduled for her.

# Patient Agreements: The patient understands and agrees with
# the recommended medical treatment plan.


# ---------------------------------------------
# DIALOGUE:

#  hi , martha . how are you ?
#  i'm doing okay . how are you ?
#  i'm doing okay . so , i know the nurse told you about dax .
# i'd like to tell dax a little bit about you , okay ?
#  okay .
#  martha is a 50-year-old female with a past medical history
# significant for congestive heart failure , depression and
# hypertension who presents for her annual exam . so , martha ,
# it's been a year since i've seen you . how are you doing ?
#  i'm doing well . i've been traveling a lot recently since
# things have , have gotten a bit lighter . and i got my , my
# vaccine , so i feel safer about traveling . i've been doing a
# lot of hiking . uh , went to washington last weekend to hike
# in northern cascades, like around the mount baker area .
#  nice . that's great . i'm glad to hear that you're staying
# active , you know . i , i just love this weather . i'm so
# happy the summer is over . i'm definitely more of a fall
# person .
#  yes , fall foliage is the best .
#  yeah . um , so tell me , how are you doing with the
# congestive heart failure ? how are you doing watching your
# diet ? i know we've talked about watching a low sodium diet .
# are you doing okay with that ?
#  i've been doing well with that . i resisted , as much , as i
# could , from the tater tots , you know , the soft pretzels ,
# the salty foods that i , i love to eat . and i've been doing
# a really good job .
#  okay , all right . well , i'm glad to hear that . and you're
# taking your medication ?
#  yes .
#  okay , good . and any symptoms like chest pains , shortness
# of breath , any swelling in your legs ?
#  no , not that i've noticed .
#  okay , all right . and then in terms of your depression , i
# know that we tried to stay off of medication in the past
# because you're on medications for your other problems . how
# are you doing ? and i know that you enrolled into therapy .
# is that helping ? or-
#  yeah , it's been helping a lot . i've been going every week
# , um , for the past year since my last annual exam . and
# that's been really helpful for me .
#  okay . so , no , no issues , no feelings of wanting to harm
# yourself or hurt others ?
#  no , nothing like that .
#  okay , all right . and then in terms of your high blood
# pressure , i know that you and i have kind of battled in the
# past with you remembering to take some of your blood pressure
# medications . how are you doing with that ?
#  i'm still forgetting to take my blood pressure medication .
# and i've noticed when work gets more stressful , my blood
# pressure goes up .
#  okay . and , and so how has work going for you ?
#  it's been okay . it's been a lot of long hours , late nights
# . a lot of , um , you know , fiscal year end data that i've
# been having to pull . so , a lot of responsibility , which is
# good . but with the responsibility comes the stress .
#  yeah , okay , all right . i understand . um , all right .
# well , i know that you did a review of system sheet when you
# checked in with the nurse . i know that you were endorsing
# some nasal congestion from some of the fall pollen and
# allergies . any other symptoms , nausea or vomiting ,
# abdominal pain , anything like that ?
#  no , nothing like that .
#  no , okay , all right . well , i'm gon na go ahead and do a
# quick physical exam , okay ?
#  okay .
#  hey , dragon , show me the blood pressure . so , yeah ,
# looking at your blood pressure today here in the office , it
# is a little elevated . you know , it could just , you could
# just be nervous . uh , let's look at some of the past
# readings . hey , dragon , show me the blood pressure readings
# . hey , dragon , show me the blood pressure readings . here
# we go . uh , so they are running on the higher side . um , y-
# you know , i , i do think that , you know , i'd like to see
# you take your medication a little bit more , so that we can
# get that under control a little bit better , okay ?
#  okay .
#  so , i'm just gon na check out your heart and your lungs .
# and you know , let you know what i find , okay ?
#  okay .
#  okay . so , on your physical examination , you know ,
# everything looks good . on your heart exam , i do appreciate
# a three out of six systolic ejection murmur , which i've
# heard in the past , okay ? and on your lower extremities , i
# do appreciate one plus pitting edema , so you do have a
# little bit of fluid in your legs , okay ?
#  okay .
#  let's go ahead , i wan na look at some of your results ,
# okay ? hey , dragon , show me the echocardiogram . so , this
# is the result of the echocardiogram that we did last year .
# it showed that you have that low-ish pumping function of your
# heart at about 45 % . and it also sh- shows some mitral
# regurgitation , that's that heart murmur that i heard , okay
# ?
#  um , hey , dragon , show me the lipid panel . so , looking
# at your lipid panel from last year , you know , everything ,
# your cholesterol was like , a tiny bit high . but it was n't
# too , too bad , so i know you're trying to watch your diet .
# so , we'll repeat another one this year , okay ?
#  okay .
#  um , so i wan na just go over a little bit about my
# assessment and my plan for you , okay ? so , for your first
# problem your congestive heart failure , um , i wan na
# continue you on your current medications . but i do wan na
# increase your lisinopril to 40 milligrams a day , just
# because your blood pressure's high . and you know , you are
# retaining a little bit of fluid . i also wan na start you on
# some lasix , you know , 20 milligrams a day . and have you
# continue to watch your , your diet , okay ?
#  okay .
#  i also wan na repeat another echocardiogram , okay ?
#  all right .
#  hey , dragon , order an echocardiogram . from a depression
# standpoint , it sounds like you're doing really well with
# that . so , i'm , i'm really happy for you . i'm , i'm glad
# to see that you're in therapy and you're doing really well .
# i do n't feel the need to start you on any medications this
# year , unless you feel differently .
#  no , i feel the same way .
#  okay , all right . and then for your last problem your
# hypertension , you know , again i , i , i think it's out of
# control . but we'll see , i think , you know , i'd like to
# see you take the lisinopril as directed , okay ? uh , i want
# you to record your blood pressures within the patient , you
# know , take your blood pressure every day . record them to me
# for like , about a week , so i have to see if we have to add
# another agent , okay ? 'cause we need to get that under
# better control for your heart failure to be more successful ,
# okay ?
#  okay .
#  do you have any questions ? , and i forgot . for your annual
# exam , you're due for a mammogram , so we have to schedule
# for that , as well , okay ?
#  okay .
#  okay . do you have any questions ?
#  can i take all my pills at the same time ?
#  yeah .
#  'cause i've been trying to take them at different times of
# the day , 'cause i did n't know if it was bad to take them
# all at once or i should separate them . i do n't know .
#  yeah . you can certainly take them , you know , all at the
# same time , as long , as yeah , they're all one scale . you
# can take them all at the same time . just set an alarm-
#  okay .
#  . some time during the day to take them , okay ?
#  that might help me remember better .
#  all right . that sounds good . all right , well , it's good
# to see you .
#  good seeing you too .
#  hey , dragon , finalize the note .
# Test records: 20
# Patient ID: virtassist-D2N068-VA052
# Patient Name: Brian  White
# Age: 58
# Gender: male
# Chief Complaint: follow-up of chronic problems
# Secondary Complaints: congestive heart failure;hypertension

# ---------------------------------------------
# MEDICAL NOTE:

# CHIEF COMPLAINT

# Follow-up of chronic problems.

# HISTORY OF PRESENT ILLNESS

# Brian White is a 58-year-old male with a past medical history
# significant for congestive heart failure and hypertension,
# who presents today for follow-up of his chronic problems.

# The patient states he has been feeling out of sorts lately.
# He is not sure if it is due to the change in the seasons or
# due to performing lots of projects and some construction on
# his home. He reports fatigue and lightheadedness. This has
# been going on for about 5 weeks. While exerting energy, he
# has experienced some shortness of breath and chest cramps.
# The patient also notes a slight cough, but he is not sure if
# it is just the change in seasons.

# He feels bloated every once in a while. His diet has been a
# little bit of a struggle. They had construction on their
# kitchen begin over Labor Day weekend, and have been eating
# less healthy food as a result.

# Regarding his heart failure, he has been pretty good with his
# salt intake. He has been pretty good about his diet since the
# last year and is staying on top of that as much as possible.
# The patient has continued to utilize Lasix daily.

# For his hypertension, this has been well controlled with
# lisinopril 20 mg a day. He has continued to monitor his blood
# pressure regularly.

# The patient did the review of systems sheet when he checked
# in. He denies weight gain, swelling in the lower extremities,
# fevers, chills, dizziness, nausea, vomiting, and diarrhea.

# REVIEW OF SYSTEMS

# • Constitutional: Endorses fatigue. Denies fevers, chills, or
# weight loss.
# • Cardiovascular: Endorses chest pain or dyspnea on exertion.
# • Respiratory: Endorses cough and shortness of breath.
# • Gastrointestinal: Endorses bloating.

# PHYSICAL EXAMINATION

# • Neck: JVD 8 cm.
# • Respiratory: Rales bilateral bases.
# • Cardiovascular: 3/6 systolic ejection murmur.
# • Musculoskeletal: 1+ pitting edema bilateral lower
# extremities.

# RESULTS

# X-ray of the chest demonstrates a mild amount of fluid in the
# lungs.

# Echocardiogram demonstrates decreased ejection fraction of
# 45% and mild mitral regurgitation.

# ASSESSMENT AND PLAN

# Brian White is a 58-year-old male with a past medical history
# significant for congestive heart failure and hypertension,
# who presents today for follow up of his chronic problems.

# Congestive heart failure.
# • Medical Reasoning: The patient reports increased fatigue,
# dizziness, and chest discomfort on exertion. He also exhibits
# some jugular venous distention, lung base crackles, and lower
# extremity edema on exam today. He has been compliant with his
# current medications but admits to dietary indiscretion
# lately. His recent echocardiogram demonstrated a reduced
# ejection fraction of 45%, as well as mitral regurgitation.
# • Additional Testing: We will order a repeat echocardiogram.
# • Medical Treatment: Increase Lasix to 80 mg daily.
# • Patient Education and Counseling: I advised the patient to
# monitor and record his daily weight and report those to me
# via the patient portal. He will contact me should he continue
# to experience any dyspnea.

# Hypertension.
# • Medical Reasoning: This is well controlled based on home
# monitoring.
# • Medical Treatment: Continue lisinopril 20 mg daily.
# • Patient Education and Counseling: I advised him to monitor
# and record his blood pressures at home and report these to me
# via the patient portal.

# Patient Agreements: The patient understands and agrees with
# the recommended medical treatment plan.

# ---------------------------------------------
# DIALOGUE:

#  hi , brian . how are you ?
#  hi , good to see you .
#  it's good to see you too . so , i know the nurse told you a
# little bit about dax .
#  mm-hmm .
#  i'd like to tell dax about you , okay ?
#  sure .
#  so , brian is a 58 year old male with a past medical history
# significant for congestive heart failure and hypertension ,
# who presents today for follow-up of his chronic problems . so
# , brian , it's been a little while i've seen you .
#  mm-hmm .
#  whats , what's going on ?
#  i , i just feel out of sorts lately . i do n't know if it's
# the change in the seasons or if we're just doing a lot of
# projects around the house and , and some , some construction
# on our own . i'm just feeling out of it . lack of , uh ,
# energy . i'm just so tired and fatigued , and i feel kinda
# ... i feel lightheaded every once in a while .
#  okay . all right . um , how long has that been going on for
# ?
#  uh , probably since labor day , so about five weeks or so .
#  okay . and , have you noticed any , like , symptoms of
# weight gain , like , like swollen legs , or , you know , your
# belly feels bloated and things like that ?
#  i feel , i feel bloated every once in a while .
#  okay . all right . um , and , are you taking your , your
# medications ?
#  uh , yes , i am .
#  okay . and , how about your diet ? are you watching your
# diet ?
#  uh , it's been a little bit of a struggle . we began
# construction on our kitchen over labor day weekend , and it
# was ... hard to cook or prepare meals so we ate out a lot,
# and not always the best food out. it , it , it kind of reeked
# havoc , uh , so it's been maybe off a little bit .
#  okay . all right . and , how about , you know , other
# symptoms , like , have you had a fever or chills ?
#  no .
#  okay , and any problems breathing ? do you feel short of
# breath ?
#  uh , just when i'm doing doing the projects . again , not
# even lifting anything really heavy , it's just that if i'm
# ex- exerting any energy , i , i kinda feel it at that point .
#  okay . do you have any chest pain ?
#  slight cramps . that seems to go away after about , maybe
# about an hour or so after i first feel it .
#  okay , and how about a cough ?
#  a , a slight cough , and again , i'm not sure if it's just
# the change of seasons and i'm getting a cold .
#  mm-hmm . okay . all right . well , you know , for the most
# part , how , you know , before all of this-
#  mm-hmm .
#  . how were you doing with your heart failure ? i know that
# we've kinda talked about you being able to watch your healthy
# food intake and that's been kind of a struggle in the past .
#  i , i , i've actually been pretty good about that ever since
# . the , the , the last year , it's been a little chaotic ,
# but i wanted to make sure i stayed on top of that .
#  okay . all right . are you excited for halloween ?
#  uh , ca n't wait .
#  okay .
#  our home renovations should be complete by then
#  all right , yeah , right .
#  yeah .
#  and , so , lastly , for your high blood pressure , how are
# you doing with that ? have , are , did you buy the blood
# pressure cuff like i asked ?
#  yeah , i , i did , and we do mon- , i , i monitor it
# regularly . my wife makes sure i stay on top of that , but
# it's been pretty good .
#  okay . all right . well , i know you did the review of
# systems sheet when you checked in , and you were endorsing
# this fatigue-
#  mm-hmm .
#  . and a little dizziness and we just talked a lot about a
# lot of other symptoms .
#  mm-hmm .
#  any other symptoms i might be missing ? nausea or vomiting ,
# diarrhea ?
#  no .
#  anything like that ?
#  no .
#  okay . all right . well , i just want to go ahead and do a
# quick physical exam .
#  mm-hmm .
#  hey , dragon ? show me the vital signs . so , looking at
# your vital signs here in the office , everything looks good .
# you know , your blood pressure and your heart rate and your
# oxygenation all look really good .
#  mm-hmm .
#  so , i'm gon na just take a listen to a few things and check
# some things out , and i'll let you know what i find , okay ?
#  perfect .
#  okay . so , on your physical examination , you know , i do
# appreciate some jugular venous distention to-
#  mm-hmm .
#  to about eight centimeters . on your heart exam , i do
# appreciate a three out of six systolic ejection murmur ,
# which we've heard in the past . and , on your lung exam , i
# do appreciate some fine crackles at the bases bilaterally ,
# and your lower extremities have , you know , 1+ pitting edema
# . so , what does all that mean ? that means i think you're
# retaining a little bit of fluid .
#  mm-hmm .
#  okay ? i wan na just go ahead and look at some of your
# results , okay ?
#  sure .
#  hey , dragon ? show me the chest x-ray . so , looking here
# at the results of your chest x-ray , it does look like you
# have a little bit of fluid in your lungs there , and that can
# be just from , um , your heart failure , okay ? hey , dragon
# ? show me the echocardiogram . so , this is the
# echocardiogram that we did about four months ago , and this
# shows that the pumping function of your heart is a little bit
# reduced at 45 % , and it also shows that leaky valve , the
# mitral regurgitation that , that you have , okay ? um , so ,
# let me just go over and talk about , a little bit , my
# assessment and my plan for you .
#  mm-hmm .
#  okay ? so , for your first problem , your congestive heart
# failure , i think you're retaining fluid , and i wan na go
# ahead and increase your lasix to 80 mg once a day .
#  mm-hmm .
#  i want you to weigh yourself every day . i want you to call
# me if you're gaining more weight .
#  mm-hmm .
#  and , i certainly want you to call me if you have any other
# symptoms of shortness of breath , and i wan na go ahead and
# order another echocardiogram , okay ?
#  sure .
#  hey , dragon ? order an echocardiogram .
# lastly , for your high blood pressure , it looks like you're
# managing it well at this time , okay ? so , i wan na go ahead
# and continue with the lisinopril 20 mg a day . i want you to
# continue to record your blood pressures at home , and report
# them to me in the patient portal if you see they're getting
# elevated , okay ?
#  mm-hmm .
#  does that sound like a plan ?
#  that sounds fine .
#  okay . um , i'm gon na be in touch with you after we get
# your test results , and we'll go from there , okay ?
#  sure .
#  all right . hey , dragon , finalize the note .
# ------ Testing Amazon Products Dataset ------
# Train records: 120

# Product ID: B000NWD020
# Title: Yardley of London Moisturizing Soap Sweet Summer Aloe
# and Avocado 3+1
# Average Rating: 4.1
# Number of Ratings: 19
# Features: ['Fresh Aloe & Avocado with Creamy Avocado & Olive
# Oil Extracts', 'The actual product may be different than
# product image']
# Description: ['INDICATIONS: A light, refreshing scent of aloe
# with a hint of sweet cucumber. This gentle soap contains aloe
# vera to help soothe and heal the skin. Not tested on
# animals.']
# Price: 12.45
# Store: Yardley
# Details: {"Item Form": "Cream", "Skin Type": "Dry", "Brand":
# "Yardley", "Scent": "Cucumber,Avocado", "Age Range
# (Description)": "Senior,Adult,Tween,Teen,Child", "Is
# Discontinued By Manufacturer": "No", "Item model number":
# "LORNAMEAD866673", "UPC": "041840873713", "Manufacturer":
# "Yardley"}
# Review Text: My daughter uses this soap for my grandson's
# acute excema!  It works wonders!  It clears his skin right
# up, and it smells good too!  LOVE THIS SOAP! Typical of
# Yardley, a nicely scented soap that I look forward to using.
# I would buy it, or any Yardley soap again (love the lemon and
# lavender scents too,)  They make me feel refreshed. Great
# soap with light scent. Decent price. Smells wonderful, great
# as a skin moisturizer.  Shipped QUICKLY and the price was
# definitely right.  I will buy this again. I will never order
# this product again!! This soap makes my skin dry out!!! It
# smells great though, but smell is not everything. Great
# product I was disappointed to see them sold in my local
# dollar store. *sigh* I was disappointed to see them sold in
# my local dollar store. *sigh*

# Test records: 30

# Product ID: B08QWK8TDF
# Title: Bath Accessories Ice Bag, Pigs
# Average Rating: 4.2
# Number of Ratings: 21
# Features: ['This product is pamper yourself at home', 'This
# product is luxurious bath and spa products', 'Spa sister']
# Description: ['Bath Accessories Company Company Ice bag,
# pigs']
# Price: 13.28
# Store: BATH ACCESSORIES
# Details: {"Product Dimensions": "5 x 5 x 5 inches; 1.6
# Ounces", "Item model number": "5701PS", "UPC": "763109824853
# 636581139886 794438084892", "Manufacturer": "The Regatta
# Group DBA Beauty Depot"}
# Review Text: These are a lot of fun! I ordered several. More
# importantly, they get the job done without problems. I get
# cortisone injections in my knees.  I use this little bag with
# ice afterwards.  Perfect. Said I was getting 3??? Only got
# 1?? This is the brand that I have and it doesn't leak like
# the others.  It is well insulated, and it stays cold for a
# long time.  It's also really cute!  P.S.  I just received my
# new one and the packaging is so nice.  And, it arrived a day
# early. love this so much!!! it's super cute, great size and
# material I love it!!! Just as advertised!!! Wish there were
# more graduating sizes larger with the pigs!! Not as good as
# one I had before that I bought in a store. This one leaks
# sometimes. Great small ice bag.

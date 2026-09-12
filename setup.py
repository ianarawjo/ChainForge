from setuptools import setup, find_packages

# Dependency groups
rag_deps = [
    # RAGForge dependencies
    "grpcio",
    "numpy>=1.26",
    "pymupdf",
    "python-docx",
    "tiktoken",
    "nltk>=3.8",
    "transformers",
    "scikit-learn>=1.4.0",
    "sentence-transformers",
    "rank-bm25",
    "whoosh",
    "cohere",
    "chonkie>=1.0",
    "model2vec>=0.5.0",  # required by chonkie
    # NOTE: Do not cap pyarrow/lancedb. Older pyarrow (<=16) ships no wheels for
    # Python 3.13+, so pip falls back to building from source, which fails.
    "pyarrow>=14.0",
    "lancedb>=0.17",
    # Imported directly by chainforge/rag (vector_stores, embeddings). Do not
    # rely on these arriving transitively via markitdown/transformers.
    "pandas",
    "tqdm",
    "accelerate",
]

def readme():
    with open('README.md', encoding='utf-8') as f:
        return f.read()

setup(
    name="chainforge",
    version="0.3.7.0",
    packages=find_packages(),
    author="Ian Arawjo",
    description="A Visual Programming Environment for Prompt Engineering",
    long_description=readme(),
    long_description_content_type="text/markdown",
    keywords="prompt engineering LLM response evaluation",
    license="MIT",
    url="https://github.com/ianarawjo/ChainForge/",
    install_requires=[
        # Core package dependencies (pre-RAGForge)
        "flask>=2.2.3",
        "flask[async]",
        "flask_cors",
        "requests",
        "platformdirs",
        "urllib3==1.26.6",
        "openai",
        "cryptography",
        "mistune>=2.0",  # for LLM response markdown parsing
        "markitdown[pdf, docx, xlsx, xls, pptx]",
    ],
    extras_require={
        # Extra dependencies for functionality like RAGForge,
        # which may not be needed by all users
        "rag": rag_deps,
        # FAISS is an optional alternative vector store. It is not part of
        # [rag] because faiss-cpu needs swig, which on macOS is only available
        # via homebrew ("brew install swig"). chainforge.rag soft-fails without
        # it; install this extra to enable the FAISS retrieval methods.
        "faiss": ["faiss-cpu"],
        "all": rag_deps + ["faiss-cpu"],
    },
    entry_points={
        "console_scripts": [
            "chainforge = chainforge.app:main",
        ],
    },
    classifiers=[
        # Package classifiers
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Programming Language :: Python :: 3.14",
    ],
    python_requires=">=3.10",
    include_package_data=True,
)

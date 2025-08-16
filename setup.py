from setuptools import setup, find_packages

def readme():
    with open('README.md', encoding='utf-8') as f:
        return f.read()

setup(
    name="chainforge",
    version="0.3.6.2",
    packages=find_packages(),
    author="Ian Arawjo",
    description="A Visual Programming Environment for Prompt Engineering",
    long_description=readme(),
    long_description_content_type="text/markdown",
    keywords="prompt engineering LLM response evaluation",
    license="MIT",
    url="https://github.com/ianarawjo/ChainForge/",
    install_requires=[
        # Package dependencies
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
    ],
    python_requires=">=3.10",
    include_package_data=True,
)

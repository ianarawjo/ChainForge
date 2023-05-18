from setuptools import setup, find_packages

setup(
    name='chainforge',
    version='0.1.0',
    packages=find_packages(),
    author="Ian Arawjo",
    description="A Visual Programming Environment for Prompt Engineering",
    url="https://github.com/ianarawjo/ChainForge/",
    install_requires=[
        # Package dependencies
        "flask[async]",
        "flask_cors",
        "flask_socketio",
        "openai",
        "python-socketio",
        "dalaipy>=2.0.2",
        "gevent-websocket",
        "urllib3==1.26.6",
    ],
    entry_points={
        'console_scripts': [
            'chainforge = chainforge.app:main',
        ],
    },
    classifiers=[
        # Package classifiers
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
    ],
    python_requires=">=3.7",
    include_package_data=True,
)
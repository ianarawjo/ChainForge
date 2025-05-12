import argparse
from chainforge.flask_app import run_server
import textwrap

# Main Chainforge start
def main():
    parser = argparse.ArgumentParser(description='Chainforge command line tool')

    # Serve command
    subparsers = parser.add_subparsers(dest='serve')
    serve_parser = subparsers.add_parser('serve', help='Start Chainforge server', formatter_class=argparse.RawTextHelpFormatter)

    # TODO: Add this back
    # Turn on to disable all outbound LLM API calls and replace them with dummy calls
    # that return random strings of ASCII characters. Useful for testing interface without wasting $$.
    # serve_parser.add_argument('--dummy-responses', 
    #     help="""Disables queries to LLMs, replacing them with spoofed responses composed of random ASCII characters. 
    #             Produces each dummy response at random intervals between 0.1 and 3 seconds.""", 
    #     dest='dummy_responses', 
    #     action='store_true')
    
    # TODO: Reimplement this where the React server is given the backend's port before loading.
    serve_parser.add_argument('--port', 
                              help='The port to run the server on. Defaults to 8000.', 
                              type=int, default=8000, nargs='?')
    serve_parser.add_argument('--host', 
                              help="The host to run the server on. Defaults to 'localhost'.", 
                              type=str, default="localhost", nargs='?')
    serve_parser.add_argument('--dir',
                              help=textwrap.dedent("""\
                                Set a custom directory to use for saving flows and autosaving.
                                By default, ChainForge uses the user data location suggested by the `platformdirs` module.
                                Should be an absolute path."""),
                              type=str,
                              default=None)
    serve_parser.add_argument('--secure', 
                              choices=["off", "settings", "all"],
                              default="off",
                              help=textwrap.dedent("""\
                                Encrypts locally stored files with a password. 
                                Encryption modes are:
                                    - off      = no encryption (default)
                                    - settings = only encrypt the settings file (that may contain API keys entered via the UI)
                                    - all      = encrypt all files (flows, settings, favorites, etc)
                                You must provide a password at every startup.
                                Ensure that you save your password somewhere, as it is not stored anywhere.
                                If you lose it, you will not be able to access your files. 
                                NOTE: Clicking the 'Export' button in the UI will still export a non-encrypted flow, in case you need to share the file in the normal manner. 
                                This setting is only for local storage.""")
                               )

    args = parser.parse_args()

    # Currently only support the 'serve' command...
    if not args.serve:
        parser.print_help()
        exit(0)

    port = args.port if args.port else 8000
    host = args.host if args.host else "localhost"

    if args.dir:
        print(f"Using directory for storing flows: {args.dir}")

    print(f"Serving Flask server on {host} on port {port}...")
    run_server(host=host, port=port, flows_dir=args.dir, secure=args.secure)

if __name__ == "__main__":
    main()
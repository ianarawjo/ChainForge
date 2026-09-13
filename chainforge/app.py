import argparse
import os
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

    serve_parser.add_argument('--allowed-hosts',
                              dest='allowed_hosts',
                              default=os.environ.get("CHAINFORGE_ALLOWED_HOSTS", ""),
                              metavar='HOSTS',
                              help=textwrap.dedent("""\
                                Comma-separated names or IP addresses, besides localhost and 127.0.0.1, that
                                ChainForge may be reached by -- for example a server's domain name, or this
                                machine's address on your network. Requests addressed to any other name are
                                refused, which protects against DNS rebinding attacks.
                                Can also be set with the CHAINFORGE_ALLOWED_HOSTS environment variable."""))
    serve_parser.add_argument('--dev-origins',
                              dest='dev_origins',
                              default=os.environ.get("CHAINFORGE_DEV_ORIGINS", ""),
                              metavar='ORIGINS',
                              help=textwrap.dedent("""\
                                For front-end development only. Comma-separated origins of a separate dev
                                server allowed to use this server, e.g. http://localhost:3000. Anything served
                                from these origins can run code through ChainForge, so only list servers you run.
                                Can also be set with the CHAINFORGE_DEV_ORIGINS environment variable."""))
    serve_parser.add_argument('--idle-shutdown',
                              dest='idle_shutdown',
                              type=float,
                              default=None,
                              metavar='MINUTES',
                              help=textwrap.dedent("""\
                                Stop the server once no ChainForge page has been open for this many minutes.
                                Open pages send a heartbeat every 5 minutes, so use 15 or more.
                                Off by default."""))

    args = parser.parse_args()

    # Currently only support the 'serve' command...
    if not args.serve:
        parser.print_help()
        exit(0)

    from chainforge.local_access import normalize_origin, parse_list
    dev_origins = parse_list(args.dev_origins)
    for origin in dev_origins:
        if normalize_origin(origin) is None:
            serve_parser.error(f"--dev-origins: '{origin}' is not an origin like http://localhost:3000")

    if args.idle_shutdown is not None and args.idle_shutdown <= 0:
        serve_parser.error("--idle-shutdown must be a positive number of minutes")

    port = args.port if args.port else 8000
    host = args.host if args.host else "localhost"

    if args.dir:
        print(f"Using directory for storing flows: {args.dir}")

    # Say so rather than letting embeddings quietly run slower for no visible
    # reason. See chainforge/_openmp.py for why this is necessary.
    from chainforge import _openmp

    if _openmp.limited_openmp_for_faiss:
        print(
            "FAISS detected alongside PyTorch: limiting OpenMP to 1 thread to "
            "avoid a crash in their bundled runtimes. Embedding will be slower. "
            "Set OMP_NUM_THREADS yourself to override."
        )

    print(f"Serving Flask server on {host} on port {port}...")
    run_server(host=host, port=port, flows_dir=args.dir, secure=args.secure,
               allowed_hosts=parse_list(args.allowed_hosts), dev_origins=dev_origins,
               idle_shutdown_minutes=args.idle_shutdown)

if __name__ == "__main__":
    main()